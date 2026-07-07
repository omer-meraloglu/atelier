export type TryOnCategory = "tops" | "bottoms" | "full" | "auto";

export interface TryOnInput {
  modelImageUrl: string;
  productImageUrl: string;
  category?: TryOnCategory;
  /** Short garment description; required by some providers (e.g. IDM-VTON). */
  garmentDescription?: string;
}

export interface TryOnResult {
  imageUrl: string;
  raw: unknown;
}

export interface TryOnProvider {
  /** Stable key stored in generations.provider_model_id. */
  id: string;
  /** Shown in the selector. */
  label: string;
  /** fal model endpoint id. */
  falEndpoint: string;
  /** One-line quality/latency hint for the UI. */
  note: string;
  buildInput(input: TryOnInput): Record<string, unknown>;
  parseOutput(raw: unknown): TryOnResult;
}

export type VideoAspect = "9:16" | "16:9" | "1:1";
export type VideoMotion = "low" | "medium" | "high";

export interface VideoInput {
  imageUrl: string;
  prompt?: string;
  durationSeconds?: number;
  aspectRatio?: VideoAspect;
  motion?: VideoMotion;
}

export interface VideoResult {
  videoUrl: string;
  posterUrl?: string;
  raw: unknown;
}

export interface VideoProvider {
  /** Stable key stored in video_generations.provider_model_id. */
  id: string;
  label: string;
  falEndpoint: string;
  note: string;
  /** Which controls the Animate panel should expose. */
  supports: {
    duration: boolean;
    aspect: boolean;
    prompt: boolean;
    motion: boolean;
  };
  /** Duration choices offered in the UI, in seconds. */
  durationOptions: number[];
  buildInput(input: VideoInput): Record<string, unknown>;
  parseOutput(raw: unknown): VideoResult;
}
