import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Design system" };

const swatches = [
  { name: "Bone", varName: "--bone", hex: "#f2efe9" },
  { name: "Bone raised", varName: "--bone-raised", hex: "#f9f7f3" },
  { name: "Ink", varName: "--ink", hex: "#191712" },
  { name: "Ink soft", varName: "--ink-soft", hex: "#4c473f" },
  { name: "Ink faint", varName: "--ink-faint", hex: "#8a847a" },
  { name: "Oxblood", varName: "--oxblood", hex: "#6e2f28" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t hairline pt-8">
      <h2 className="text-label text-muted-foreground">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function StylePage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8">
      <p className="text-label text-muted-foreground">Atelier</p>
      <h1 className="font-display mt-4 text-5xl tracking-tight sm:text-6xl">
        Design system
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        Tokens and primitives in one place. Editorial restraint: bone ground,
        ink text, one oxblood accent, hairline rules, sharp corners, slow
        motion.
      </p>

      <div className="mt-16 space-y-16">
        <Section title="Palette">
          <div className="grid grid-cols-2 gap-px border hairline bg-border sm:grid-cols-3 md:grid-cols-6">
            {swatches.map((s) => (
              <div key={s.name} className="bg-background p-4">
                <div
                  className="h-20 w-full border hairline-faint"
                  style={{ background: `var(${s.varName})` }}
                />
                <p className="mt-3 text-sm">{s.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {s.hex}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Type scale">
          <div className="space-y-8">
            <p className="font-display text-7xl tracking-tight sm:text-8xl">
              Aa — Fraunces
            </p>
            <p className="font-display text-4xl tracking-tight">
              The garment, rendered <em className="text-oxblood">worn</em>.
            </p>
            <p className="max-w-xl text-base leading-relaxed">
              Instrument Sans carries the interface — labels, controls, and
              captions — while Fraunces speaks only in headlines. Body text sits
              at 16px with a relaxed line height.
            </p>
            <p className="text-sm text-muted-foreground">
              Small — captions and metadata, 14px.
            </p>
            <p className="text-label text-muted-foreground">
              Micro label — 11px, tracked wide
            </p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button>Generate</Button>
            <Button variant="outline">Save to library</Button>
            <Button variant="secondary">Regenerate</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete</Button>
            <Button size="lg">Enter the studio</Button>
            <Button disabled>Processing</Button>
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid max-w-lg gap-6">
            <div className="grid gap-2">
              <Label htmlFor="style-label">Label</Label>
              <Input id="style-label" placeholder="Silk slip dress, ivory" />
            </div>
            <div className="grid gap-2">
              <Label>AI model</Label>
              <Select defaultValue="fashn">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fashn">FASHN v1.6</SelectItem>
                  <SelectItem value="idm">IDM-VTON</SelectItem>
                  <SelectItem value="kolors">Kolors</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Tabs defaultValue="models">
              <TabsList>
                <TabsTrigger value="models">Models</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="secondary">Queued</Badge>
            <Badge variant="secondary" className="animate-pulse">
              Processing
            </Badge>
            <Badge>Succeeded</Badge>
            <Badge variant="destructive">Failed</Badge>
          </div>
        </Section>

        <Section title="Loading">
          <div className="grid max-w-2xl grid-cols-3 gap-6">
            <Skeleton className="aspect-[3/4] rounded-none" />
            <Skeleton className="aspect-[3/4] rounded-none" />
            <Skeleton className="aspect-[3/4] rounded-none" />
          </div>
        </Section>

        <Section title="Motion">
          <div className="max-w-xl space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Ease: <code className="font-mono">cubic-bezier(0.22, 1, 0.36, 1)</code>{" "}
              — decisive start, long settle.
            </p>
            <p>
              Durations: 200ms (hover) / 450ms (element) / 900ms (reveal). No
              bounce, no overshoot. Images cross-fade; nothing slides far.
            </p>
            <p className="animate-reveal border hairline p-6 text-foreground">
              This block entered with the standard reveal.
            </p>
          </div>
        </Section>
      </div>
    </main>
  );
}
