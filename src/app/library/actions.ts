"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { ASSETS_BUCKET } from "@/lib/storage";

const registerAssetSchema = z.object({
  kind: z.enum(["model", "product"]),
  storagePath: z.string().min(1).max(1024),
  label: z.string().trim().max(120),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export type RegisterAssetInput = z.infer<typeof registerAssetSchema>;

/**
 * Called after the browser uploads a file to storage (scoped by storage RLS
 * to the user's folder); records the asset row.
 */
export async function registerAsset(input: RegisterAssetInput) {
  const { supabase, user } = await requireUser();
  const parsed = registerAssetSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid upload details." };
  }

  const { kind, storagePath, label, width, height } = parsed.data;

  // The browser client can only write inside its own folder, but never trust
  // the path it reports back.
  if (!storagePath.startsWith(`${user.id}/`)) {
    return { error: "Upload path does not belong to you." };
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      kind,
      storage_path: storagePath,
      label: label || "Untitled",
      width,
      height,
    })
    .select()
    .single();

  if (error) {
    return { error: "Could not save the asset." };
  }

  revalidatePath("/library");
  return { asset: data };
}

const renameSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
});

export async function renameAsset(input: { id: string; label: string }) {
  const { supabase, user } = await requireUser();
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Labels are 1–120 characters." };
  }

  const { error } = await supabase
    .from("assets")
    .update({ label: parsed.data.label })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not rename the asset." };
  }

  revalidatePath("/library");
  return {};
}

export async function deleteAsset(input: { id: string }) {
  const { supabase, user } = await requireUser();
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid asset." };
  }

  const { data: asset, error: fetchError } = await supabase
    .from("assets")
    .select("id, storage_path, thumbnail_path")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !asset) {
    return { error: "Asset not found." };
  }

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", asset.id)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not delete the asset." };
  }

  const paths = [asset.storage_path, asset.thumbnail_path].filter(
    (p): p is string => Boolean(p)
  );
  if (paths.length > 0) {
    // Best effort: an orphaned object is invisible (private bucket) and cheap.
    await supabase.storage.from(ASSETS_BUCKET).remove(paths);
  }

  revalidatePath("/library");
  return {};
}
