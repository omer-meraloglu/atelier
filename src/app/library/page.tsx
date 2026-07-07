import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const { user } = await requireUser();

  return (
    <>
      <SiteNav userEmail={user.email} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-16 sm:px-8">
        <h1 className="font-display text-4xl tracking-tight">Library</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Coming in milestone 3.
        </p>
      </main>
    </>
  );
}
