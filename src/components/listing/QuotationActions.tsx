"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Check, X, RefreshCw } from "lucide-react";

import { acceptQuotation, rejectQuotation } from "@/actions/quotation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { QuotationForm } from "./QuotationForm";
import type { z } from "zod";
import type { QuotationInputSchema } from "@/lib/validations/quotation";

interface QuotationActionsProps {
  quotationId: string;
  inquiryId: string;
  defaults?: Partial<z.infer<typeof QuotationInputSchema>>;
}

export function QuotationActions({
  quotationId,
  inquiryId,
  defaults,
}: QuotationActionsProps) {
  const router = useRouter();
  const t = useTranslations("listings.quotation.actions");
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [counterOpen, setCounterOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptQuotation(quotationId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("toast.accepted"));
      router.push(`/orders/${result.data.orderId}`);
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectQuotation({ quotation_id: quotationId, reason });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("toast.rejected"));
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Either party (whichever is the non-proposer for the live quotation)
          can accept. The parent component already hides this whole component
          for the proposer of the live offer. */}
      <Button size="sm" onClick={handleAccept} disabled={isPending}>
        <Check className="size-3.5 mr-1" />
        {t("accept")}
      </Button>

      {/* Either party can counter */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogTrigger
          render={<Button size="sm" variant="outline" disabled={isPending} />}
        >
          <RefreshCw className="size-3.5 mr-1" />
          {t("counter")}
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("counterTitle")}</DialogTitle>
          </DialogHeader>
          <QuotationForm
            inquiryId={inquiryId}
            parentQuotationId={quotationId}
            defaults={defaults}
            onDone={() => setCounterOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Either party can reject */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger
          render={<Button size="sm" variant="destructive" disabled={isPending} />}
        >
          <X className="size-3.5 mr-1" />
          {t("decline")}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("declineTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={3}
              placeholder={t("declineReasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={isPending}>
                {t("confirmDecline")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
