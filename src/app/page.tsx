import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-5 py-24 sm:px-8">
        <p className="text-label animate-reveal text-muted-foreground">
          Atelier — Virtual Try-On Studio
        </p>
        <h1
          className="font-display animate-reveal mt-6 max-w-4xl text-5xl leading-[1.05] tracking-tight text-balance sm:text-7xl md:text-8xl"
          style={{ animationDelay: "120ms" }}
        >
          Dress the model.
          <br />
          <em className="text-oxblood">Then make it move.</em>
        </h1>
        <p
          className="animate-reveal mt-8 max-w-md text-base leading-relaxed text-muted-foreground"
          style={{ animationDelay: "240ms" }}
        >
          Upload a model, upload a garment, and let the studio render the look —
          then set it in motion. Compare AI providers side by side and keep every
          piece in your own library.
        </p>
        <div
          className="animate-reveal mt-12 flex items-center gap-4"
          style={{ animationDelay: "360ms" }}
        >
          <Button size="lg" asChild>
            <Link href="/studio">Enter the studio</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/library">Browse library</Link>
          </Button>
        </div>
      </div>

      <footer className="border-t hairline">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-5 py-5 sm:px-8">
          <span className="text-label text-muted-foreground">
            Atelier © {new Date().getFullYear()}
          </span>
          <Link
            href="/style"
            className="text-label text-muted-foreground transition-colors hover:text-foreground"
          >
            Design system
          </Link>
        </div>
      </footer>
    </main>
  );
}
