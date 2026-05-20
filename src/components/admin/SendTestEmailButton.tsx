"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { sendTestEmail } from "@/actions/admin";
import { Button } from "@/components/ui/button";

export function SendTestEmailButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendTestEmail();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        `Test email sent to ${result.data!.to}` +
          (result.data!.messageId ? ` (id: ${result.data!.messageId})` : "")
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <Mail className="size-3.5 mr-1.5" />
      {isPending ? "Sending…" : "Send test email"}
    </Button>
  );
}
