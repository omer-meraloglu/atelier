import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CREDIT_COSTS, PACKS, PLANS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { CheckoutButton } from "./pricing-cta";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 py-16 sm:px-8">
      <header className="flex items-baseline justify-between">
        <Link href="/" className="font-display text-2xl tracking-tight">
          Atelier
        </Link>
        <Link
          href={user ? "/studio" : "/login?next=/pricing"}
          className="text-label text-muted-foreground transition-colors hover:text-foreground"
        >
          {user ? "Back to the studio" : "Sign in"}
        </Link>
      </header>

      <section className="mt-16">
        <p className="text-label text-muted-foreground">Pricing</p>
        <h1 className="font-display mt-4 max-w-2xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Pay for renders,
          <br />
          <em className="text-oxblood">not for seats.</em>
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          A still costs {CREDIT_COSTS.image} credit; a motion clip costs{" "}
          {CREDIT_COSTS.video}. Subscriptions refill monthly, unused credits
          bank, and top-up packs never expire. Prices in USD — tax handled at
          checkout.
        </p>
      </section>

      {/* Plans */}
      <section
        aria-label="Plans"
        className="mt-16 grid gap-px border hairline bg-border md:grid-cols-3"
      >
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col gap-6 bg-background p-8"
          >
            <div>
              <h2 className="text-label text-muted-foreground">{plan.name}</h2>
              <p className="font-display mt-4 text-5xl tracking-tight">
                ${plan.priceUsd}
                <span className="font-sans text-sm text-muted-foreground">
                  {plan.priceUsd > 0 ? " /month" : " forever"}
                </span>
              </p>
            </div>
            <p className="min-h-16 text-sm leading-relaxed text-muted-foreground">
              {plan.blurb}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                {plan.id === "free"
                  ? `${10} credits on signup`
                  : `${plan.monthlyCredits.toLocaleString()} credits / month`}
              </li>
              <li className={plan.videoEnabled ? "" : "text-muted-foreground line-through"}>
                Motion clips
              </li>
              <li>All try-on models, honest latency logs</li>
            </ul>
            <div className="mt-auto">
              {plan.id === "free" ? (
                <Button variant="outline" size="lg" className="w-full" asChild>
                  <Link href={user ? "/studio" : "/login"}>
                    {user ? "You have this" : "Start free"}
                  </Link>
                </Button>
              ) : user ? (
                <CheckoutButton
                  kind="plan"
                  itemId={plan.id}
                  label={`Get ${plan.name}`}
                  variant={plan.id === "starter" ? "default" : "outline"}
                />
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  variant={plan.id === "starter" ? "default" : "outline"}
                  asChild
                >
                  <Link href="/login?next=/pricing">Sign in to subscribe</Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Packs */}
      <section aria-label="Top-up packs" className="mt-16">
        <h2 className="text-label text-muted-foreground">Top-ups</h2>
        <div className="mt-6 grid gap-px border hairline bg-border sm:grid-cols-2">
          {PACKS.map((pack) => (
            <div
              key={pack.id}
              className="flex items-center justify-between gap-6 bg-background p-6"
            >
              <div>
                <p className="font-display text-2xl tracking-tight">
                  {pack.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ${pack.priceUsd} · one-time, never expires
                </p>
              </div>
              <div className="w-40">
                {user ? (
                  <CheckoutButton
                    kind="pack"
                    itemId={pack.id}
                    label="Buy"
                    variant="outline"
                  />
                ) : (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/login?next=/pricing">Sign in</Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t hairline pt-6">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Checkout and invoicing are handled by our merchant of record;
          VAT/sales tax is calculated per country at checkout. Cancel anytime —
          banked credits stay yours.
        </p>
      </footer>
    </main>
  );
}
