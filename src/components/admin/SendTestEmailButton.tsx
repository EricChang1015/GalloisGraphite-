"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail } from "lucide-react";

import { sendTestEmail } from "@/actions/admin";
import { Button } from "@/components/ui/button";

export function SendTestEmailButton() {
  const t = useTranslations("admin");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await sendTestEmail();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      const { to, messageId } = result.data!;
      toast.success(
        messageId
          ? t("settings.email.sentWithId", { to, messageId })
          : t("settings.email.sent", { to })
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
      {isPending ? t("settings.email.sending") : t("settings.email.sendTest")}
    </Button>
  );
}
