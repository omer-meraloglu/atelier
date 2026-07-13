"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  signIn,
  signInWithGoogle,
  signUpWithPassword,
  type AuthFormState,
} from "./actions";

const initialState: AuthFormState = { status: "idle" };

function SentNote({ title, email, body }: { title: string; email: string; body: string }) {
  return (
    <div className="animate-reveal border hairline bg-card p-8">
      <p className="text-label text-muted-foreground">{title}</p>
      <p className="mt-4 text-sm leading-relaxed">
        <span className="font-medium">{email}</span> — {body}
      </p>
    </div>
  );
}

function GoogleAlternate() {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-label text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" className="w-full" size="lg">
          Continue with Google
        </Button>
      </form>
    </>
  );
}

function SignInPane({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  if (state.status === "sent-magic") {
    return (
      <SentNote
        title="Check your inbox"
        email={state.email}
        body="we sent a sign-in link. It expires in an hour."
      />
    );
  }
  if (state.status === "sent-reset") {
    return (
      <SentNote
        title="Check your inbox"
        email={state.email}
        body="if that address has an account, a password-reset link is on its way."
      />
    );
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="grid gap-2">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@maison.com"
            className="h-11 rounded-none"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="signin-password">Password</Label>
          <Input
            id="signin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 rounded-none"
          />
        </div>
        <Button
          type="submit"
          name="intent"
          value="password"
          className="w-full"
          size="lg"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex items-center justify-between">
          <button
            type="submit"
            name="intent"
            value="reset"
            disabled={pending}
            className="text-label text-muted-foreground transition-colors duration-300 hover:text-foreground disabled:opacity-40"
          >
            Forgot password?
          </button>
          <button
            type="submit"
            name="intent"
            value="magic"
            disabled={pending}
            className="text-label text-muted-foreground transition-colors duration-300 hover:text-foreground disabled:opacity-40"
          >
            Email me a link instead
          </button>
        </div>
      </form>

      <GoogleAlternate />

      {state.status === "error" && (
        <p role="alert" className="text-sm leading-relaxed text-oxblood">
          {state.message}
        </p>
      )}
    </div>
  );
}

function SignUpPane({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signUpWithPassword,
    initialState
  );

  if (state.status === "sent-confirmation") {
    return (
      <SentNote
        title="One more step"
        email={state.email}
        body="confirm your email with the link we just sent, then sign in."
      />
    );
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="grid gap-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@maison.com"
            className="h-11 rounded-none"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="h-11 rounded-none"
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={pending}
        >
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <GoogleAlternate />

      {state.status === "error" && (
        <p role="alert" className="text-sm leading-relaxed text-oxblood">
          {state.message}
        </p>
      )}
    </div>
  );
}

export function LoginForm({
  serverError,
  next,
}: {
  serverError?: string;
  next?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="space-y-8">
      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList className="w-full" aria-label="Sign in or create account">
          <TabsTrigger value="signin" className="flex-1">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">
            Create account
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "signin" ? <SignInPane next={next} /> : <SignUpPane next={next} />}

      {serverError && (
        <p role="alert" className="text-sm leading-relaxed text-oxblood">
          {serverError}
        </p>
      )}
    </div>
  );
}
