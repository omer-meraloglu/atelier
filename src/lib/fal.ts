import "server-only";

import { fal } from "@fal-ai/client";

let configured = false;

/** fal client, configured lazily with the server-side key. Never import from client code. */
export function getFal() {
  if (!configured) {
    const key = process.env.FAL_KEY;
    if (!key) {
      throw new Error("FAL_KEY is not set");
    }
    fal.config({ credentials: key });
    configured = true;
  }
  return fal;
}
