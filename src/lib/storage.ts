import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export const ASSETS_BUCKET = "assets";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour for grid rendering
export const SIGNED_URL_TTL_PROVIDER = 60 * 15; // short-lived URLs handed to fal

type AnySupabase = SupabaseClient<Database>;

/** Bulk-sign storage paths; returns a path → URL map (missing on failure). */
export async function signPaths(
  supabase: AnySupabase,
  paths: string[],
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrls(unique, expiresIn);

  if (error || !data) return map;

  for (const entry of data) {
    if (entry.signedUrl && entry.path) {
      map.set(entry.path, entry.signedUrl);
    }
  }
  return map;
}

export async function signPath(
  supabase: AnySupabase,
  path: string,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}
