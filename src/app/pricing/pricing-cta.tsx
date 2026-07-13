"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { startCheckout } from "@/app/billing/actions";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  kind,
  itemId,
  label,
  variant = "default",
}: {
  kind: "plan" | "pack";
  itemId: string;
  label: string;
  variant?: "default" | "outline";
}) {
  const [pending, startTransition] = useTransition();
  const [, setError] = useState<string | null>(null);

  function go() {
    startTransition(async () => {
      const res = await startCheckout({ kind, itemId });
      if (res && "error" in res) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      className="w-full"
      variant={variant}
      size="lg"
      onClick={go}
      disabled={pending}
    >
      {pending ? "One moment…" : label}
    </Button>
  );
}
