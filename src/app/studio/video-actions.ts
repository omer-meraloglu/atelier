"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getFal } from "@/lib/fal";
import { getVideoProvider } from "@/lib/providers/video";
import {
  ASSETS_BUCKET,
  SIGNED_URL_TTL_PROVIDER,
  signPath,
} from "@/lib/storage";
import type { VideoGenerationRow } from "@/lib/database.types";

const startSchema = z.object({
  sourceKind: z.enum(["asset", "generation"]),
  sourceId: z.string().uuid(),
  providerId: z.string().min(1).max(100),
  prompt: z.string().trim().max(600).optional(),
  durationSeconds: z.number().int().min(1).max(15).optional(),
  motion: z.enum(["low", "medium", "high"]).optional(),
});

export interface VideoStatus {
  id: string;
  status: VideoGenerationRow["status"];
  providerId: string;
  resultUrl?: string;
  posterUrl?: string;
  latencyMs?: number;
  error?: string;
}

/** Stricter guard than images: clips are slow and expensive. */
const VIDEO_ACTIVE_LIMIT = 2;
const VIDEO_STUCK_AFTER_MS = 15 * 60 * 1000;
const MOCK_RENDER_MS = 8_000;

function toStatus(
  row: VideoGenerationRow,
  urls?: { resultUrl?: string; posterUrl?: string }
): VideoStatus {
  return {
    id: row.id,
    status: row.status,
    providerId: row.provider_model_id,
    resultUrl: urls?.resultUrl,
    posterUrl: urls?.posterUrl,
    latencyMs: row.latency_ms ?? undefined,
    error: row.error ?? undefined,
  };
}

export async function startVideoGeneration(
  input: z.infer<typeof startSchema>
): Promise<VideoStatus | { error: string }> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid request." };
  }
  const { sourceKind, sourceId, providerId, prompt, durationSeconds, motion } =
    parsed.data;

  const { supabase, user } = await requireUser();

  const provider = getVideoProvider(providerId);
  if (!provider) {
    return { error: "Unknown video model." };
  }

  const { count } = await supabase
    .from("video_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["queued", "processing"]);
  if ((count ?? 0) >= VIDEO_ACTIVE_LIMIT) {
    return {
      error: "Two clips are already rendering — let one finish first.",
    };
  }

  // Resolve the still we are animating.
  let sourcePath: string | null = null;
  if (sourceKind === "asset") {
    const { data: asset } = await supabase
      .from("assets")
      .select("storage_path")
      .eq("id", sourceId)
      .eq("user_id", user.id)
      .single();
    sourcePath = asset?.storage_path ?? null;
  } else {
    const { data: generation } = await supabase
      .from("generations")
      .select("result_path, status")
      .eq("id", sourceId)
      .eq("user_id", user.id)
      .single();
    sourcePath =
      generation?.status === "succeeded" ? generation.result_path : null;
  }
  if (!sourcePath) {
    return { error: "The source image is not available." };
  }

  const imageUrl = await signPath(
    supabase,
    sourcePath,
    SIGNED_URL_TTL_PROVIDER
  );
  if (!imageUrl) {
    return { error: "Could not read the source image." };
  }

  const videoInput = {
    imageUrl,
    prompt: prompt || undefined,
    durationSeconds,
    motion,
  };

  const { data: row, error: insertError } = await supabase
    .from("video_generations")
    .insert({
      user_id: user.id,
      source_kind: sourceKind,
      source_asset_id: sourceKind === "asset" ? sourceId : null,
      source_generation_id: sourceKind === "generation" ? sourceId : null,
      provider_model_id: provider.id,
      status: "queued",
      params: {
        prompt: prompt ?? null,
        durationSeconds: durationSeconds ?? null,
        motion: motion ?? null,
      },
    })
    .select()
    .single();

  if (insertError || !row) {
    return { error: "Could not start the clip." };
  }

  try {
    let requestId: string;
    if (provider.falEndpoint === "mock") {
      requestId = `mock-${row.id}`;
    } else {
      const fal = getFal();
      const submitted = await fal.queue.submit(provider.falEndpoint, {
        input: provider.buildInput(videoInput),
      });
      requestId = submitted.request_id;
    }

    const { data: updated } = await supabase
      .from("video_generations")
      .update({
        params: {
          prompt: prompt ?? null,
          durationSeconds: durationSeconds ?? null,
          motion: motion ?? null,
          requestId,
        },
      })
      .eq("id", row.id)
      .eq("user_id", user.id)
      .select()
      .single();

    revalidatePath("/history");
    return toStatus(updated ?? row);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "The video model rejected the job.";
    await supabase
      .from("video_generations")
      .update({ status: "failed", error: message })
      .eq("id", row.id)
      .eq("user_id", user.id);
    revalidatePath("/history");
    return { error: message };
  }
}

