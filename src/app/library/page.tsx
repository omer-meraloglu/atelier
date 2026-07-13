import type { Metadata } from "next";

import { LibraryView } from "@/components/library/library-view";
import { SiteNav } from "@/components/site-nav";
import { requireUser } from "@/lib/auth";
import { getCreditState } from "@/lib/billing/credits";
import { stableSignedUrls } from "@/lib/signed-urls";
import type { AssetKind } from "@/lib/database.types";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: PageProps<"/library">) {
  const { supabase, user } = await requireUser();
  const creditState = await getCreditState(supabase, user.id);
  const params = await searchParams;
  const kind: AssetKind = params.kind === "product" ? "product" : "model";

  // Both kinds in one query: tab switching filters client-side, so the
  // Models/Products toggle reacts instantly instead of waiting on a
  // server round-trip.
  const { data: assets } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = assets ?? [];
  const urls = await stableSignedUrls(rows.map((a) => a.storage_path)
  );

  const withUrls = rows.map((a) => ({
    ...a,
    url: urls.get(a.storage_path) ?? null,
  }));

  return (
    <>
      <SiteNav userEmail={user.email} credits={creditState.balance} />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-12 sm:px-8">
        <header className="mb-10">
          <p className="text-label text-muted-foreground">Your collection</p>
          <h1 className="font-display mt-3 text-4xl tracking-tight sm:text-5xl">
            Library
          </h1>
        </header>
        <LibraryView assets={withUrls} initialKind={kind} userId={user.id} />
      </main>
    </>
  );
}
