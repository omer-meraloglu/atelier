import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-32 text-center">
      <p className="text-label text-muted-foreground">404</p>
      <h1 className="font-display mt-4 text-5xl tracking-tight">
        Off the runway
      </h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
        This page doesn&apos;t exist — or it was retired from the collection.
      </p>
      <Link
        href="/studio"
        className="text-label mt-10 underline underline-offset-8"
      >
        Back to the studio
      </Link>
    </main>
  );
}
