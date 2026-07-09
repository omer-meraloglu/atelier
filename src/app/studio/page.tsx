import type { Metadata } from "next";

import { SiteNav } from "@/components/site-nav";
import { StudioClient } from "@/components/studio/studio-client";
import type { StudioPhase } from "@/components/studio/result-stage";
import { requireUser } from "@/lib/auth";
import { listTryOnProviders } from "@/lib/providers/tryon";
import { signPaths } from "@/lib/storage";

export const metadata: Metadata = { title: "Studio" };

// fal renders can take up to two minutes; keep the action alive on Vercel.
export const maxDuration = 150;

export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;

  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = assets ?? [];
  const urls = await signPaths(
    supabase,
    rows.map((a) => a.storage_path)
  );
  const withUrls = rows.map((a) => ({
    ...a,
    url: urls.get(a.storage_path) ?? null,
  }));

  const models = withUrls.filter((a) => a.kind === "model");
  const products = withUrls.filter((a) => a.kind === "product");

  const modelParam = typeof params.model === "string" ? params.model : null;
  const productParam =
    typeof params.product === "string" ? params.product : null;
  const generationParam =
    typeof params.generation === "string" ? params.generation : null;

  let initialModel = models.find((a) => a.id === modelParam) ?? null;
  let initialProduct = products.find((a) => a.id === productParam) ?? null;
  let initialState: StudioPhase | undefined;

  // Reopen a past render from History.
  if (generationParam) {
    const { data: generation } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationParam)
      .eq("user_id", user.id)
      .single();

    if (generation) {
      initialModel =
        models.find((a) => a.id === generation.model_asset_id) ?? initialModel;
      initialProduct =
        products.find((a) => a.id === generation.product_asset_id) ??
        initialProduct;

      if (generation.status === "succeeded" && generation.result_path) {
        const resultUrls = await signPaths(supabase, [generation.result_path]);
        const resultUrl = resultUrls.get(generation.result_path);
        if (resultUrl) {
          initialState = {
            phase: "done",
            generationId: generation.id,
            resultUrl,
            providerId: generation.provider_model_id,
            latencyMs: generation.latency_ms ?? undefined,
          };
        }
      }
    }
  }

  return (
    <>
      <SiteNav userEmail={user.email} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-12 sm:px-8">
        <header className="mb-10">
          <p className="text-label text-muted-foreground">The fitting room</p>
          <h1 className="font-display mt-3 text-4xl tracking-tight sm:text-5xl">
            Studio
          </h1>
        </header>
        <StudioClient
          userId={user.id}
          models={models}
          products={products}
          providers={listTryOnProviders()}
          initialModel={initialModel}
          initialProduct={initialProduct}
          initialState={initialState}
        />
      </main>
    </>
  );
}
