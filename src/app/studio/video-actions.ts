"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getCreditState, spendCredits } from "@/lib/billing/credits";
import { CREDIT_COSTS } from "@/lib/billing/plans";
import { getFal } from "@/lib/fal";
import { getVideoProvider } from "@/lib/providers/video";
import { SIGNED_URL_TTL_PROVIDER, signPath } from "@/lib/storage";
import { stableSignedUrl } from "@/lib/signed-urls";
import { failVideoRow, tickVideoRow } from "@/lib/video-jobs";
import type { VideoGenerationRow } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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

async function toStatus(
  supabase: SupabaseClient<Database>,
  row: VideoGenerationRow
): Promise<VideoStatus> {
  const resultUrl =
    row.status === "succeeded" && row.result_path
      ? ((await stableSignedUrl(row.result_path)) ?? undefined)
      : undefined;
  const posterUrl = row.poster_path
    ? ((await stableSignedUrl(row.poster_path)) ?? undefined)
    : undefined;
  return {
    id: row.id,
    status: row.status,
    providerId: row.provider_model_id,
    resultUrl,
    posterUrl,
    latencyMs: row.latency_ms ?? undefined,
    error: row.error ?? undefined,
  };
}

/** Public https origin fal can call back; localhost gets no webhook. */
function webhookBaseUrl(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site && site.startsWith("https://")) {
    return site.replace(/\/+$/, "");
  }
  return null;
}

export async function startVideoGeneration(
  input: z.infer<typeof startSchema>
): Promise<VideoStatus | { error: string; code?: "no-credits" | "video-locked" }> {
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

  // Plan gate: clips are a paid-tier feature; the server refuses no matter
  // what the UI shows.
  const creditState = await getCreditState(supabase, user.id);
  if (!creditState.videoEnabled) {
    return {
      error: "Motion is part of the paid plans — upgrade to render clips.",
      code: "video-locked",
    };
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

  // Meter before the (expensive) submit; failVideoRow refunds on failure.
  const paid = await spendCredits(
    supabase,
    CREDIT_COSTS.video,
    "video_render",
    row.id
  );
  if (!paid) {
    await failVideoRow(supabase, row, "Not enough credits for a clip.");
    revalidatePath("/history");
    return {
      error: `A clip costs ${CREDIT_COSTS.video} credits — top up or upgrade to render it.`,
      code: "no-credits",
    };
  }

  try {
    let requestId: string;
    if (provider.falEndpoint === "mock") {
      requestId = `mock-${row.id}`;
    } else {
      const fal = getFal();
      const base = webhookBaseUrl();
      const submitted = await fal.queue.submit(provider.falEndpoint, {
        input: provider.buildInput(videoInput),
        // Server-side completion: fal calls us back even if every tab is
        // closed. Polling still runs as the local-dev/mock fallback.
        ...(base ? { webhookUrl: `${base}/api/fal/webhook` } : {}),
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
    return await toStatus(supabase, updated ?? row);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "The video model rejected the job.";
    await failVideoRow(supabase, row, message);
    revalidatePath("/history");
    return { error: message };
  }
}

/** One poll tick for a single clip. */
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

  const before = row.status;
  const after = await tickVideoRow(supabase, row);
  if (after.status !== before) {
    revalidatePath("/history");
  }
  return toStatus(supabase, after);
}

/** The user's in-flight clips, without touching fal — cheap status read. */
export async function listActiveVideoJobs(): Promise<VideoStatus[]> {
  const { supabase, user } = await requireUser();
  const { data: rows } = await supabase
    .from("video_generations")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true });

  return Promise.all((rows ?? []).map((row) => toStatus(supabase, row)));
}

/**
 * One poll tick across every in-flight clip the user owns. Called by the
 * persistent watcher so completion never depends on a particular panel
 * staying open.
 */
export async function pollActiveVideoJobs(): Promise<VideoStatus[]> {
  const { supabase, user } = await requireUser();

  const { data: rows } = await supabase
    .from("video_generations")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) return [];

  let anyTransition = false;
  const results: VideoStatus[] = [];
  for (const row of rows) {
    const after = await tickVideoRow(supabase, row);
    if (after.status !== row.status) anyTransition = true;
    results.push(await toStatus(supabase, after));
  }

  if (anyTransition) {
    revalidatePath("/history");
  }
  return results;
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
