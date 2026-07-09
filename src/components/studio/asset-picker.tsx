"use client";

import Image from "next/image";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AssetWithUrl } from "@/components/library/asset-card";
import type { AssetKind } from "@/lib/database.types";

export function AssetPicker({
  open,
  onOpenChange,
  kind,
  assets,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AssetKind;
  assets: AssetWithUrl[];
  onPick: (asset: AssetWithUrl) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b hairline">
          <SheetTitle className="font-display text-2xl font-normal tracking-tight">
            {kind === "model" ? "Choose a model" : "Choose a product"}
          </SheetTitle>
          <SheetDescription>
            {assets.length === 0
              ? "Your library is empty — upload from the slot instead."
              : "From your library."}
          </SheetDescription>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => {
                onPick(asset);
                onOpenChange(false);
              }}
              className="group relative overflow-hidden border hairline-faint outline-none transition-all duration-300 focus-visible:ring-1 focus-visible:ring-ring hover:border-ink"
            >
              {asset.url ? (
                <Image
                  src={asset.url}
                  alt={asset.label}
                  width={asset.width ?? 400}
                  height={asset.height ?? 533}
                  sizes="200px"
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-xs text-muted-foreground">
                  No preview
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-2 py-1.5 text-left text-xs text-bone opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {asset.label}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
