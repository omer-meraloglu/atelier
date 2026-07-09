"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <p className="text-label text-oxblood">Something tore</p>
      <h1 className="font-display mt-4 text-5xl tracking-tight">
        A seam came undone
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {error.digest
          ? `An unexpected error occurred (${error.digest}).`
          : "An unexpected error occurred."}{" "}
        Your work is saved — try once more.
      </p>
      <Button variant="outline" className="mt-10" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
