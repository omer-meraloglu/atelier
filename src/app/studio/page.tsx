import type { Metadata } from "next";

import { SiteNav } from "@/components/site-nav";
import { StudioClient } from "@/components/studio/studio-client";
import type { StudioPhase } from "@/components/studio/result-stage";
import type { AnimateSource } from "@/components/studio/animate-panel";
import type { VideoStatus } from "@/app/studio/video-actions";
import { requireUser } from "@/lib/auth";
import { getCreditState } from "@/lib/billing/credits";
import { listTryOnProviders } from "@/lib/providers/tryon";
import { listVideoProviders } from "@/lib/providers/video";
import { stableSignedUrls } from "@/lib/signed-urls";

export const metadata: Metadata = { title: "Studio" };

// fal renders can take up to two minutes; keep the action alive on Vercel.
export const maxDuration = 150;

export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const creditState = await getCreditState(supabase, user.id);

  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = assets ?? [];
  const urls = await stableSignedUrls(rows.map((a) => a.storage_path)
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
  const animateParam =
    typeof params.animate === "string" ? params.animate : null;
  const videoParam = typeof params.video === "string" ? params.video : null;

  let initialModel = models.find((a) => a.id === modelParam) ?? null;
  let initialProduct = products.find((a) => a.id === productParam) ?? null;
  let initialState: StudioPhase | undefined;
  let initialAnimate: AnimateSource | undefined;
  let initialVideoJob: VideoStatus | undefined;

  // Animate a library asset directly (?animate=<assetId>).
  if (animateParam) {
    const asset = withUrls.find((a) => a.id === animateParam);
    if (asset) {
      initialAnimate = {
        kind: "asset",
        id: asset.id,
        imageUrl: asset.url,
        label: asset.label,
      };
    }
  }

  // Reopen a clip from History (?video=<id>).
  if (videoParam) {
    const { data: video } = await supabase
      .from("video_generations")
      .select("*")
      .eq("id", videoParam)
      .eq("user_id", user.id)
      .single();

    if (video) {
      const paths = [video.result_path, video.poster_path].filter(
        (p): p is string => Boolean(p)
      );
      const videoUrls = await stableSignedUrls(paths);
      initialVideoJob = {
        id: video.id,
        status: video.status,
        providerId: video.provider_model_id,
        resultUrl: video.result_path
          ? videoUrls.get(video.result_path)
          : undefined,
        posterUrl: video.poster_path
          ? videoUrls.get(video.poster_path)
          : undefined,
        latencyMs: video.latency_ms ?? undefined,
        error: video.error ?? undefined,
      };

      // Resolve its source still for the panel preview.
      const sourceAsset = video.source_asset_id
        ? withUrls.find((a) => a.id === video.source_asset_id)
        : null;
      if (sourceAsset) {
        initialAnimate = {
          kind: "asset",
          id: sourceAsset.id,
          imageUrl: sourceAsset.url,
          label: sourceAsset.label,
        };
      } else if (video.source_generation_id) {
        const { data: sourceGen } = await supabase
          .from("generations")
          .select("result_path")
          .eq("id", video.source_generation_id)
          .eq("user_id", user.id)
          .single();
        if (sourceGen?.result_path) {
          const genUrls = await stableSignedUrls([sourceGen.result_path]);
          initialAnimate = {
            kind: "generation",
            id: video.source_generation_id,
            imageUrl: genUrls.get(sourceGen.result_path) ?? null,
            label: "a generated look",
          };
        }
      }
    }
  }

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
        const resultUrls = await stableSignedUrls([generation.result_path]);
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
      <SiteNav userEmail={user.email} credits={creditState.balance} />
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
          videoProviders={listVideoProviders()}
          initialModel={initialModel}
          initialProduct={initialProduct}
          initialState={initialState}
          initialAnimate={initialAnimate}
          initialVideoJob={initialVideoJob}
          videoAllowed={creditState.videoEnabled}
        />
      </main>
    </>
  );
}
