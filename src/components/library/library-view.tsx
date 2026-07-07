"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetKind } from "@/lib/database.types";
import { AssetCard, type AssetWithUrl } from "./asset-card";
import { UploadZone, type PendingUpload } from "./upload-zone";

export function LibraryView({
  assets,
  kind,
  userId,
}: {
  assets: AssetWithUrl[];
  kind: AssetKind;
  userId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<PendingUpload[]>([]);

  function switchKind(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("kind", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const empty = assets.length === 0 && pending.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs value={kind} onValueChange={switchKind}>
          <TabsList aria-label="Asset type">
            <TabsTrigger value="model">Models</TabsTrigger>
            <TabsTrigger value="product">Products</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-label text-muted-foreground">
          {assets.length} {assets.length === 1 ? "piece" : "pieces"}
        </p>
      </div>

      <UploadZone kind={kind} userId={userId} onPendingChange={setPending} />

      {empty ? (
        <div className="flex flex-col items-center border hairline-faint px-6 py-24 text-center">
          <p className="font-display text-3xl tracking-tight">
            {kind === "model" ? "No models yet" : "No products yet"}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {kind === "model"
              ? "Upload photographs of the people who will wear your pieces — full-length, clean background, good light."
              : "Upload garments and accessories — on-model shots or flat-lays both work."}
          </p>
        </div>
      ) : (
        <div className="columns-2 gap-5 md:columns-3 xl:columns-4">
          {pending.map((p) => (
            <figure
              key={p.tempId}
              className="relative mb-5 break-inside-avoid overflow-hidden border hairline-faint"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img
                src={p.objectUrl}
                alt={`Uploading ${p.label}`}
                className="w-full animate-pulse object-cover opacity-60"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-ink/70 p-3">
                <p className="text-label text-bone">Uploading…</p>
              </figcaption>
            </figure>
          ))}
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
