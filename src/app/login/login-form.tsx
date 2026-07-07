"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, signInWithGoogle, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ serverError }: { serverError?: string }) {
  const [state, formAction, pending] = useActionState(
    sendMagicLink,
    initialState
  );

  if (state.status === "sent") {
    return (
      <div className="animate-reveal border hairline bg-card p-8">
        <p className="text-label text-muted-foreground">Check your inbox</p>
        <p className="mt-4 text-sm leading-relaxed">
          We sent a sign-in link to{" "}
          <span className="font-medium">{state.email}</span>. It expires in an
          hour — open it on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@maison.com"
            className="h-11 rounded-none"
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Sending link…" : "Send magic link"}
        </Button>
      </form>

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

      {(state.status === "error" || serverError) && (
        <p role="alert" className="text-sm text-oxblood">
          {state.status === "error" ? state.message : serverError}
        </p>
      )}
    </div>
  );
}
