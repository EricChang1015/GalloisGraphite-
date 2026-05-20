"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { forceTransitionOrder } from "@/actions/order";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUS_LABEL,
  type OrderStatus,
} from "@/lib/order/stateMachine";

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

const ALL_STATUSES: OrderStatus[] = [
  "quotation_pending",
  "draft",
  "quoted",
  "negotiating",
  "contract_pending",
  "contract_generated",
  "contract_signed",
  "payment_pending",
  "paid",
  "in_production",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "arrived",
  "customs_cleared",
  "completed",
  "disputed",
  "cancelled",
];

export function AdminOrderActions({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState<OrderStatus>(currentStatus);
  const [reason, setReason] = useState("");

  function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Reason is required for force transitions.");
      return;
    }
    if (target === currentStatus) {
      toast.error("Target status is the same as current.");
      return;
    }
    startTransition(async () => {
      const result = await forceTransitionOrder(orderId, target, reason);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Order force-transitioned to ${target}.`);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-yellow-400">Admin: Force Transition</p>
        <p className="text-xs text-muted-foreground">
          Bypasses the state machine. All actions are recorded in audit_logs.
          Use only for dispute resolution or recovery.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Current Status</Label>
          <p className="text-sm font-medium mt-1">{STATUS_LABEL[currentStatus]}</p>
        </div>
        <div>
          <Label className="text-xs" htmlFor="target-status">Target Status</Label>
          <Select value={target} onValueChange={(v) => setTarget(v as OrderStatus)}>
            <SelectTrigger id="target-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s} disabled={s === currentStatus}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs" htmlFor="reason">Reason (required, audit-logged)</Label>
        <Textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this manual transition needed?"
        />
      </div>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending || !reason.trim() || target === currentStatus}
        onClick={handleSubmit}
      >
        {isPending ? "Transitioning…" : "Force Transition"}
      </Button>
    </div>
  );
}
