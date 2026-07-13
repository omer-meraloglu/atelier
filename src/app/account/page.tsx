import type { Metadata } from "next";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getCreditState } from "@/lib/billing/credits";
import { CREDIT_COSTS } from "@/lib/billing/plans";
import { PortalButton } from "./portal-button";

export const metadata: Metadata = { title: "Account" };

const REASON_LABELS: Record<string, string> = {
  free_signup: "Welcome credits",
  image_render: "Still render",
  video_render: "Motion clip",
  refund: "Refund — failed render",
  subscription_grant: "Monthly plan credits",
  pack_purchase: "Top-up pack",
};

function dateTimeLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AccountPage({
  searchParams,
}: PageProps<"/account">) {
  const { supabase, user } = await requireUser();
  const params = await searchParams;
  const creditState = await getCreditState(supabase, user.id);

  const [{ data: ledger }, { data: customer }] = await Promise.all([
    supabase
      .from("credit_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("billing_customers")
      .select("provider")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <>
      <SiteNav userEmail={user.email} credits={creditState.balance} />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-5 py-12 sm:px-8">
        <header className="mb-10">
          <p className="text-label text-muted-foreground">{user.email}</p>
          <h1 className="font-display mt-3 text-4xl tracking-tight sm:text-5xl">
            Account
          </h1>
        </header>

        {params.welcome === "1" && (
          <div className="animate-reveal mb-10 border hairline bg-card p-6">
            <p className="text-label text-oxblood">Welcome aboard</p>
            <p className="mt-2 text-sm leading-relaxed">
              Your plan is live and the credits are in. Time to dress someone.
            </p>
          </div>
        )}

        {/* Plan + balance */}
        <section className="grid gap-px border hairline bg-border sm:grid-cols-2">
          <div className="bg-background p-6">
            <h2 className="text-label text-muted-foreground">Plan</h2>
            <p className="font-display mt-3 text-3xl tracking-tight">
              {creditState.plan.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {creditState.plan.id === "free"
                ? "Stills only. Upgrade for motion and monthly credits."
                : `${creditState.plan.monthlyCredits.toLocaleString()} credits monthly · motion clips included.`}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button size="sm" asChild>
                <Link href="/pricing">
                  {creditState.plan.id === "free" ? "Upgrade" : "Change plan"}
                </Link>
              </Button>
              {customer && <PortalButton />}
            </div>
          </div>
          <div className="bg-background p-6">
            <h2 className="text-label text-muted-foreground">Credits</h2>
            <p className="font-display mt-3 text-3xl tracking-tight tabular-nums">
              {creditState.balance}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A still is {CREDIT_COSTS.image} credit; a clip is{" "}
              {CREDIT_COSTS.video}. Credits never expire.
            </p>
            <div className="mt-5">
              <Button size="sm" variant="outline" asChild>
                <Link href="/pricing">Top up</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Ledger */}
        <section className="mt-12">
          <h2 className="text-label text-muted-foreground">Recent activity</h2>
          {!ledger || ledger.length === 0 ? (
            <p className="mt-6 border hairline-faint p-8 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-border border hairline">
              {ledger.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {REASON_LABELS[entry.reason] ?? entry.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dateTimeLabel(entry.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={entry.delta > 0 ? "default" : "secondary"}
                    className="tabular-nums"
                  >
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
