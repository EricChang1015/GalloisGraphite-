"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  myRole: "buyer" | "seller";
  defaults?: Partial<z.infer<typeof QuotationInputSchema>>;
}

export function QuotationActions({
  quotationId,
  inquiryId,
  myRole,
  defaults,
}: QuotationActionsProps) {
  const router = useRouter();
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
      toast.success("Quotation accepted. Order created.");
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
      toast.success("Quotation rejected.");
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Buyer can accept; seller cannot accept their own quotation */}
      {myRole === "buyer" && (
        <Button size="sm" onClick={handleAccept} disabled={isPending}>
          <Check className="size-3.5 mr-1" />
          Accept
        </Button>
      )}

      {/* Either party can counter */}
      <Dialog open={counterOpen} onOpenChange={setCounterOpen}>
        <DialogTrigger
          render={<Button size="sm" variant="outline" disabled={isPending} />}
        >
          <RefreshCw className="size-3.5 mr-1" />
          Counter
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Counter-offer</DialogTitle>
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
          Decline
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={3}
              placeholder="Optional reason for declining…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={isPending}>
                Confirm Decline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
