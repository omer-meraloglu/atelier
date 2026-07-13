/**
 * The single tuning point for monetization: plans, packs, and what a
 * render costs. Client-safe (no secrets).
 *
 * Costs roughly track fal pricing: a try-on render is a few cents; a video
 * clip runs 20–50× that. 1 credit ≈ image, 20 ≈ clip keeps the mental
 * model simple and the margin honest.
 */

export type PlanId = "free" | "starter" | "studio";

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  videoEnabled: boolean;
  blurb: string;
  /** Paddle price id env var name (server resolves the value). */
  paddlePriceEnv?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Atelier Free",
    priceUsd: 0,
    monthlyCredits: 0, // one-time signup grant instead, see FREE_SIGNUP_CREDITS
    videoEnabled: false,
    blurb: "Ten renders to see the fit. No card, no clock.",
  },
  {
    id: "starter",
    name: "Starter",
    priceUsd: 9,
    monthlyCredits: 200,
    videoEnabled: true,
    blurb: "For a working wardrobe: 200 renders a month, clips included.",
    paddlePriceEnv: "PADDLE_PRICE_STARTER",
  },
  {
    id: "studio",
    name: "Studio",
    priceUsd: 29,
    monthlyCredits: 1000,
    videoEnabled: true,
    blurb: "For the whole collection: 1,000 renders a month, priority copy.",
    paddlePriceEnv: "PADDLE_PRICE_STUDIO",
  },
];

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  paddlePriceEnv?: string;
}

export const PACKS: CreditPack[] = [
  {
    id: "pack-100",
    name: "100 credits",
    credits: 100,
    priceUsd: 6,
    paddlePriceEnv: "PADDLE_PRICE_PACK_100",
  },
  {
    id: "pack-500",
    name: "500 credits",
    credits: 500,
    priceUsd: 25,
    paddlePriceEnv: "PADDLE_PRICE_PACK_500",
  },
];

export const CREDIT_COSTS = {
  image: 1,
  video: 20,
} as const;

export const FREE_SIGNUP_CREDITS = 10;

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function getPack(id: string): CreditPack | undefined {
  return PACKS.find((p) => p.id === id);
}
