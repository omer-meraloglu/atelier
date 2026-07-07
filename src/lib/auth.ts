import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Resolve the signed-in user in a server component/action, or bounce to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}
