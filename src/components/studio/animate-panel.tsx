"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  attachPoster,
  startVideoGeneration,
  type VideoStatus,
} from "@/app/studio/video-actions";
import {
  VIDEO_JOBS_UPDATED_EVENT,
  notifyVideoJobStarted,
} from "@/components/video-jobs-watcher";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { ASSETS_BUCKET } from "@/lib/storage";
import type { VideoProviderInfo } from "@/lib/providers/video";
import type { VideoSourceKind } from "@/lib/database.types";

export interface AnimateSource {
  kind: VideoSourceKind;
  id: string;
  imageUrl: string | null;
  label: string;
}

const MOTIONS = ["low", "medium", "high"] as const;
type Motion = (typeof MOTIONS)[number];

async function downloadVideo(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    toast.error("Download failed.");
  }
}

export function AnimatePanel({
  open,
  onOpenChange,
  source,
  providers,
  userId,
  initialJob,
  videoAllowed = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: AnimateSource | null;
  providers: VideoProviderInfo[];
  userId: string;
  initialJob?: VideoStatus;
  videoAllowed?: boolean;
}) {
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [motion, setMotion] = useState<Motion>("medium");
  const [duration, setDuration] = useState<number | null>(null);
  const [job, setJob] = useState<VideoStatus | null>(initialJob ?? null);
  const [submitting, setSubmitting] = useState(false);
  const posterSent = useRef(false);

  const provider = providers.find((p) => p.id === providerId);
  const durationChoices = provider?.durationOptions ?? [];
  const effectiveDuration =
    duration && durationChoices.includes(duration)
      ? duration
      : durationChoices[0];

  const active =
    job !== null && (job.status === "queued" || job.status === "processing");

  // The persistent VideoJobsWatcher (in the site nav) is the single poller;
  // this panel just listens for its broadcasts. Closing the panel or
  // navigating no longer orphans a render.
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const jobs = (event as CustomEvent<VideoStatus[]>).detail;
      setJob((current) => {
        if (!current) return current;
        const updated = jobs.find((j) => j.id === current.id);
        return updated ?? current;
      });
    };
    window.addEventListener(VIDEO_JOBS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(VIDEO_JOBS_UPDATED_EVENT, onUpdate);
  }, []);

  async function start() {
    if (!source || !provider) return;
    setSubmitting(true);
    posterSent.current = false;
    const res = await startVideoGeneration({
      sourceKind: source.kind,
      sourceId: source.id,
      providerId: provider.id,
      prompt: provider.supports.prompt ? prompt || undefined : undefined,
      durationSeconds: provider.supports.duration
        ? effectiveDuration
        : undefined,
      motion: provider.supports.motion ? motion : undefined,
    });
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      setJob(res);
      notifyVideoJobStarted();
    }
  }

  /** Capture the first frame as the poster once the clip is playable. */
  const captureAndAttachPoster = useCallback(
    async (video: HTMLVideoElement, jobId: string) => {
      if (posterSent.current) return;
      posterSent.current = true;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((r) =>
          canvas.toBlob(r, "image/jpeg", 0.85)
        );
        if (!blob) return;
        const posterPath = `${userId}/videos/${jobId}-poster.jpg`;
        const supabase = createClient();
        const { error } = await supabase.storage
          .from(ASSETS_BUCKET)
          .upload(posterPath, blob, {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (!error) {
          await attachPoster({ id: jobId, posterPath });
        }
      } catch {
        // Tainted canvas or storage hiccup — the clip still works without a poster.
      }
    },
    [userId]
  );

  const showConfig = !job || job.status === "failed";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b hairline">
          <SheetTitle className="font-display text-2xl font-normal tracking-tight">
            Set it in motion
          </SheetTitle>
          <SheetDescription>
            {source
              ? `A short clip from “${source.label}”.`
              : "Pick a still to animate."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 p-4">
          {/* Source still / result video */}
          <div className="relative overflow-hidden border hairline bg-card">
            {job?.status === "succeeded" && job.resultUrl ? (
              <video
                key={job.resultUrl}
                src={job.resultUrl}
                poster={job.posterUrl}
                controls
                playsInline
                crossOrigin="anonymous"
                className="w-full"
                onLoadedData={(e) =>
                  void captureAndAttachPoster(e.currentTarget, job.id)
                }
              >
                Your browser cannot play this clip.
              </video>
            ) : source?.imageUrl ? (
              <>
                <Image
                  src={source.imageUrl}
                  alt={source.label}
                  width={600}
                  height={800}
                  sizes="400px"
                  className={
                    active
                      ? "w-full object-cover opacity-50 transition-opacity duration-700"
                      : "w-full object-cover"
                  }
                />
                {active && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bone/40">
                    <span className="animate-pulse text-label">
                      {job?.status === "processing"
                        ? "Rendering motion…"
                        : "Waiting in queue…"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Video takes a few minutes — you can keep working.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-xs text-muted-foreground">
                No source selected
              </div>
            )}
          </div>

          {job?.status === "failed" && (
            <p role="alert" className="text-sm leading-relaxed text-oxblood">
              {job.error ?? "The clip failed to render."}
            </p>
          )}

          {job?.status === "succeeded" && job.resultUrl && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-label text-muted-foreground">
                {providers.find((p) => p.id === job.providerId)?.label ??
                  job.providerId}
                {typeof job.latencyMs === "number" && (
                  <span className="ml-2 tabular-nums">
                    {(job.latencyMs / 1000).toFixed(0)}s
                  </span>
                )}
              </p>
              <Button
                size="xs"
                variant="outline"
                onClick={() =>
                  void downloadVideo(job.resultUrl!, `atelier-${job.id}.mp4`)
                }
              >
                <Download data-icon="inline-start" />
                Download
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setJob(null)}
              >
                <RotateCcw data-icon="inline-start" />
                New take
              </Button>
            </div>
          )}

          {/* Plan gate — the server refuses regardless; this is the kind version */}
          {showConfig && !videoAllowed && (
            <div className="space-y-4 border-t hairline pt-5">
              <p className="font-display text-2xl tracking-tight">
                Motion is a paid-plan feature
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Starter and Studio include video clips — twenty credits per
                take, rendered by the same models the stills use.
              </p>
              <Button size="lg" className="w-full" asChild>
                <a href="/pricing">See plans</a>
              </Button>
            </div>
          )}

          {/* Config */}
          {showConfig && videoAllowed && (
            <div className="space-y-5 border-t hairline pt-5">
              <div className="grid gap-2">
                <Label htmlFor="video-provider">Video model</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger id="video-provider" className="w-full">
                    <SelectValue placeholder="Choose a video model" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {provider && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {provider.note}
                  </p>
                )}
              </div>

              {provider?.supports.prompt && (
                <div className="grid gap-2">
                  <Label htmlFor="motion-prompt">
                    Motion hint{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="motion-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={600}
                    rows={2}
                    placeholder="She turns slowly toward the light, fabric trailing…"
                  />
                </div>
              )}

              {provider?.supports.motion && (
                <div className="grid gap-2">
                  <Label>Movement</Label>
                  <Tabs
                    value={motion}
                    onValueChange={(v) => setMotion(v as Motion)}
                  >
                    <TabsList className="w-full" aria-label="Movement level">
                      {MOTIONS.map((m) => (
                        <TabsTrigger key={m} value={m} className="flex-1">
                          {m === "low"
                            ? "Subtle"
                            : m === "medium"
                              ? "Graceful"
                              : "Dynamic"}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {provider?.supports.duration && durationChoices.length > 0 && (
                <div className="grid gap-2">
                  <Label>Duration</Label>
                  <Tabs
                    value={String(effectiveDuration)}
                    onValueChange={(v) => setDuration(Number(v))}
                  >
                    <TabsList className="w-full" aria-label="Clip duration">
                      {durationChoices.map((d) => (
                        <TabsTrigger
                          key={d}
                          value={String(d)}
                          className="flex-1"
                        >
                          {d}s
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              <Button
                size="lg"
                className="w-full"
                disabled={!source || !provider || submitting || active}
                onClick={() => void start()}
              >
                {submitting
                  ? "Sending…"
                  : job?.status === "failed"
                    ? "Try again"
                    : "Render the clip"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
