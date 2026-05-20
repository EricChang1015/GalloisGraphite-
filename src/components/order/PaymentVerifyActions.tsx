"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { verifyPayment } from "@/actions/payment";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PaymentVerifyActionsProps {
  paymentId: string;
  /**
   * Reviewer role label shown in the placeholder + toast. The server
   * action enforces real authorization (seller of this order OR admin).
   */
  reviewerLabel?: "Admin" | "Seller";
}

export function PaymentVerifyActions({
  paymentId,
  reviewerLabel = "Seller",
}: PaymentVerifyActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { register, getValues } = useForm({ defaultValues: { note: "" } });

  function handle(decision: "verified" | "rejected") {
    startTransition(async () => {
      const result = await verifyPayment(paymentId, decision, getValues("note"));
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Payment ${decision}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        {...register("note")}
        rows={2}
        placeholder={`${reviewerLabel} note (optional)`}
        className="text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handle("verified")} disabled={isPending}>
          Verify
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handle("rejected")}
          disabled={isPending}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
