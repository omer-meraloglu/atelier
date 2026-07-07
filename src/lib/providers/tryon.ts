import { z } from "zod";

import type { TryOnInput, TryOnProvider, TryOnResult } from "./types";

/**
 * Try-on provider registry. Each adapter maps our normalized TryOnInput to
 * the provider's schema and parses its output back to a single image URL.
 * Endpoint ids and schemas verified against the fal.ai docs (July 2026).
 */

const falImage = z.object({ url: z.string().url() });

// fal-ai/fashn/tryon/v1.6 → { images: [{ url }] }
const fashnOutput = z.object({ images: z.array(falImage).min(1) });

// fal-ai/idm-vton → { image: { url } }
// fal-ai/kling/v1-5/kolors-virtual-try-on → { image: { url } }
const singleImageOutput = z.object({ image: falImage });

const fashn: TryOnProvider = {
  id: "fashn-v1.6",
  label: "FASHN v1.6",
  falEndpoint: "fal-ai/fashn/tryon/v1.6",
  note: "Strong garment detail, flat-lay friendly · ~15s",
  buildInput(input: TryOnInput) {
    const category =
      input.category === "full"
        ? "one-pieces"
        : (input.category ?? "auto");
    return {
      model_image: input.modelImageUrl,
      garment_image: input.productImageUrl,
      category,
      mode: "balanced",
      output_format: "jpeg",
    };
  },
  parseOutput(raw: unknown): TryOnResult {
    const parsed = fashnOutput.parse(raw);
    return { imageUrl: parsed.images[0].url, raw };
  },
};

const idmVton: TryOnProvider = {
  id: "idm-vton",
  label: "IDM-VTON",
  falEndpoint: "fal-ai/idm-vton",
  note: "Research favourite, faithful drape · ~30s",
  buildInput(input: TryOnInput) {
    return {
      human_image_url: input.modelImageUrl,
      garment_image_url: input.productImageUrl,
      description: input.garmentDescription || "a fashion garment",
    };
  },
  parseOutput(raw: unknown): TryOnResult {
    const parsed = singleImageOutput.parse(raw);
    return { imageUrl: parsed.image.url, raw };
  },
};

const kolors: TryOnProvider = {
  id: "kolors-tryon",
  label: "Kolors (Kling)",
  falEndpoint: "fal-ai/kling/v1-5/kolors-virtual-try-on",
  note: "Kwai's try-on, natural lighting · ~20s",
  buildInput(input: TryOnInput) {
    return {
      human_image_url: input.modelImageUrl,
      garment_image_url: input.productImageUrl,
    };
  },
  parseOutput(raw: unknown): TryOnResult {
    const parsed = singleImageOutput.parse(raw);
    return { imageUrl: parsed.image.url, raw };
  },
};

export const tryOnProviders: TryOnProvider[] = [fashn, idmVton, kolors];

export function getTryOnProvider(id: string): TryOnProvider | undefined {
  return tryOnProviders.find((p) => p.id === id);
}

/** Serializable subset for client components (no functions). */
export interface TryOnProviderInfo {
  id: string;
  label: string;
  note: string;
}

export function listTryOnProviders(): TryOnProviderInfo[] {
  return tryOnProviders.map(({ id, label, note }) => ({ id, label, note }));
}
