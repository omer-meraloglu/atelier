import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

import { refundSpentCredits } from "@/lib/billing/credits";
import type { Database, VideoGenerationRow } from "@/lib/database.types";
import { getFal } from "@/lib/fal";
import { getVideoProvider } from "@/lib/providers/video";
import { ASSETS_BUCKET } from "@/lib/storage";

/**
 * Client-agnostic video job lifecycle. Works with the user-scoped client
 * (server actions) or the service-role client (webhook route) — every write
 * still pins user_id from the row itself.
 */

type Client = SupabaseClient<Database>;

export const VIDEO_STUCK_AFTER_MS = 15 * 60 * 1000;
export const MOCK_RENDER_MS = 8_000;

export async function failVideoRow(
  supabase: Client,
  row: VideoGenerationRow,
  message: string
): Promise<VideoGenerationRow> {
  const { data } = await supabase
    .from("video_generations")
    .update({ status: "failed", error: message })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .select()
    .single();

  // Give the credits back if this clip had spent any — idempotent, so it
  // doesn't matter which of poll/watcher/webhook failed the row first.
  await refundSpentCredits(row.user_id, "video_render", row.id);

  return data ?? { ...row, status: "failed", error: message };
}

export async function storeAndSucceedVideoRow(
  supabase: Client,
  row: VideoGenerationRow,
  videoBytes: Uint8Array
): Promise<VideoGenerationRow> {
  const resultPath = `${row.user_id}/videos/${row.id}.mp4`;

  const { error: uploadError } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(resultPath, videoBytes, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (uploadError) {
    return failVideoRow(supabase, row, "Could not store the clip.");
  }

  const params = (row.params ?? {}) as Record<string, unknown>;
  const requestedDuration =
    typeof params.durationSeconds === "number" ? params.durationSeconds : null;
  const ageMs = Date.now() - new Date(row.created_at).getTime();

  const { data } = await supabase
    .from("video_generations")
    .update({
      status: "succeeded",
      result_path: resultPath,
      latency_ms: ageMs,
      duration_s: requestedDuration,
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .select()
    .single();

  return (
    data ?? { ...row, status: "succeeded", result_path: resultPath }
  );
}

async function downloadVideo(url: string): Promise<Uint8Array | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * One poll tick for a single job. Terminal rows pass through untouched;
 * active rows are checked against fal (or the mock clock), stored and
 * finalized when done. Always leaves the row in a truthful state.
 */
export async function tickVideoRow(
  supabase: Client,
  row: VideoGenerationRow
): Promise<VideoGenerationRow> {
  if (row.status === "succeeded" || row.status === "failed") {
    return row;
  }

  const provider = getVideoProvider(row.provider_model_id);
  const params = (row.params ?? {}) as Record<string, unknown>;
  const requestId =
    typeof params.requestId === "string" ? params.requestId : null;

  if (!provider || !requestId) {
    return failVideoRow(supabase, row, "The job reference was lost.");
  }

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > VIDEO_STUCK_AFTER_MS) {
    return failVideoRow(
      supabase,
      row,
      "The render took too long and was abandoned."
    );
  }

  try {
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
        const videoUrl = provider.parseOutput(data).videoUrl;
        videoBytes = await downloadVideo(videoUrl);
        if (!videoBytes) {
          return failVideoRow(
            supabase,
            row,
            "The provider returned an unreadable video."
          );
        }
      } else {
        inProgress = status.status === "IN_PROGRESS";
      }
    }

    if (!videoBytes) {
      // Still cooking — surface honest queued → processing transitions.
      if (inProgress && row.status === "queued") {
        const { data } = await supabase
          .from("video_generations")
          .update({ status: "processing" })
          .eq("id", row.id)
          .eq("user_id", row.user_id)
          .select()
          .single();
        return data ?? { ...row, status: "processing" };
      }
      return row;
    }

    return await storeAndSucceedVideoRow(supabase, row, videoBytes);
  } catch (err) {
    return failVideoRow(
      supabase,
      row,
      err instanceof Error ? err.message : "Polling the render failed."
    );
  }
}
