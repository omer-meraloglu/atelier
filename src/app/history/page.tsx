import type { Metadata } from "next";

import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-16 sm:px-8">
        <h1 className="font-display text-4xl tracking-tight">History</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Coming in milestone 7.
        </p>
      </main>
    </>
  );
}
