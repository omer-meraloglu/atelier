"use client";

import { useState, useTransition } from "react";

import { completeMockCheckout } from "@/app/billing/actions";
import { Button } from "@/components/ui/button";

export function MockCheckoutForm({
  kind,
  itemId,
}: {
  kind: "plan" | "pack";
  itemId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await completeMockCheckout({ kind, itemId });
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <Button size="lg" className="w-full" onClick={confirm} disabled={pending}>
        {pending ? "Completing…" : "Complete purchase"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-oxblood">
          {error}
        </p>
      )}
    </div>
  );
}