/**
 * One poll tick. Checks fal's queue, downloads + stores the clip when it
 * completes, and always leaves the row in a truthful state.
 */
export async function pollVideoGeneration(input: {
  id: string;
}): Promise<VideoStatus | { error: string }> {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid clip." };

  const { supabase, user } = await requireUser();

  const { data: row } = await supabase
    .from("video_generations")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();

  if (!row) return { error: "Clip not found." };

  if (row.status === "succeeded") {
    const resultUrl = row.result_path
      ? ((await signPath(supabase, row.result_path)) ?? undefined)
      : undefined;
    const posterUrl = row.poster_path
      ? ((await signPath(supabase, row.poster_path)) ?? undefined)
      : undefined;
    return toStatus(row, { resultUrl, posterUrl });
  }
  if (row.status === "failed") {
    return toStatus(row);
  }

  const provider = getVideoProvider(row.provider_model_id);
  const params = (row.params ?? {}) as Record<string, unknown>;
  const requestId =
    typeof params.requestId === "string" ? params.requestId : null;

  async function fail(message: string): Promise<VideoStatus> {
    const { data: failed } = await supabase
      .from("video_generations")
      .update({ status: "failed", error: message })
      .eq("id", row!.id)
      .eq("user_id", user.id)
      .select()
      .single();
    revalidatePath("/history");
    return toStatus(failed ?? row!);
  }

  if (!provider || !requestId) {
    return await fail("The job reference was lost.");
  }

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > VIDEO_STUCK_AFTER_MS) {
    return await fail("The render took too long and was abandoned.");
  }

  try {
    let videoUrl: string | null = null;
    let videoBytes: Uint8Array | null = null;
    let inProgress = false;

    if (provider.falEndpoint === "mock") {
      if (ageMs < MOCK_RENDER_MS) {
        inProgress = ageMs > MOCK_RENDER_MS / 3;
      } else {
        videoBytes = new Uint8Array(
          await readFile(path.join(process.cwd(), "dev", "mock-clip.mp4"))
        );
      }
    } else {
      const fal = getFal();
      const status = await fal.queue.status(provider.falEndpoint, {
        requestId,
        logs: false,
      });

      if (status.status === "COMPLETED") {
        const { data } = await fal.queue.result(provider.falEndpoint, {
          requestId,
        });
        videoUrl = provider.parseOutput(data).videoUrl;
      } else {
        inProgress = status.status === "IN_PROGRESS";
      }
    }

    if (!videoUrl && !videoBytes) {
      // Still cooking — surface honest state transitions.
      if (inProgress && row.status === "queued") {
        const { data: processing } = await supabase
          .from("video_generations")
          .update({ status: "processing" })
          .eq("id", row.id)
          .eq("user_id", user.id)
          .select()
          .single();
        return toStatus(processing ?? row);
      }
      return toStatus(row);
    }

    if (!videoBytes && videoUrl) {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        return await fail("The provider returned an unreadable video.");
      }
      videoBytes = new Uint8Array(await response.arrayBuffer());
    }

    const resultPath = `${user.id}/videos/${row.id}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from(ASSETS_BUCKET)
      .upload(resultPath, videoBytes!, {
        contentType: "video/mp4",
        upsert: true,
      });
    if (uploadError) {
      return await fail("Could not store the clip.");
    }

    const requestedDuration =
      typeof params.durationSeconds === "number"
        ? params.durationSeconds
        : null;

    const { data: succeeded } = await supabase
      .from("video_generations")
      .update({
        status: "succeeded",
        result_path: resultPath,
        latency_ms: ageMs,
        duration_s: requestedDuration,
      })
      .eq("id", row.id)
      .eq("user_id", user.id)
      .select()
      .single();

    const resultUrl = (await signPath(supabase, resultPath)) ?? undefined;
    revalidatePath("/history");
    return toStatus(succeeded ?? row, { resultUrl });
  } catch (err) {
    return await fail(
      err instanceof Error ? err.message : "Polling the render failed."
    );
  }
}

/** Records the browser-captured poster frame for a finished clip. */
export async function attachPoster(input: {
  id: string;
  posterPath: string;
}) {
  const parsed = z
    .object({ id: z.string().uuid(), posterPath: z.string().min(1).max(1024) })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid poster." };

  const { supabase, user } = await requireUser();

  if (!parsed.data.posterPath.startsWith(`${user.id}/`)) {
    return { error: "Poster path does not belong to you." };
  }

  const { error } = await supabase
    .from("video_generations")
    .update({ poster_path: parsed.data.posterPath })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .eq("status", "succeeded");

  if (error) return { error: "Could not record the poster." };
  revalidatePath("/history");
  return {};
}
