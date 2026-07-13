"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updatePassword,
  type UpdatePasswordState,
} from "@/app/login/actions";

const initialState: UpdatePasswordState = { status: "idle" };

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="h-11 rounded-none"
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm leading-relaxed text-oxblood">
          {state.message}
        </p>
      )}
    </form>
  );
}
