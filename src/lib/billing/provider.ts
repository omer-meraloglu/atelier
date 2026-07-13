import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getPack, getPlan } from "./plans";

/**
 * Billing adapter layer, mirroring the fal provider-registry pattern.
 * Stripe doesn't onboard Turkey-based merchants, so the default real
 * provider is Paddle (Merchant of Record); iyzico/PayTR would be a future
 * adapter behind this same interface.
 */

export interface CheckoutRequest {
  userId: string;
  email: string;
  kind: "plan" | "pack";
  itemId: string;
  origin: string;
}

export type NormalizedBillingEvent =
  | {
      type: "subscription_activated" | "subscription_renewed";
      eventId: string;
      userId: string;
      planId: string;
      providerSubscriptionId: string | null;
      providerCustomerId: string | null;
      periodEnd: string | null;
    }
  | {
      type: "subscription_canceled";
      eventId: string;
      userId: string | null;
      providerSubscriptionId: string | null;
    }
  | {
      type: "pack_purchased";
      eventId: string;
      userId: string;
      packId: string;
      providerCustomerId: string | null;
    };

export interface BillingProvider {
  id: string;
  /** Hosted checkout URL for a plan or pack. */
  createCheckoutUrl(request: CheckoutRequest): Promise<string>;
  /** Provider-hosted manage-billing portal, when one exists. */
  getPortalUrl(providerCustomerId: string): Promise<string | null>;
  /**
   * Verify a webhook request's authenticity and normalize its events.
   * Throws on invalid signatures.
   */
  parseWebhook(rawBody: string, headers: Headers): Promise<NormalizedBillingEvent[]>;
}

/* ————————————————— mock (dev-only) ————————————————— */

/**
 * Dev-only: "checkout" is a local confirmation page; completing it applies
 * the same normalized events the webhook would. Gated behind
 * ENABLE_MOCK_PROVIDER, like the mock fal models.
 */
const mockBilling: BillingProvider = {
  id: "mock",
  async createCheckoutUrl({ kind, itemId, origin }) {
    return `${origin}/billing/mock-checkout?kind=${kind}&item=${encodeURIComponent(itemId)}`;
  },
  async getPortalUrl() {
    return null; // the /account page itself is the "portal" in dev
  },
  async parseWebhook() {
    throw new Error("The mock provider does not receive webhooks.");
  },
};

/* ————————————————— Paddle ————————————————— */

