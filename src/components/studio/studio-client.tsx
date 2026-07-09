"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generateTryOn, saveGenerationToLibrary } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AssetWithUrl } from "@/components/library/asset-card";
import type { TryOnProviderInfo } from "@/lib/providers/tryon";
import type { VideoProviderInfo } from "@/lib/providers/video";
import type { VideoStatus } from "@/app/studio/video-actions";
import { AnimatePanel, type AnimateSource } from "./animate-panel";
import { AssetSlot } from "./asset-slot";
import { ResultStage, type StudioPhase } from "./result-stage";

const CATEGORIES = [
  { value: "auto", label: "Auto" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "full", label: "Full" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function StudioClient({
  userId,
  models,
  products,
  providers,
  videoProviders,
  initialModel,
  initialProduct,
  initialState,
  initialAnimate,
  initialVideoJob,
}: {
  userId: string;
  models: AssetWithUrl[];
  products: AssetWithUrl[];
  providers: TryOnProviderInfo[];
  videoProviders: VideoProviderInfo[];
  initialModel: AssetWithUrl | null;
  initialProduct: AssetWithUrl | null;
  initialState?: StudioPhase;
  initialAnimate?: AnimateSource;
  initialVideoJob?: VideoStatus;
}) {
  const [model, setModel] = useState<AssetWithUrl | null>(initialModel);
  const [product, setProduct] = useState<AssetWithUrl | null>(initialProduct);
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [category, setCategory] = useState<Category>("auto");
  const [state, setState] = useState<StudioPhase>(
    initialState ?? { phase: "idle" }
  );
  const [saving, startSaving] = useTransition();
  const [animateSource, setAnimateSource] = useState<AnimateSource | null>(
    initialAnimate ?? null
  );
  const [animateOpen, setAnimateOpen] = useState(Boolean(initialAnimate));

  const provider = providers.find((p) => p.id === providerId);
  const canGenerate =
    Boolean(model && product && provider) && state.phase !== "generating";

  async function generate(withProviderId: string) {
    if (!model || !product) return;
    setState({
      phase: "generating",
      providerId: withProviderId,
      startedAt: Date.now(),
    });

    const result = await generateTryOn({
      modelAssetId: model.id,
      productAssetId: product.id,
      providerId: withProviderId,
      category,
    });

    if (result.status === "succeeded" && result.resultUrl && result.id) {
      setState({
        phase: "done",
        generationId: result.id,
        resultUrl: result.resultUrl,
        providerId: result.providerId,
        latencyMs: result.latencyMs,
      });
    } else {
      setState({
        phase: "failed",
        providerId: result.providerId,
        error: result.error ?? "The render failed.",
      });
    }
  }

  function handleSave(generationId: string) {
    startSaving(async () => {
      const res = await saveGenerationToLibrary({ generationId });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Saved “${res.label}” to your library.`);
      }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      {/* Slots + controls */}
      <div className="lg:col-span-5">
        <div className="grid grid-cols-2 gap-5">
          <AssetSlot
            kind="model"
            userId={userId}
            assets={models}
            selected={model}
            onSelect={setModel}
          />
          <AssetSlot
            kind="product"
            userId={userId}
            assets={products}
            selected={product}
            onSelect={setProduct}
          />
        </div>

        <div className="mt-8 space-y-6 border-t hairline pt-6">
          <div className="grid gap-2">
            <Label htmlFor="provider-select">AI model</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger id="provider-select" className="w-full">
                <SelectValue placeholder="Choose an AI model" />
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

          <div className="grid gap-2">
            <Label>Garment category</Label>
            <Tabs
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <TabsList aria-label="Garment category" className="w-full">
                {CATEGORIES.map((c) => (
                  <TabsTrigger
                    key={c.value}
                    value={c.value}
                    className="flex-1"
                  >
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={!canGenerate}
            onClick={() => generate(providerId)}
          >
            {state.phase === "generating" ? "Rendering…" : "Generate the look"}
          </Button>
        </div>
      </div>

      {/* Result */}
      <div className="lg:col-span-7">
        <ResultStage
          state={state}
          model={model}
          providers={providers}
          canGenerate={canGenerate}
          onGenerate={(id) => {
            setProviderId(id);
            void generate(id);
          }}
          onSave={handleSave}
          saving={saving}
          onAnimate={
            videoProviders.length > 0
              ? (generationId) => {
                  if (state.phase !== "done") return;
                  setAnimateSource({
                    kind: "generation",
                    id: generationId,
                    imageUrl: state.resultUrl,
                    label:
                      model && product
                        ? `${model.label} × ${product.label}`
                        : "this look",
                  });
                  setAnimateOpen(true);
                }
              : undefined
          }
        />
      </div>

      <AnimatePanel
        open={animateOpen}
        onOpenChange={setAnimateOpen}
        source={animateSource}
        providers={videoProviders}
        userId={userId}
        initialJob={initialVideoJob}
      />
    </div>
  );
}
