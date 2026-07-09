import { z } from "zod";

import type { VideoInput, VideoProvider, VideoResult } from "./types";

/**
 * Image-to-video provider registry. Same adapter pattern as try-on.
 * Endpoint ids and schemas verified against the fal.ai docs (July 2026).
 */

const falVideoOutput = z.object({
  video: z.object({ url: z.string().url() }),
});

const MOTION_HINTS: Record<string, string> = {
  low: "Subtle, restrained movement; the camera holds nearly still.",
  medium: "Graceful, deliberate movement, like a slow runway turn.",
  high: "Dynamic, expressive movement with a confident camera drift.",
};

function motionPrompt(input: VideoInput): string {
  const base =
    input.prompt?.trim() ||
    "A fashion model poses in a studio; fabric and hair move naturally.";
  const hint = input.motion ? MOTION_HINTS[input.motion] : undefined;
  return hint ? `${base} ${hint}` : base;
}

const klingStandard: VideoProvider = {
  id: "kling-2.1-standard",
  label: "Kling 2.1 Standard",
  falEndpoint: "fal-ai/kling-video/v2.1/standard/image-to-video",
  note: "Controllable, filmic motion · ~3–5 min",
  supports: { duration: true, aspect: false, prompt: true, motion: true },
  durationOptions: [5, 10],
  buildInput(input: VideoInput) {
    return {
      image_url: input.imageUrl,
      prompt: motionPrompt(input),
      duration: input.durationSeconds === 10 ? "10" : "5",
      negative_prompt: "blur, distort, warped fabric, extra limbs, low quality",
      cfg_scale: 0.5,
    };
  },
  parseOutput(raw: unknown): VideoResult {
    const parsed = falVideoOutput.parse(raw);
    return { videoUrl: parsed.video.url, raw };
  },
};

const hailuo: VideoProvider = {
  id: "hailuo-02-standard",
  label: "Hailuo 02 Standard",
  falEndpoint: "fal-ai/minimax/hailuo-02/standard/image-to-video",
  note: "Fast, lively motion, 768p · ~2–4 min",
  supports: { duration: true, aspect: false, prompt: true, motion: true },
  durationOptions: [6, 10],
  buildInput(input: VideoInput) {
    return {
      image_url: input.imageUrl,
      prompt: motionPrompt(input),
      duration: input.durationSeconds === 10 ? "10" : "6",
      resolution: "768P",
      prompt_optimizer: true,
    };
  },
  parseOutput(raw: unknown): VideoResult {
    const parsed = falVideoOutput.parse(raw);
    return { videoUrl: parsed.video.url, raw };
  },
};

/**
 * Dev-only stub mirroring the try-on mock: lets the whole queue/poll/store
 * lifecycle run locally without a FAL_KEY. The runner short-circuits on
 * falEndpoint === "mock" and serves a bundled sample clip.
 */
const mockVideo: VideoProvider = {
  id: "mock-video",
  label: "Mock (dev only)",
  falEndpoint: "mock",
  note: "Local stub, bundled sample clip · 8s",
  supports: { duration: true, aspect: false, prompt: true, motion: true },
  durationOptions: [5, 10],
  buildInput(input: VideoInput) {
    return { image_url: input.imageUrl };
  },
  parseOutput(raw: unknown): VideoResult {
    return { videoUrl: "mock://clip", raw };
  },
};

export const videoProviders: VideoProvider[] = [
  klingStandard,
  hailuo,
  ...(process.env.ENABLE_MOCK_PROVIDER === "1" ? [mockVideo] : []),
];

export function getVideoProvider(id: string): VideoProvider | undefined {
  return videoProviders.find((p) => p.id === id);
}

/** Serializable subset for client components (no functions). */
export interface VideoProviderInfo {
  id: string;
  label: string;
  note: string;
  supports: VideoProvider["supports"];
  durationOptions: number[];
}

export function listVideoProviders(): VideoProviderInfo[] {
  return videoProviders.map(
    ({ id, label, note, supports, durationOptions }) => ({
      id,
      label,
      note,
      supports,
      durationOptions,
    })
  );
}
