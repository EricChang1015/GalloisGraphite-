"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { draftContract } from "@/actions/order";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INCOTERMS,
  PaymentScheduleArraySchema,
  assertSchedulesCompatibleWithIncoterm,
  type Incoterm,
  type PaymentScheduleEntry,
} from "@/lib/validations/payment-schedule";

import { PaymentScheduleBuilder } from "./PaymentScheduleBuilder";

interface ContractDraftFormProps {
  orderId: string;
  totalAmount: number;
  currency: string;
  /** Currently snapshot incoterm on the order, if any. */
  currentIncoterm?: Incoterm | null;
  /** Existing payment-schedule snapshot for re-draft mode. */
  currentSchedule?: PaymentScheduleEntry[];
  /** When re-drafting, current revision number to display. */
  currentRevision?: number;
}

export function ContractDraftForm({
  orderId,
  totalAmount,
  currency,
  currentIncoterm,
  currentSchedule,
  currentRevision,
}: ContractDraftFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isRedraft = (currentRevision ?? 0) >= 1;

  const [incoterm, setIncoterm] = useState<Incoterm>(currentIncoterm ?? "CFR");
  const [schedule, setSchedule] = useState<PaymentScheduleEntry[]>(
    currentSchedule && currentSchedule.length > 0
      ? currentSchedule
      : [{ category: "prepayment", milestone: "contract_signed", percentage: 100 }]
  );

  const sum = schedule.reduce((a, e) => a + (Number(e.percentage) || 0), 0);
  const sumOk = Math.abs(sum - 100) < 0.01;

  function onSubmit() {
    // Local validation before round-trip
    const arrayParse = PaymentScheduleArraySchema.safeParse(schedule);
    if (!arrayParse.success) {
      const first = arrayParse.error.issues[0];
      toast.error(first?.message ?? "Schedule is invalid.");
      return;
    }
    const incompat = assertSchedulesCompatibleWithIncoterm(arrayParse.data, incoterm);
    if (incompat) {
      toast.error(incompat);
      return;
    }

    startTransition(async () => {
      const result = await draftContract({
        order_id: orderId,
        incoterm,
        payment_schedule: arrayParse.data,
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        isRedraft
          ? `Contract revision ${result.data!.revision} drafted.`
          : "Contract drafted. Buyer can now review."
      );
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">
          {isRedraft
            ? `Re-draft Contract (Revision ${(currentRevision ?? 0) + 1})`
            : "Draft Contract"}
        </p>
        <p className="text-xs text-muted-foreground">
          Pick the Incoterm and break the payment into multiple installments. Each
          installment becomes payable when its milestone is reached.
        </p>
      </div>

      <div className="grid gap-2 sm:max-w-xs">
        <Label className="text-xs">Incoterm</Label>
        <Select
          value={incoterm}
          onValueChange={(v) => setIncoterm(v as Incoterm)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCOTERMS.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Changing the Incoterm filters which Regular-Payment milestones are
          available; you may need to revise rows below.
        </p>
      </div>

      <PaymentScheduleBuilder
        incoterm={incoterm}
        value={schedule}
        onChange={setSchedule}
        totalAmount={totalAmount}
        currency={currency}
      />

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={isPending || !sumOk || schedule.length === 0}
        >
          {isPending
            ? "Drafting…"
            : isRedraft
              ? "Re-draft Contract"
              : "Draft Contract"}
        </Button>
      </div>
    </div>
  );
}
