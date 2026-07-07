"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, MoreHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { deleteAsset, renameAsset } from "@/app/library/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { AssetRow } from "@/lib/database.types";

export interface AssetWithUrl extends AssetRow {
  url: string | null;
}

export function AssetCard({ asset }: { asset: AssetWithUrl }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [label, setLabel] = useState(asset.label);
  const [isPending, startTransition] = useTransition();

  const studioParam =
    asset.kind === "model" ? `model=${asset.id}` : `product=${asset.id}`;

  function submitRename() {
    startTransition(async () => {
      const res = await renameAsset({ id: asset.id, label });
      if (res.error) {
        toast.error(res.error);
      } else {
        setRenameOpen(false);
        router.refresh();
      }
    });
  }

  function submitDelete() {
    startTransition(async () => {
      const res = await deleteAsset({ id: asset.id });
      if (res.error) {
        toast.error(res.error);
      } else {
        setDeleteOpen(false);
        toast.success("Asset removed.");
        router.refresh();
      }
    });
  }

  return (
    <figure className="group relative mb-5 break-inside-avoid overflow-hidden border hairline-faint bg-card">
      {asset.url ? (
        <Image
          src={asset.url}
          alt={asset.label}
          width={asset.width ?? 600}
          height={asset.height ?? 800}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="w-full object-cover transition-transform duration-700 ease-[var(--ease-editorial)] group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center text-xs text-muted-foreground">
          Preview unavailable
        </div>
      )}

      {/* hover veil */}
      <figcaption className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-ink/70 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="truncate text-sm text-bone">{asset.label}</p>
        <div className="pointer-events-auto mt-3 flex items-center gap-2">
          <Button size="xs" variant="secondary" asChild>
            <Link href={`/studio?${studioParam}`}>
              <Sparkles data-icon="inline-start" />
              Studio
            </Link>
          </Button>
          <Button size="xs" variant="secondary" asChild>
            <Link href={`/studio?animate=${asset.id}`}>
              <Clapperboard data-icon="inline-start" />
              Animate
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-xs"
                variant="secondary"
                aria-label={`More actions for ${asset.label}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </figcaption>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              Rename
            </DialogTitle>
          </DialogHeader>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={isPending || !label.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">
              Delete “{asset.label}”?
            </DialogTitle>
            <DialogDescription>
              This removes the image and any try-ons that used it. There is no
              undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </figure>
  );
}
