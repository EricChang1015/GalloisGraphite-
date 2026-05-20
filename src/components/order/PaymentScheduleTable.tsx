"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitPayment } from "@/actions/payment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL,
  MILESTONE_LABEL,
  SCHEDULE_STATUS_LABEL,
  type PaymentCategory,
  type PaymentMilestone,
  type PaymentScheduleStatus,
} from "@/lib/validations/payment-schedule";

export interface ScheduleRow {
  id: string;
  sequence: number;
  category: PaymentCategory;
  milestone: PaymentMilestone;
  percentage: number;
  amount: number;
  currency: string;
  due_date: string | null;
  bl_offset_days: number | null;
  status: PaymentScheduleStatus;
  paid_payment_id: string | null;
  notes: string | null;
}

interface Props {
  orderId: string;
  schedules: ScheduleRow[];
  role: "buyer" | "seller" | "other";
  /** Hide rows below this index (used by the Overview tab summary). */
  limit?: number;
}

const STATUS_BADGE_VARIANT: Record<PaymentScheduleStatus, string> = {
  scheduled: "border-border text-muted-foreground",
  due: "border-amber-400/50 text-amber-400",
  awaiting_review: "border-blue-400/50 text-blue-400",
  paid: "border-emerald-400/50 text-emerald-400",
  overdue: "border-red-400/60 text-red-400",
  waived: "border-border text-muted-foreground line-through",
};

export function PaymentScheduleTable({ orderId, schedules, role, limit }: Props) {
  const [active, setActive] = useState<ScheduleRow | null>(null);
  const visible = limit ? schedules.slice(0, limit) : schedules;

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        No payment schedule yet. The seller defines installments when drafting the
        contract.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Milestone</th>
              <th className="text-right px-3 py-2">%</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Due</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-t border-border/50">
                <td className="px-3 py-2 text-muted-foreground">{s.sequence + 1}</td>
                <td className="px-3 py-2">{CATEGORY_LABEL[s.category]}</td>
                <td className="px-3 py-2">
                  {MILESTONE_LABEL[s.milestone]}
                  {s.bl_offset_days != null &&
                    (s.milestone === "bl_date_plus_30" ||
                      s.milestone === "bl_date_plus_60" ||
                      s.milestone === "bl_date_plus_90") && (
                      <span className="text-muted-foreground ml-1">
                        (+{s.bl_offset_days}d)
                      </span>
                    )}
                </td>
                <td className="px-3 py-2 text-right">{s.percentage.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">
                  {s.amount.toFixed(2)} {s.currency}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{s.due_date ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", STATUS_BADGE_VARIANT[s.status])}
                  >
                    {SCHEDULE_STATUS_LABEL[s.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  {role === "buyer" && (s.status === "due" || s.status === "overdue") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setActive(s)}
                    >
                      Submit Payment
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit && schedules.length > limit && (
        <p className="text-xs text-muted-foreground">
          {schedules.length - limit} more installment(s) — see the Payment tab.
        </p>
      )}

      <PaymentSubmitDialog
        orderId={orderId}
        schedule={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}

/** Buyer-facing dialog for submitting a payment against one schedule row. */
const METHOD_LABEL: Record<string, string> = {
  usdt_trc20: "USDT (TRC20)",
  usdt_erc20: "USDT (ERC20)",
  usdi: "USDI",
  mup: "MUP",
  bank_transfer: "Bank Transfer",
};
const PROOF_REQUIRED = new Set(["bank_transfer", "usdi", "mup"]);
const HASH_REQUIRED = new Set(["usdt_trc20", "usdt_erc20"]);

function PaymentSubmitDialog({
  orderId,
  schedule,
  onClose,
}: {
  orderId: string;
  schedule: ScheduleRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState("usdt_trc20");
  const [txHash, setTxHash] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!schedule) return null;

  const needsHash = HASH_REQUIRED.has(method);
  const needsProof = PROOF_REQUIRED.has(method);

  async function upload() {
    if (!file) return;
    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${orderId}/payment_proof/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("order-documents")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("order-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) {
        setProofUrl(signed.signedUrl);
        toast.success("Proof uploaded.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit() {
    if (needsHash && !txHash) {
      toast.error("Transaction hash is required for on-chain payments.");
      return;
    }
    if (needsProof && !proofUrl) {
      toast.error("Please upload a remittance proof.");
      return;
    }
    startTransition(async () => {
      const result = await submitPayment({
        order_id: orderId,
        schedule_id: schedule!.id,
        method: method as "usdt_trc20" | "usdt_erc20" | "usdi" | "mup" | "bank_transfer",
        amount: schedule!.amount,
        currency: schedule!.currency,
        tx_hash: txHash || undefined,
        proof_url: proofUrl || undefined,
        note: note || undefined,
      });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Payment submitted. Pending admin review.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={!!schedule} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Payment</DialogTitle>
          <DialogDescription>
            Installment #{schedule.sequence + 1} — {MILESTONE_LABEL[schedule.milestone]} (
            {schedule.amount.toFixed(2)} {schedule.currency})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Payment Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsHash && (
            <div className="space-y-2">
              <Label className="text-xs">Transaction Hash</Label>
              <Input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
              />
              <p className="text-[11px] text-muted-foreground">
                Admin will verify it on a block explorer.
              </p>
            </div>
          )}

          {needsProof && (
            <div className="space-y-2">
              <Label className="text-xs">Remittance Proof</Label>
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={isUploading}
                  className="text-xs flex-1 min-w-[180px]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={upload}
                  disabled={!file || isUploading}
                >
                  {isUploading ? "Uploading…" : proofUrl ? "Replace" : "Upload"}
                </Button>
              </div>
              {proofUrl && (
                <p className="text-[11px] text-emerald-400">
                  Proof attached.{" "}
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Preview
                  </a>
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Submitting…" : "Submit Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
