"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(320);
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Passwords max out at 72 characters.");

export type AuthFormState =
  | { status: "idle" }
  | { status: "sent-magic"; email: string }
  | { status: "sent-reset"; email: string }
  | { status: "sent-confirmation"; email: string }
  | { status: "error"; message: string };

async function siteOrigin() {
  // Explicit override wins — set NEXT_PUBLIC_SITE_URL in production so
  // auth emails always point at the canonical domain.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Only same-site paths; anything else falls back to the studio. */
function safeNext(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

function friendlySignInError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "Email or password is wrong. If you signed up with a magic link, use “Email me a link” or set a password via “Forgot password”.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Your email isn't confirmed yet — check your inbox for the confirmation link.";
  }
  return message;
}

/**
 * The sign-in form's dispatcher: one form, three intents
 * (password / magic link / password reset), so the typed email serves all
 * three buttons.
 */
export async function signIn(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const intent = formData.get("intent");
  const emailParsed = emailSchema.safeParse(formData.get("email"));
  if (!emailParsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const email = emailParsed.data;

  const supabase = await createClient();
  const origin = await siteOrigin();

  if (intent === "magic") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/confirm` },
    });
    if (error) return { status: "error", message: error.message };
    return { status: "sent-magic", email };
  }

  if (intent === "reset") {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/auth/update-password`,
    });
    // Deliberately the same answer whether or not the account exists.
    return { status: "sent-reset", email };
  }

  // Default: password sign-in.
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    return { status: "error", message: "Enter your password." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return { status: "error", message: friendlySignInError(error.message) };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const emailParsed = emailSchema.safeParse(formData.get("email"));
  if (!emailParsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const passwordParsed = passwordSchema.safeParse(formData.get("password"));
  if (!passwordParsed.success) {
    return {
      status: "error",
      message: passwordParsed.error.issues[0]?.message ?? "Invalid password.",
    };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signUp({
    email: emailParsed.data,
    password: passwordParsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    if (/already registered/i.test(error.message)) {
      return {
        status: "error",
        message: "That email already has an account — sign in instead.",
      };
    }
    return { status: "error", message: error.message };
  }

  // Supabase returns an obfuscated user with no identities when the email
  // is already registered (anti-enumeration); surface it honestly here
  // since our sign-in tab is one click away.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return {
      status: "error",
      message: "That email already has an account — sign in instead.",
    };
  }

  // Confirmations off (e.g. some local setups) → session exists already.
  if (data.session) {
    redirect(safeNext(formData.get("next")));
  }

  return { status: "sent-confirmation", email: emailParsed.data };
}

export type UpdatePasswordState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function updatePassword(
  _prev: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const passwordParsed = passwordSchema.safeParse(formData.get("password"));
  if (!passwordParsed.success) {
    return {
      status: "error",
      message: passwordParsed.error.issues[0]?.message ?? "Invalid password.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=Your reset link expired — request a new one");
  }

  const { error } = await supabase.auth.updateUser({
    password: passwordParsed.data,
  });
  if (error) {
    return { status: "error", message: error.message };
  }

  redirect("/studio");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
