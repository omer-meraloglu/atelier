"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getTryOnProvider } from "@/lib/providers/tryon";
import { runTryOn } from "@/lib/run-tryon";
import {
  ASSETS_BUCKET,
  SIGNED_URL_TTL_PROVIDER,
  signPath,
} from "@/lib/storage";

const generateSchema = z.object({
  modelAssetId: z.string().uuid(),
  productAssetId: z.string().uuid(),
  providerId: z.string().min(1).max(100),
  category: z.enum(["tops", "bottoms", "full", "auto"]).default("auto"),
});

export interface GenerateResult {
  id?: string;
  status: "succeeded" | "failed";
  resultUrl?: string;
  latencyMs?: number;
  providerId: string;
  error?: string;
}

/** Max renders a user may start per minute — a guard, not a quota system. */
const TRYON_PER_MINUTE = 6;

export async function generateTryOn(
  input: z.infer<typeof generateSchema>
): Promise<GenerateResult> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "failed",
      providerId: String(input?.providerId ?? "unknown"),
      error: "Invalid request.",
    };
  }
  const { modelAssetId, productAssetId, providerId, category } = parsed.data;

  const { supabase, user } = await requireUser();

  const provider = getTryOnProvider(providerId);
  if (!provider) {
    return { status: "failed", providerId, error: "Unknown AI model." };
  }

  // Concurrency/rate guard: these calls cost real money.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneMinuteAgo);
  if ((count ?? 0) >= TRYON_PER_MINUTE) {
    return {
      status: "failed",
      providerId,
      error: "Too many renders at once — give it a minute.",
    };
  }

  // Both assets must exist, belong to the user (RLS), and be the right kind.
  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .in("id", [modelAssetId, productAssetId]);

  const modelAsset = assets?.find(
    (a) => a.id === modelAssetId && a.kind === "model"
  );
  const productAsset = assets?.find(
    (a) => a.id === productAssetId && a.kind === "product"
  );
  if (!modelAsset || !productAsset) {
    return {
      status: "failed",
      providerId,
      error: "Pick one model and one product from your library.",
    };
  }

  const [modelUrl, productUrl] = await Promise.all([
    signPath(supabase, modelAsset.storage_path, SIGNED_URL_TTL_PROVIDER),
    signPath(supabase, productAsset.storage_path, SIGNED_URL_TTL_PROVIDER),
  ]);
  if (!modelUrl || !productUrl) {
    return {
      status: "failed",
      providerId,
      error: "Could not read the source images.",
    };
  }

  const { data: row, error: insertError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      model_asset_id: modelAsset.id,
      product_asset_id: productAsset.id,
      provider_model_id: provider.id,
      status: "processing",
      params: { category },
    })
    .select()
    .single();

  if (insertError || !row) {
    return {
      status: "failed",
      providerId,
      error: "Could not start the render.",
    };
  }

  async function fail(message: string): Promise<GenerateResult> {
    await supabase
      .from("generations")
      .update({ status: "failed", error: message })
      .eq("id", row!.id)
      .eq("user_id", user.id);
    revalidatePath("/history");
    return { id: row!.id, status: "failed", providerId, error: message };
  }

  try {
    const { result, latencyMs } = await runTryOn(provider, {
      modelImageUrl: modelUrl,
      productImageUrl: productUrl,
      category,
      garmentDescription: productAsset.label,
    });

    // Persist the render into our own private bucket — provider URLs expire.
    const response = await fetch(result.imageUrl);
    if (!response.ok) {
      return await fail("The provider returned an unreadable image.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const resultPath = `${user.id}/generations/${row.id}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(ASSETS_BUCKET)
      .upload(resultPath, bytes, { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      return await fail("Could not store the render.");
    }

    await supabase
      .from("generations")
      .update({
        status: "succeeded",
        result_path: resultPath,
        latency_ms: latencyMs,
        params: { category, raw: JSON.parse(JSON.stringify(result.raw)) },
      })
      .eq("id", row.id)
      .eq("user_id", user.id);

    const resultUrl = await signPath(supabase, resultPath);
    revalidatePath("/history");

    return {
      id: row.id,
      status: "succeeded",
      resultUrl: resultUrl ?? undefined,
      latencyMs,
      providerId,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "The provider failed to render.";
    return await fail(message);
  }
}

/** Saves a succeeded render back into the library as a new model asset. */
export async function saveGenerationToLibrary(input: { generationId: string }) {
  const parsed = z
    .object({ generationId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid render." };

  const { supabase, user } = await requireUser();

  const { data: generation } = await supabase
    .from("generations")
    .select("*")
    .eq("id", parsed.data.generationId)
    .eq("user_id", user.id)
    .single();

  if (!generation || generation.status !== "succeeded" || !generation.result_path) {
    return { error: "This render has no image to save." };
  }

  const { data: sourceAssets } = await supabase
    .from("assets")
    .select("id, label, width, height")
    .in("id", [generation.model_asset_id, generation.product_asset_id]);

  const model =
    sourceAssets?.find((a) => a.id === generation.model_asset_id) ?? null;
  const product =
    sourceAssets?.find((a) => a.id === generation.product_asset_id) ?? null;

  // Copy the render to a fresh asset object so deleting one never breaks the other.
  const newPath = `${user.id}/models/${crypto.randomUUID()}.jpg`;
  const { error: copyError } = await supabase.storage
    .from(ASSETS_BUCKET)
    .copy(generation.result_path, newPath);
  if (copyError) {
    return { error: "Could not copy the render." };
  }

  const label =
    `Look — ${model?.label ?? "Model"} × ${product?.label ?? "Product"}`.slice(
      0,
      120
    );

  const { error: insertError } = await supabase.from("assets").insert({
    user_id: user.id,
    kind: "model",
    storage_path: newPath,
    label,
    width: model?.width ?? null,
    height: model?.height ?? null,
  });
  if (insertError) {
    return { error: "Could not save to the library." };
  }

  revalidatePath("/library");
  return { label };
}
