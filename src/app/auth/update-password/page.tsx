import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "New password" };

export default async function UpdatePasswordPage() {
  // The recovery link creates a session; without one there is nothing to update.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=Your reset link expired — request a new one");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-2xl tracking-tight">
          Atelier
        </Link>
        <h1 className="font-display mt-10 text-3xl tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          For {user.email}. You&apos;ll land in the studio right after.
        </p>
        <div className="mt-10">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  );
}
