"use client";

import { useMemo, useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetKind } from "@/lib/database.types";
import { AssetCard, type AssetWithUrl } from "./asset-card";
import { UploadZone, type PendingUpload } from "./upload-zone";

export function LibraryView({
  assets,
  initialKind,
  userId,
}: {
  assets: AssetWithUrl[];
  initialKind: AssetKind;
  userId: string;
}) {
  // Tab state lives client-side so switching is instant; the URL is kept
  // in sync for deep links without a server round-trip.
  const [kind, setKind] = useState<AssetKind>(initialKind);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  const visible = useMemo(
    () => assets.filter((a) => a.kind === kind),
    [assets, kind]
  );

  function switchKind(next: string) {
    const value = next === "product" ? "product" : "model";
    setKind(value);
    window.history.replaceState(null, "", `/library?kind=${value}`);
  }

  const empty = visible.length === 0 && pending.length === 0;

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
          {visible.length} {visible.length === 1 ? "piece" : "pieces"}
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
          {visible.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
