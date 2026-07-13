import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { applyBillingEvent } from "@/lib/billing/credits";
import { getBillingProvider } from "@/lib/billing/provider";

/**
 * Provider-agnostic billing webhook. The adapter verifies the signature
 * and normalizes events; applyBillingEvent makes each one idempotent via
 * the billing_events table, so replayed deliveries never double-grant.
 */
export async function POST(request: NextRequest) {
  const provider = getBillingProvider();
  const rawBody = await request.text();

  let events;
  try {
    events = await provider.parseWebhook(rawBody, request.headers);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  for (const event of events) {
    await applyBillingEvent(provider.id, event);
  }

  if (events.length > 0) {
    revalidatePath("/account");
  }
  return NextResponse.json({ ok: true });
}
