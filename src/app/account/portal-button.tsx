"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortal } from "@/app/billing/actions";
import { Button } from "@/components/ui/button";

export function PortalButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await openBillingPortal();
          if (res && "error" in res) toast.error(res.error);
        })
      }
    >
      {pending ? "Opening…" : "Manage billing"}
    </Button>
  );
}
