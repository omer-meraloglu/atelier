import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifyFalWebhook } from "@/lib/fal-webhook";
import { getVideoProvider } from "@/lib/providers/video";
import { createAdminClient } from "@/lib/supabase/admin";
import { failVideoRow, storeAndSucceedVideoRow } from "@/lib/video-jobs";

const webhookBody = z.object({
  request_id: z.string().min(1),
  status: z.enum(["OK", "ERROR"]),
  payload: z.unknown().optional(),
  error: z.string().nullish(),
});

/**
 * fal queue completion webhook. Finalizes clips server-side so a render
 * finishes even when no browser tab is open. Polling remains as the
 * fallback for local dev (fal cannot reach localhost) and the mock provider.
 */
export async function POST(request: NextRequest) {
  const rawBody = new Uint8Array(await request.arrayBuffer());

  if (!(await verifyFalWebhook(request.headers, rawBody))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: z.infer<typeof webhookBody>;
  try {
    body = webhookBody.parse(JSON.parse(Buffer.from(rawBody).toString("utf-8")));
  } catch {
    return NextResponse.json({ error: "malformed body" }, { status: 400 });
  }

  // Service-role client: webhooks carry no user session. The row's own
  // user_id scopes every write.
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("video_generations")
    .select("*")
    .eq("params->>requestId", body.request_id)
    .maybeSingle();

  // Unknown or already-final rows are acked so fal stops retrying.
  if (!row || row.status === "succeeded" || row.status === "failed") {
    return NextResponse.json({ ok: true });
  }

  if (body.status === "ERROR") {
    await failVideoRow(
      admin,
      row,
      body.error || "The video model reported a failure."
    );
    revalidatePath("/history");
    return NextResponse.json({ ok: true });
  }

  const provider = getVideoProvider(row.provider_model_id);
  if (!provider) {
    await failVideoRow(admin, row, "The job reference was lost.");
    revalidatePath("/history");
    return NextResponse.json({ ok: true });
  }

  try {
    const videoUrl = provider.parseOutput(body.payload).videoUrl;
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error("The provider returned an unreadable video.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    await storeAndSucceedVideoRow(admin, row, bytes);
  } catch (err) {
    await failVideoRow(
      admin,
      row,
      err instanceof Error ? err.message : "Finalizing the clip failed."
    );
  }

  revalidatePath("/history");
  return NextResponse.json({ ok: true });
}
