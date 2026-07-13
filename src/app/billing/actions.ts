"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { applyBillingEvent } from "@/lib/billing/credits";
import { getPack, getPlan } from "@/lib/billing/plans";
import { getBillingProvider } from "@/lib/billing/provider";

async function siteOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

const checkoutSchema = z.object({
  kind: z.enum(["plan", "pack"]),
  itemId: z.string().min(1).max(50),
});

/** Kicks the user into hosted checkout for a plan or pack. */
export async function startCheckout(input: {
  kind: "plan" | "pack";
  itemId: string;
}): Promise<{ error: string } | never> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid selection." };
  const { kind, itemId } = parsed.data;

  const item = kind === "plan" ? getPlan(itemId) : getPack(itemId);
  if (!item || (kind === "plan" && itemId === "free")) {
    return { error: "That option is not purchasable." };
  }

  const { user } = await requireUser();
  const provider = getBillingProvider();

  let url: string;
  try {
    url = await provider.createCheckoutUrl({
      userId: user.id,
      email: user.email ?? "",
      kind,
      itemId,
      origin: await siteOrigin(),
    });
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not start the checkout.",
    };
  }

  redirect(url);
}

/** Opens the provider's manage-billing portal, if the user has one. */
export async function openBillingPortal(): Promise<{ error: string } | never> {
  const { supabase, user } = await requireUser();
  const provider = getBillingProvider();

  const { data: customer } = await supabase
    .from("billing_customers")
    .select("provider_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!customer) {
    return { error: "No billing profile yet — subscribe first." };
  }

  const url = await provider.getPortalUrl(customer.provider_customer_id);
  if (!url) {
    return { error: "The billing portal is unavailable right now." };
  }
  redirect(url);
}

/**
 * Dev-only: completes a mock checkout by applying the same normalized
 * events a real webhook would deliver.
 */
export async function completeMockCheckout(input: {
  kind: "plan" | "pack";
  itemId: string;
}): Promise<{ error: string } | never> {
  if (process.env.ENABLE_MOCK_PROVIDER !== "1") {
    return { error: "Mock checkout is disabled." };
  }
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid selection." };

  const { user } = await requireUser();
  const { kind, itemId } = parsed.data;

  // Unique per completion — replaying the SAME event id is what the
  // idempotency test in /account exercises.
  const eventId = `mock-${kind}-${itemId}-${user.id}-${Date.now()}`;

  if (kind === "plan") {
    if (!getPlan(itemId)) return { error: "Unknown plan." };
    await applyBillingEvent("mock", {
      type: "subscription_activated",
      eventId,
      userId: user.id,
      planId: itemId,
      providerSubscriptionId: `mock-sub-${user.id}`,
      providerCustomerId: `mock-cus-${user.id}`,
      periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    });
  } else {
    if (!getPack(itemId)) return { error: "Unknown pack." };
    await applyBillingEvent("mock", {
      type: "pack_purchased",
      eventId,
      userId: user.id,
      packId: itemId,
      providerCustomerId: `mock-cus-${user.id}`,
    });
  }

  revalidatePath("/account");
  redirect("/account?welcome=1");
}
