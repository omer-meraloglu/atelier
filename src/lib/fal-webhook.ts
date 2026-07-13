import "server-only";

import { createHash, createPublicKey, verify as edVerify } from "node:crypto";

/**
 * fal webhook authenticity check, per fal's spec:
 * message = requestId \n userId \n timestamp \n sha256(rawBody) — signed
 * with ED25519; public keys served from their JWKS endpoint.
 */

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const JWKS_MAX_AGE_MS = 12 * 60 * 60 * 1000; // spec allows up to 24h
const TIMESTAMP_LEEWAY_S = 300;

let jwksCache: { keys: { x: string }[]; fetchedAt: number } | null = null;

async function getJwksKeys(): Promise<{ x: string }[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_MAX_AGE_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status}`);
  }
  const body = (await res.json()) as { keys?: { x?: string }[] };
  const keys = (body.keys ?? []).filter(
    (k): k is { x: string } => typeof k.x === "string"
  );
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

export async function verifyFalWebhook(
  headers: Headers,
  rawBody: Uint8Array
): Promise<boolean> {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signature = headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signature) {
    return false;
  }

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > TIMESTAMP_LEEWAY_S) {
    return false;
  }

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = Buffer.from(
    [requestId, userId, timestamp, bodyHash].join("\n"),
    "utf-8"
  );

  let sig: Buffer;
  try {
    sig = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  let keys: { x: string }[];
  try {
    keys = await getJwksKeys();
  } catch {
    return false;
  }

  for (const jwk of keys) {
    try {
      const key = createPublicKey({
        key: { kty: "OKP", crv: "Ed25519", x: jwk.x },
        format: "jwk",
      });
      if (edVerify(null, message, key, sig)) {
        return true;
      }
    } catch {
      // try the next key
    }
  }
  return false;
}
