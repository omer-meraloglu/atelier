import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import {
  FREE_SIGNUP_CREDITS,
  getPack,
  getPlan,
  type Plan,
} from "./plans";
import type { NormalizedBillingEvent } from "./provider";

type Client = SupabaseClient<Database>;

export interface CreditState {
  balance: number;
  plan: Plan;
  videoEnabled: boolean;
  subscriptionStatus: string | null;
}

/**
 * The user's effective billing state. Also lazily seeds the one-time
 * signup grant — the partial unique index makes double grants impossible,
 * so this is safe to call from anywhere.
 */
export async function getCreditState(
  supabase: Client,
  userId: string
): Promise<CreditState> {
  await ensureSignupGrant(userId);

  const [{ data: balance }, { data: subs }] = await Promise.all([
    supabase.rpc("credit_balance", {}),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const activeSub = subs?.[0] ?? null;
  const plan = (activeSub && getPlan(activeSub.plan_id)) || getPlan("free")!;

  return {
    balance: typeof balance === "number" ? balance : 0,
    plan,
    videoEnabled: plan.videoEnabled,
    subscriptionStatus: activeSub?.status ?? null,
  };
}

async function ensureSignupGrant(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("reason", "free_signup");
  if ((count ?? 0) > 0) return;
  // The credit_ledger_signup_grant unique index turns races into no-ops.
  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: FREE_SIGNUP_CREDITS,
    reason: "free_signup",
  });
}

/**
 * Atomic spend via the security-definer function; the caller's session
 * pins the user. Returns false when the balance is short.
 */
export async function spendCredits(
  supabase: Client,
  amount: number,
  reason: string,
  referenceId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("spend_credits", {
    p_amount: amount,
    p_reason: reason,
    p_reference: referenceId,
  });
  if (error) return false;
  return data === true;
}

/**
 * Compensating credit for a failed generation. Idempotent per reference —
 * the partial unique index rejects a second refund for the same render no
 * matter which poller/webhook gets there first.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  referenceId: string
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: amount,
    reason: "refund",
    reference_id: referenceId,
  });
}

/**
 * Refund exactly what a failed generation spent, if it spent anything.
 * Looks up the original debit; the unique (user, 'refund', reference)
 * index makes double-compensation impossible even when the watcher, the
 * webhook and a poll tick all fail the same row.
 */
export async function refundSpentCredits(
  userId: string,
  spendReason: string,
  referenceId: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: spend } = await admin
    .from("credit_ledger")
    .select("delta")
    .eq("user_id", userId)
    .eq("reason", spendReason)
    .eq("reference_id", referenceId)
    .limit(1)
    .maybeSingle();

  if (!spend || spend.delta >= 0) return;

  await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: -spend.delta,
    reason: "refund",
    reference_id: referenceId,
  });
}

/**
 * Applies a normalized billing event exactly once (billing_events is the
 * idempotency memory). Used by the real webhook and the dev mock checkout,
 * so both paths exercise identical logic.
 */
export async function applyBillingEvent(
  providerId: string,
  event: NormalizedBillingEvent
): Promise<{ applied: boolean }> {
  const admin = createAdminClient();

  // Claim the event id; a duplicate delivery stops here.
  const { error: claimError } = await admin.from("billing_events").insert({
    event_id: event.eventId,
    provider: providerId,
    event_type: event.type,
  });
  if (claimError) {
    return { applied: false };
  }

  if (
    event.type === "subscription_activated" ||
    event.type === "subscription_renewed"
  ) {
    const plan = getPlan(event.planId);
    if (!plan) return { applied: false };

    if (event.providerCustomerId) {
      await admin.from("billing_customers").upsert(
        {
          user_id: event.userId,
          provider: providerId,
          provider_customer_id: event.providerCustomerId,
        },
        { onConflict: "user_id" }
      );
    }

    if (event.type === "subscription_activated") {
      // Expire any previous plan, then record the new one.
      await admin
        .from("subscriptions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("user_id", event.userId)
        .eq("status", "active");
      await admin.from("subscriptions").insert({
        user_id: event.userId,
        provider: providerId,
        provider_subscription_id: event.providerSubscriptionId,
        plan_id: plan.id,
        status: "active",
        current_period_end: event.periodEnd,
      });
    } else if (event.periodEnd || event.providerSubscriptionId) {
      await admin
        .from("subscriptions")
        .update({
          current_period_end: event.periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", event.userId)
        .eq("status", "active");
    }

    // Monthly credits; unique (user, reason, reference) makes replays no-ops.
    await admin.from("credit_ledger").insert({
      user_id: event.userId,
      delta: plan.monthlyCredits,
      reason: "subscription_grant",
      reference_id: event.eventId,
    });
    return { applied: true };
  }

  if (event.type === "subscription_canceled") {
    const query = admin
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() });
    if (event.providerSubscriptionId) {
      await query.eq("provider_subscription_id", event.providerSubscriptionId);
    } else if (event.userId) {
      await query.eq("user_id", event.userId).eq("status", "active");
    }
    // Banked credits remain spendable — only the granting stops.
    return { applied: true };
  }

  if (event.type === "pack_purchased") {
    const pack = getPack(event.packId);
    if (!pack) return { applied: false };
    await admin.from("credit_ledger").insert({
      user_id: event.userId,
      delta: pack.credits,
      reason: "pack_purchase",
      reference_id: event.eventId,
    });
    return { applied: true };
  }

  return { applied: false };
}
