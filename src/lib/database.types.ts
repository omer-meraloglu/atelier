export type AssetKind = "model" | "product";
export type GenerationStatus = "queued" | "processing" | "succeeded" | "failed";
export type VideoSourceKind = "asset" | "generation";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface AssetRow {
  id: string;
  user_id: string;
  kind: AssetKind;
  storage_path: string;
  label: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface GenerationRow {
  id: string;
  user_id: string;
  model_asset_id: string;
  product_asset_id: string;
  provider_model_id: string;
  status: GenerationStatus;
  result_path: string | null;
  error: string | null;
  params: Json;
  latency_ms: number | null;
  created_at: string;
}

export interface VideoGenerationRow {
  id: string;
  user_id: string;
  source_kind: VideoSourceKind;
  source_asset_id: string | null;
  source_generation_id: string | null;
  provider_model_id: string;
  status: GenerationStatus;
  result_path: string | null;
  poster_path: string | null;
  error: string | null;
  params: Json;
  duration_s: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      assets: {
        Row: AssetRow;
        Insert: Omit<Partial<AssetRow>, "id" | "created_at"> &
          Pick<AssetRow, "user_id" | "kind" | "storage_path">;
        Update: Partial<AssetRow>;
        Relationships: [];
      };
      generations: {
        Row: GenerationRow;
        Insert: Omit<Partial<GenerationRow>, "id" | "created_at"> &
          Pick<
            GenerationRow,
            "user_id" | "model_asset_id" | "product_asset_id" | "provider_model_id"
          >;
        Update: Partial<GenerationRow>;
        Relationships: [];
      };
      video_generations: {
        Row: VideoGenerationRow;
        Insert: Omit<Partial<VideoGenerationRow>, "id" | "created_at"> &
          Pick<VideoGenerationRow, "user_id" | "source_kind" | "provider_model_id">;
        Update: Partial<VideoGenerationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
