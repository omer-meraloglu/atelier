import "server-only";

import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { ASSETS_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/storage";

/**
 * Stable signed URLs for grid/result media.
 *
 * Re-signing on every request minted a fresh token per page view, so the
 * browser and the next/image optimizer never got cache hits — every
 * navigation re-downloaded and re-optimized every image. Caching the signed
 * URL per storage path (server-side, TTL safely under the signature's)
 * keeps URLs identical across requests for ~45 minutes.
 *
 * Signing uses the service-role client because unstable_cache cannot read
 * request cookies — but callers only ever pass paths taken from rows the
 * requesting user already fetched under RLS, so the owner-only guarantee
 * is unchanged. Never cache the short-lived URLs handed to providers.
 */

const SIGNED_URL_CACHE_SECONDS = 45 * 60; // signature lives 60min

// Arguments are part of unstable_cache's key, so each path caches on its own.
const getCachedSignedUrl = unstable_cache(
  async (path: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(ASSETS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  },
  ["stable-signed-url"],
  { revalidate: SIGNED_URL_CACHE_SECONDS }
);

export async function stableSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  return getCachedSignedUrl(path);
}

/** Bulk variant; returns a path → URL map (missing entries on failure). */
export async function stableSignedUrls(
  paths: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  const results = await Promise.all(
    unique.map(async (p) => [p, await getCachedSignedUrl(p)] as const)
  );
  for (const [p, url] of results) {
    if (url) map.set(p, url);
  }
  return map;
}
