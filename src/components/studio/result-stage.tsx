"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { TryOnProviderInfo } from "@/lib/providers/tryon";
import type { AssetWithUrl } from "@/components/library/asset-card";
import { CompareSlider } from "./compare-slider";

export type StudioPhase =
  | { phase: "idle" }
  | { phase: "generating"; providerId: string; startedAt: number }
  | {
      phase: "done";
      generationId: string;
      resultUrl: string;
      providerId: string;
      latencyMs?: number;
    }
  | {
      phase: "failed";
      providerId: string;
      error: string;
      code?: "no-credits";
    };

function ElapsedSeconds({ since }: { since: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setElapsed((Date.now() - since) / 1000),
      250
    );
    return () => clearInterval(t);
  }, [since]);
  return <>{elapsed.toFixed(0)}s</>;
}

async function downloadImage(url: string, filename: string) {
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

export function ResultStage({
  state,
  model,
  providers,
  canGenerate,
  onGenerate,
  onSave,
  saving,
  onAnimate,
}: {
  state: StudioPhase;
  model: AssetWithUrl | null;
  providers: TryOnProviderInfo[];
  canGenerate: boolean;
  onGenerate: (providerId: string) => void;
  onSave: (generationId: string) => void;
  saving: boolean;
  onAnimate?: (generationId: string) => void;
}) {
  const providerLabel = (id: string) =>
    providers.find((p) => p.id === id)?.label ?? id;

  return (
    <section aria-label="Result" className="relative">
      <AnimatePresence mode="wait">
        {state.phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-[420px] flex-col items-center justify-center border hairline-faint px-6 py-24 text-center"
          >
            <p className="font-display text-3xl tracking-tight text-muted-foreground">
              The look appears here
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {canGenerate
                ? "Everything is set — render when ready."
                : "Choose a model and a product to begin."}
            </p>
          </motion.div>
        )}

        {state.phase === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden border hairline px-6 py-24 text-center"
          >
            <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-accent to-transparent" />
            <p className="text-label text-muted-foreground">
              {providerLabel(state.providerId)}
            </p>
            <p className="font-display relative mt-4 text-3xl tracking-tight">
              Fitting the garment…
            </p>
            <p className="relative mt-3 text-sm tabular-nums text-muted-foreground">
              <ElapsedSeconds since={state.startedAt} />
            </p>
          </motion.div>
        )}

        {state.phase === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-[420px] flex-col items-center justify-center border border-oxblood/40 px-6 py-24 text-center"
          >
            <p className="text-label text-oxblood">
              {providerLabel(state.providerId)} failed
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              {state.error}
            </p>
            {state.code === "no-credits" ? (
              <Button className="mt-8" asChild>
                <a href="/pricing">See plans &amp; top-ups</a>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="mt-8"
                onClick={() => onGenerate(state.providerId)}
                disabled={!canGenerate}
              >
                <RotateCcw data-icon="inline-start" />
                Try again
              </Button>
            )}
          </motion.div>
        )}

        {state.phase === "done" && (
          <motion.div
            key={state.generationId}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            {model?.url ? (
              <CompareSlider
                beforeUrl={model.url}
                beforeAlt={model.label}
                afterUrl={state.resultUrl}
                afterAlt="Generated try-on"
              />
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <p className="text-label text-muted-foreground">
                {providerLabel(state.providerId)}
                {typeof state.latencyMs === "number" && (
                  <span className="ml-3 tabular-nums">
                    {(state.latencyMs / 1000).toFixed(1)}s
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onSave(state.generationId)}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save to library"}
                </Button>
                {onAnimate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAnimate(state.generationId)}
                  >
                    <Clapperboard data-icon="inline-start" />
                    Animate
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadImage(
                      state.resultUrl,
                      `atelier-${state.generationId}.jpg`
                    )
                  }
                >
                  <Download data-icon="inline-start" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onGenerate(state.providerId)}
                  disabled={!canGenerate}
                >
                  <RotateCcw data-icon="inline-start" />
                  Regenerate
                </Button>
              </div>
            </div>

            {providers.length > 1 && (
              <div className="mt-6 border-t hairline-faint pt-4">
                <p className="text-label text-muted-foreground">
                  Same pair, different eye
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {providers
                    .filter((p) => p.id !== state.providerId)
                    .map((p) => (
                      <Button
                        key={p.id}
                        size="xs"
                        variant="outline"
                        onClick={() => onGenerate(p.id)}
                        disabled={!canGenerate}
                        title={p.note}
                      >
                        {p.label}
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
