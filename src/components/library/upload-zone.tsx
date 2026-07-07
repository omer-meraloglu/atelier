"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { registerAsset } from "@/app/library/actions";
import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_IMAGE_TYPES,
  ASSETS_BUCKET,
  MAX_IMAGE_BYTES,
  extensionForMime,
} from "@/lib/storage";
import type { AssetKind } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export interface PendingUpload {
  tempId: string;
  objectUrl: string;
  label: string;
}

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

export function UploadZone({
  kind,
  userId,
  onPendingChange,
}: {
  kind: AssetKind;
  userId: string;
  onPendingChange: (pending: PendingUpload[]) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const pendingRef = useRef<PendingUpload[]>([]);

  const updatePending = useCallback(
    (updater: (prev: PendingUpload[]) => PendingUpload[]) => {
      pendingRef.current = updater(pendingRef.current);
      onPendingChange([...pendingRef.current]);
    },
    [onPendingChange]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files];
      if (list.length === 0) return;

      const supabase = createClient();

      await Promise.all(
        list.map(async (file) => {
          if (
            !ALLOWED_IMAGE_TYPES.includes(
              file.type as (typeof ALLOWED_IMAGE_TYPES)[number]
            )
          ) {
            toast.error(`${file.name}: only JPG, PNG or WebP.`);
            return;
          }
          if (file.size > MAX_IMAGE_BYTES) {
            toast.error(`${file.name}: over the 10 MB limit.`);
            return;
          }

          const tempId = crypto.randomUUID();
          const objectUrl = URL.createObjectURL(file);
          const label = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
          updatePending((prev) => [...prev, { tempId, objectUrl, label }]);

          try {
            const path = `${userId}/${kind}s/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
            const { error: uploadError } = await supabase.storage
              .from(ASSETS_BUCKET)
              .upload(path, file, { contentType: file.type });
            if (uploadError) throw new Error(uploadError.message);

            const size = await readImageSize(file);
            const result = await registerAsset({
              kind,
              storagePath: path,
              label,
              width: size?.width ?? null,
              height: size?.height ?? null,
            });
            if (result.error) throw new Error(result.error);
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Upload failed."
            );
          } finally {
            updatePending((prev) => prev.filter((p) => p.tempId !== tempId));
            URL.revokeObjectURL(objectUrl);
          }
        })
      );

      router.refresh();
    },
    [kind, router, updatePending, userId]
  );

  return (
    <button
      type="button"
      aria-label={`Upload ${kind} images`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group flex w-full items-center justify-center gap-3 border border-dashed px-6 py-10 transition-colors duration-300",
        dragOver
          ? "border-ink bg-accent"
          : "hairline hover:border-ink"
      )}
    >
      <Plus
        className={cn(
          "size-4 transition-transform duration-300",
          dragOver ? "rotate-90" : "group-hover:rotate-90"
        )}
      />
      <span className="text-label text-muted-foreground group-hover:text-foreground transition-colors duration-300">
        Drop {kind === "model" ? "model" : "product"} images — or click to
        upload
      </span>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        JPG · PNG · WebP · up to 10 MB
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
