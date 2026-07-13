import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getPack, getPlan } from "@/lib/billing/plans";
import { MockCheckoutForm } from "./mock-checkout-form";

export const metadata: Metadata = { title: "Checkout (dev)" };

export default async function MockCheckoutPage({
  searchParams,
}: PageProps<"/billing/mock-checkout">) {
  if (process.env.ENABLE_MOCK_PROVIDER !== "1") {
    notFound();
  }
  await requireUser();

  const params = await searchParams;
  const kind = params.kind === "pack" ? "pack" : "plan";
  const itemId = typeof params.item === "string" ? params.item : "";
  const item = kind === "plan" ? getPlan(itemId) : getPack(itemId);
  if (!item || (kind === "plan" && itemId === "free")) {
    notFound();
  }

  const price =
    kind === "plan"
      ? `$${(item as { priceUsd: number }).priceUsd}/mo`
      : `$${(item as { priceUsd: number }).priceUsd}`;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <p className="text-label text-muted-foreground">
          Mock checkout — dev only
        </p>
        <h1 className="font-display mt-4 text-3xl tracking-tight">
          {item.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {price} · no card, no charge; this simulates a completed provider
          checkout and fires the same fulfillment path as the real webhook.
        </p>
        <div className="mt-10">
          <MockCheckoutForm kind={kind} itemId={itemId} />
        </div>
        <p className="mt-6 text-center">
          <Link
            href="/pricing"
            className="text-label text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to pricing
          </Link>
        </p>
      </div>
    </main>
  );
}
