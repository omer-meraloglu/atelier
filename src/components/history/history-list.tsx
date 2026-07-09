"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GenerationStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export interface HistoryItem {
  type: "image" | "video";
  id: string;
  createdAt: string;
  status: GenerationStatus;
  providerLabel: string;
  latencyMs: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  title: string;
  error: string | null;
  href: string;
}

function StatusBadge({ status }: { status: GenerationStatus }) {
  if (status === "succeeded") return null;
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return (
    <Badge variant="secondary" className="animate-pulse">
      {status === "queued" ? "Queued" : "Processing"}
    </Badge>
  );
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function HistoryCard({ item }: { item: HistoryItem }) {
  const [playing, setPlaying] = useState(false);

  const media =
    item.type === "video" && playing && item.videoUrl ? (
      <video
        src={item.videoUrl}
        poster={item.imageUrl ?? undefined}
        controls
        autoPlay
        playsInline
        className="aspect-[3/4] w-full bg-ink object-contain"
      />
    ) : item.imageUrl ? (
      <Image
        src={item.imageUrl}
        alt={item.title}
        width={600}
        height={800}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className={cn(
          "aspect-[3/4] w-full object-cover transition-transform duration-700 ease-[var(--ease-editorial)]",
          item.status === "succeeded" && "group-hover:scale-[1.02]",
          item.status === "failed" && "opacity-40 grayscale"
        )}
      />
    ) : (
      <div
        className={cn(
          "flex aspect-[3/4] w-full items-center justify-center px-4 text-center text-xs leading-relaxed",
          item.status === "failed"
            ? "text-oxblood"
            : "animate-pulse text-muted-foreground"
        )}
      >
        {item.status === "failed"
          ? (item.error ?? "Failed")
          : item.type === "video"
            ? "Clip rendering…"
            : "Rendering…"}
      </div>
    );

  return (
    <figure className="group relative overflow-hidden border hairline-faint bg-card">
      {media}

      {/* play affordance for finished clips */}
      {item.type === "video" &&
        !playing &&
        item.status === "succeeded" &&
        item.videoUrl && (
          <button
            type="button"
            aria-label={`Play clip: ${item.title}`}
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center bg-ink/20 opacity-90 transition-opacity duration-300 hover:opacity-100"
          >
            <span className="flex size-14 items-center justify-center border border-bone/60 bg-ink/50 text-bone backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
              <Play className="size-5 translate-x-px" aria-hidden />
            </span>
          </button>
        )}

      <figcaption className="flex flex-col gap-1.5 border-t hairline-faint p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm" title={item.title}>
            {item.title}
          </p>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-label text-muted-foreground">
            {item.type === "video" ? "Clip · " : ""}
            {item.providerLabel}
            {item.latencyMs !== null && (
              <span className="ml-2 tabular-nums">
                {(item.latencyMs / 1000).toFixed(1)}s
              </span>
            )}
          </p>
          <span className="text-xs text-muted-foreground">
            {dateLabel(item.createdAt)}
          </span>
        </div>
        <Link
          href={item.href}
          className="text-label mt-1 text-muted-foreground underline-offset-4 transition-colors duration-300 hover:text-foreground hover:underline"
        >
          Open in studio
        </Link>
      </figcaption>
    </figure>
  );
}

export function HistoryList({ items }: { items: HistoryItem[] }) {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");

  const filtered = items.filter(
    (i) => filter === "all" || i.type === filter
  );

  return (
    <div className="space-y-8">
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as typeof filter)}
      >
        <TabsList aria-label="Filter history">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Stills</TabsTrigger>
          <TabsTrigger value="video">Clips</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center border hairline-faint px-6 py-24 text-center">
          <p className="font-display text-3xl tracking-tight">
            Nothing here yet
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Renders and clips appear here the moment you make them.
          </p>
          <Link
            href="/studio"
            className="text-label mt-8 underline underline-offset-8"
          >
            Go to the studio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <HistoryCard key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
