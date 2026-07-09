import "server-only";

import { getFal } from "@/lib/fal";
import type { TryOnInput, TryOnProvider, TryOnResult } from "@/lib/providers/types";

const TRYON_TIMEOUT_MS = 120_000;

/**
 * Executes one try-on render against a provider and normalizes the result.
 * Throws on failure; the caller owns row-state bookkeeping.
 */
export async function runTryOn(
  provider: TryOnProvider,
  input: TryOnInput
): Promise<{ result: TryOnResult; latencyMs: number }> {
  const startedAt = Date.now();

  // Dev stub: no external call, echoes the model image back.
  if (provider.falEndpoint === "mock") {
    await new Promise((r) => setTimeout(r, 3000));
    return {
      result: {
        imageUrl: input.modelImageUrl,
        raw: { mock: true },
      },
      latencyMs: Date.now() - startedAt,
    };
  }

  const fal = getFal();

  const subscription = fal.subscribe(provider.falEndpoint, {
    input: provider.buildInput(input),
    logs: false,
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Provider timed out after 120s")),
      TRYON_TIMEOUT_MS
    )
  );

  const { data } = await Promise.race([subscription, timeout]);
  const result = provider.parseOutput(data);

  return { result, latencyMs: Date.now() - startedAt };
}