function paddleApiBase(): string {
  return process.env.PADDLE_ENV === "live"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

function paddleKey(): string {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY is not set");
  return key;
}

function resolvePriceId(envName: string | undefined, itemId: string): string {
  const priceId = envName ? process.env[envName] : undefined;
  if (!priceId) {
    throw new Error(`No Paddle price configured for "${itemId}" (${envName})`);
  }
  return priceId;
}

async function paddleRequest(
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${paddleApiBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paddleKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data?: Record<string, unknown>; error?: { detail?: string } };
  if (!res.ok || !json.data) {
    throw new Error(json.error?.detail ?? `Paddle request failed (${res.status})`);
  }
  return json.data;
}

/** Paddle-Signature: `ts=...;h1=...`, HMAC-SHA256 over `${ts}:${rawBody}`. */
function verifyPaddleSignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const parts = Object.fromEntries(
    header.split(";").map((p) => p.split("=", 2) as [string, string])
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const expected = createHmac("sha256", secret)
    .update(`${ts}:${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(h1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

interface PaddleWebhookEnvelope {
  event_id: string;
  event_type: string;
  data: {
    id?: string;
    status?: string;
    customer_id?: string;
    subscription_id?: string;
    custom_data?: { user_id?: string; kind?: string; item_id?: string };
    current_billing_period?: { ends_at?: string };
    origin?: string;
    items?: {
      price?: { id?: string; custom_data?: { item_id?: string } };
    }[];
  };
}

function planIdFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  for (const plan of ["starter", "studio"] as const) {
    if (process.env[getPlan(plan)!.paddlePriceEnv!] === priceId) return plan;
  }
  return null;
}

function packIdFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null;
  for (const pack of ["pack-100", "pack-500"]) {
    if (process.env[getPack(pack)!.paddlePriceEnv!] === priceId) return pack;
  }
  return null;
}

const paddleBilling: BillingProvider = {
  id: "paddle",

  async createCheckoutUrl({ userId, email, kind, itemId }) {
    const item = kind === "plan" ? getPlan(itemId) : getPack(itemId);
    if (!item) throw new Error(`Unknown ${kind} "${itemId}"`);
    const priceId = resolvePriceId(
      (item as { paddlePriceEnv?: string }).paddlePriceEnv,
      itemId
    );

    const data = await paddleRequest("/transactions", {
      items: [{ price_id: priceId, quantity: 1 }],
      custom_data: { user_id: userId, kind, item_id: itemId },
      customer: { email },
      collection_mode: "automatic",
    });

    const checkout = data.checkout as { url?: string } | undefined;
    if (!checkout?.url) {
      throw new Error(
        "Paddle returned no checkout URL — configure a default payment link in the Paddle dashboard."
      );
    }
    return checkout.url;
  },

  async getPortalUrl(providerCustomerId: string) {
    try {
      const data = await paddleRequest("/customer-portal-sessions", {
        customer_id: providerCustomerId,
      });
      const urls = data.urls as { general?: { overview?: string } } | undefined;
      return urls?.general?.overview ?? null;
    } catch {
      return null;
    }
  },

  async parseWebhook(rawBody: string, headers: Headers) {
    const signature =
      headers.get("paddle-signature") ?? headers.get("Paddle-Signature");
    if (!verifyPaddleSignature(rawBody, signature)) {
      throw new Error("Invalid Paddle signature");
    }

    const envelope = JSON.parse(rawBody) as PaddleWebhookEnvelope;
    const { event_id: eventId, event_type: eventType, data } = envelope;
    const userId = data.custom_data?.user_id ?? null;
    const events: NormalizedBillingEvent[] = [];

    if (eventType === "subscription.activated" && userId) {
      const priceId = data.items?.[0]?.price?.id;
      const planId = planIdFromPriceId(priceId);
      if (planId) {
        events.push({
          type: "subscription_activated",
          eventId,
          userId,
          planId,
          providerSubscriptionId: data.id ?? null,
          providerCustomerId: data.customer_id ?? null,
          periodEnd: data.current_billing_period?.ends_at ?? null,
        });
      }
    } else if (eventType === "subscription.canceled") {
      events.push({
        type: "subscription_canceled",
        eventId,
        userId,
        providerSubscriptionId: data.id ?? null,
      });
    } else if (eventType === "transaction.completed") {
      const priceId = data.items?.[0]?.price?.id;
      const packId = packIdFromPriceId(priceId);
      const planId = planIdFromPriceId(priceId);
      if (packId && userId) {
        events.push({
          type: "pack_purchased",
          eventId,
          userId,
          packId,
          providerCustomerId: data.customer_id ?? null,
        });
      } else if (
        planId &&
        userId &&
        data.origin === "subscription_recurring"
      ) {
        // Renewal charge → fresh monthly grant.
        events.push({
          type: "subscription_renewed",
          eventId,
          userId,
          planId,
          providerSubscriptionId: data.subscription_id ?? null,
          providerCustomerId: data.customer_id ?? null,
          periodEnd: null,
        });
      }
      // The initial subscription charge is covered by subscription.activated.
    }

    return events;
  },
};

/* ————————————————— registry ————————————————— */

const providers: BillingProvider[] = [
  paddleBilling,
  ...(process.env.ENABLE_MOCK_PROVIDER === "1" ? [mockBilling] : []),
];

export function getBillingProvider(): BillingProvider {
  const configured = process.env.BILLING_PROVIDER;
  const fallback =
    process.env.ENABLE_MOCK_PROVIDER === "1" ? "mock" : "paddle";
  const id = configured || fallback;
  const provider = providers.find((p) => p.id === id);
  if (!provider) {
    throw new Error(`Unknown billing provider "${id}"`);
  }
  return provider;
}
