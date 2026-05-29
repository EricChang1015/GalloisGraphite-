"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin");
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
        next ? t("settings.notifications.enabledToast") : t("settings.notifications.disabledToast")
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Label htmlFor="sms-notifications-toggle" className="text-base">
          {t("settings.notifications.smsLabel")}
        </Label>
        <p className="text-sm text-muted-foreground">
          {t("settings.notifications.smsHint")}
        </p>
        {!gatewayConfigured && (
          <p className="text-sm text-amber-400">
            {t("settings.notifications.gatewayNotConfigured")}
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
        {enabled ? t("settings.notifications.enabled") : t("settings.notifications.disabled")}
      </Button>
    </div>
  );
}
