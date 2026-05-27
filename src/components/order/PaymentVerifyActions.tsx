"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { verifyPayment } from "@/actions/payment";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PaymentVerifyActionsProps {
  paymentId: string;
  /**
   * Localized reviewer role label used in the placeholder. The server
   * action enforces real authorization (seller of this order OR admin).
   */
  reviewerLabel?: string;
}

export function PaymentVerifyActions({
  paymentId,
  reviewerLabel,
}: PaymentVerifyActionsProps) {
  const router = useRouter();
  const t = useTranslations("orders.paymentVerify");
  const tFallback = useTranslations("orders.detail.payment.reviewerLabel");
  const reviewer = reviewerLabel ?? tFallback("seller");
  const [isPending, startTransition] = useTransition();
  const { register, getValues } = useForm({ defaultValues: { note: "" } });

  function handle(decision: "verified" | "rejected") {
    startTransition(async () => {
      const result = await verifyPayment(paymentId, decision, getValues("note"));
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(decision === "verified" ? t("toast.verified") : t("toast.rejected"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        {...register("note")}
        rows={2}
        placeholder={t("reviewerNotePlaceholder", { role: reviewer })}
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handle("verified")} disabled={isPending}>
          {t("verify")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handle("rejected")}
          disabled={isPending}
        >
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}
