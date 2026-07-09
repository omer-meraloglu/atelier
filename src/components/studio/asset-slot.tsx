"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { registerAsset } from "@/app/library/actions";
import { Button } from "@/components/ui/button";
import type { AssetWithUrl } from "@/components/library/asset-card";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_IMAGE_TYPES,
  ASSETS_BUCKET,
  MAX_IMAGE_BYTES,
  extensionForMime,
} from "@/lib/storage";
import type { AssetKind } from "@/lib/database.types";
import { AssetPicker } from "./asset-picker";

function readImageSize(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function AssetSlot({
  kind,
  userId,
  assets,
  selected,
  onSelect,
}: {
  kind: AssetKind;
  userId: string;
  assets: AssetWithUrl[];
  selected: AssetWithUrl | null;
  onSelect: (asset: AssetWithUrl | null) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
      )
    ) {
      toast.error("Only JPG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Over the 10 MB limit.");
      return;
    }

    setUploading(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const supabase = createClient();
      const path = `${userId}/${kind}s/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
      const { error: uploadError } = await supabase.storage
        .from(ASSETS_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const size = await readImageSize(file);
      const label = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
      const result = await registerAsset({
        kind,
        storagePath: path,
        label,
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
      if (result.error || !result.asset) {
        throw new Error(result.error ?? "Upload failed.");
      }

      // The blob we just uploaded doubles as an instant preview.
      onSelect({ ...result.asset, url: objectUrl });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  const title = kind === "model" ? "Model" : "Product";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-label text-muted-foreground">{title}</h2>
        {selected && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 text-label text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            <RefreshCcw className="size-3" aria-hidden />
            Change
          </button>
        )}
      </div>

      {selected ? (
        <figure className="relative overflow-hidden border hairline bg-card">
          {selected.url ? (
            <Image
              src={selected.url}
              alt={selected.label}
              width={selected.width ?? 600}
              height={selected.height ?? 800}
              sizes="(max-width: 1024px) 50vw, 25vw"
              className="aspect-[3/4] w-full object-cover"
              unoptimized={selected.url.startsWith("blob:")}
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center text-xs text-muted-foreground">
              No preview
            </div>
          )}
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 to-transparent px-3 pb-2 pt-8">
            <p className="truncate text-xs text-bone">{selected.label}</p>
          </figcaption>
        </figure>
      ) : (
        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 border border-dashed hairline p-6 text-center">
          <ImagePlus
            className="size-5 text-muted-foreground"
            aria-hidden
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {kind === "model"
              ? "The person who wears it."
              : "The piece to try on."}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              disabled={uploading}
            >
              From library
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload new"}
            </Button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <AssetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        kind={kind}
        assets={assets}
        onPick={onSelect}
      />
    </div>
  );
}
