"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateSmsNotificationsEnabled } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SmsNotificationsToggleProps {
  enabled: boolean;
  gatewayConfigured: boolean;
}

export function SmsNotificationsToggle({
  enabled,
  gatewayConfigured,
}: SmsNotificationsToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    startTransition(async () => {
      const result = await updateSmsNotificationsEnabled({ enabled: next });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        next ? "SMS notifications enabled." : "SMS notifications disabled."
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Label htmlFor="sms-notifications-toggle" className="text-base">
          SMS notifications
        </Label>
        <p className="text-sm text-muted-foreground">
          When enabled, transactional SMS are sent alongside email for users with a
          phone number on their profile. Requires SMS gateway environment variables.
        </p>
        {!gatewayConfigured && (
          <p className="text-sm text-amber-400">
            Gateway not configured: set SMS_BASE_URL and SMS_APP_ID in your deployment
            environment.
          </p>
        )}
      </div>
      <Button
        id="sms-notifications-toggle"
        type="button"
        variant={enabled ? "default" : "outline"}
        disabled={isPending || (!gatewayConfigured && !enabled)}
        onClick={handleToggle}
        className="shrink-0"
      >
        {enabled ? "Enabled" : "Disabled"}
      </Button>
    </div>
  );
}
