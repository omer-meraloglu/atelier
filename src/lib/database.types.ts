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

export type AssetRow = {
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

export type GenerationRow = {
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

export type VideoGenerationRow = {
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

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "expired";

export type BillingCustomerRow = {
  user_id: string;
  provider: string;
  provider_customer_id: string;
  created_at: string;
}

export type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_subscription_id: string | null;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export type CreditLedgerRow = {
  id: string;
  user_id: string;
  delta: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
}

export type BillingEventRow = {
  event_id: string;
  provider: string;
  event_type: string;
  processed_at: string;
}

export type Database = {
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
      billing_customers: {
        Row: BillingCustomerRow;
        Insert: Omit<Partial<BillingCustomerRow>, "created_at"> &
          Pick<BillingCustomerRow, "user_id" | "provider" | "provider_customer_id">;
        Update: Partial<BillingCustomerRow>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Omit<Partial<SubscriptionRow>, "id" | "created_at" | "updated_at"> &
          Pick<SubscriptionRow, "user_id" | "provider" | "plan_id">;
        Update: Partial<SubscriptionRow>;
        Relationships: [];
      };
      credit_ledger: {
        Row: CreditLedgerRow;
        Insert: Omit<Partial<CreditLedgerRow>, "id" | "created_at"> &
          Pick<CreditLedgerRow, "user_id" | "delta" | "reason">;
        Update: Partial<CreditLedgerRow>;
        Relationships: [];
      };
      billing_events: {
        Row: BillingEventRow;
        Insert: Omit<Partial<BillingEventRow>, "processed_at"> &
          Pick<BillingEventRow, "event_id" | "provider" | "event_type">;
        Update: Partial<BillingEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      spend_credits: {
        Args: { p_amount: number; p_reason: string; p_reference: string | null };
        Returns: boolean;
      };
      credit_balance: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
