import type { Metadata } from "next";

import {
  HistoryList,
  type HistoryItem,
} from "@/components/history/history-list";
import { SiteNav } from "@/components/site-nav";
import { requireUser } from "@/lib/auth";
import { listTryOnProviders } from "@/lib/providers/tryon";
import { listVideoProviders } from "@/lib/providers/video";
import { signPaths } from "@/lib/storage";

export const metadata: Metadata = { title: "History" };

const PAGE_SIZE = 60;

export default async function HistoryPage() {
  const { supabase, user } = await requireUser();

  const [{ data: generations }, { data: videos }, { data: assets }] =
    await Promise.all([
      supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase
        .from("video_generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE),
      supabase.from("assets").select("id, label, storage_path"),
    ]);

  const assetById = new Map(
    (assets ?? []).map((a) => [a.id, a] as const)
  );

  const providerLabels = new Map<string, string>();
  for (const p of listTryOnProviders()) providerLabels.set(p.id, p.label);
  for (const p of listVideoProviders()) providerLabels.set(p.id, p.label);

  // Sign everything the grid needs in one round trip.
  const pathsToSign: string[] = [];
  for (const g of generations ?? []) {
    if (g.result_path) pathsToSign.push(g.result_path);
    else {
      const model = assetById.get(g.model_asset_id);
      if (model) pathsToSign.push(model.storage_path);
    }
  }
  for (const v of videos ?? []) {
    if (v.poster_path) pathsToSign.push(v.poster_path);
    if (v.result_path) pathsToSign.push(v.result_path);
    if (v.source_asset_id) {
      const src = assetById.get(v.source_asset_id);
      if (src) pathsToSign.push(src.storage_path);
    }
  }
  const urls = await signPaths(supabase, pathsToSign);

  const items: HistoryItem[] = [];

  for (const g of generations ?? []) {
    const model = assetById.get(g.model_asset_id);
    const product = assetById.get(g.product_asset_id);
    const fallback = model ? urls.get(model.storage_path) : undefined;
    items.push({
      type: "image",
      id: g.id,
      createdAt: g.created_at,
      status: g.status,
      providerLabel:
        providerLabels.get(g.provider_model_id) ?? g.provider_model_id,
      latencyMs: g.latency_ms,
      imageUrl:
        (g.result_path ? urls.get(g.result_path) : undefined) ??
        fallback ??
        null,
      videoUrl: null,
      title: `${model?.label ?? "Model"} × ${product?.label ?? "Product"}`,
      error: g.error,
      href: `/studio?generation=${g.id}`,
    });
  }

  for (const v of videos ?? []) {
    const source = v.source_asset_id
      ? assetById.get(v.source_asset_id)
      : undefined;
    const sourceUrl = source ? urls.get(source.storage_path) : undefined;
    items.push({
      type: "video",
      id: v.id,
      createdAt: v.created_at,
      status: v.status,
      providerLabel:
        providerLabels.get(v.provider_model_id) ?? v.provider_model_id,
      latencyMs: v.latency_ms,
      imageUrl:
        (v.poster_path ? urls.get(v.poster_path) : undefined) ??
        sourceUrl ??
        null,
      videoUrl: (v.result_path ? urls.get(v.result_path) : undefined) ?? null,
      title: source?.label ?? "A generated look",
      error: v.error,
      href: `/studio?video=${v.id}`,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <SiteNav userEmail={user.email} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-12 sm:px-8">
        <header className="mb-10">
          <p className="text-label text-muted-foreground">Every take</p>
          <h1 className="font-display mt-3 text-4xl tracking-tight sm:text-5xl">
            History
          </h1>
        </header>
        <HistoryList items={items} />
      </main>
    </>
  );
}
