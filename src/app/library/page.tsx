import type { Metadata } from "next";

import { LibraryView } from "@/components/library/library-view";
import { SiteNav } from "@/components/site-nav";
import { requireUser } from "@/lib/auth";
import { signPaths } from "@/lib/storage";
import type { AssetKind } from "@/lib/database.types";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: PageProps<"/library">) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const kind: AssetKind = params.kind === "product" ? "product" : "model";

  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .eq("kind", kind)
    .order("created_at", { ascending: false });

  const rows = assets ?? [];
  const urls = await signPaths(
    supabase,
    rows.map((a) => a.storage_path)
  );

  const withUrls = rows.map((a) => ({
    ...a,
    url: urls.get(a.storage_path) ?? null,
  }));

  return (
    <>
      <SiteNav userEmail={user.email} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-12 sm:px-8">
        <header className="mb-10">
          <p className="text-label text-muted-foreground">Your collection</p>
          <h1 className="font-display mt-3 text-4xl tracking-tight sm:text-5xl">
            Library
          </h1>
        </header>
        <LibraryView assets={withUrls} kind={kind} userId={user.id} />
      </main>
    </>
  );
}
