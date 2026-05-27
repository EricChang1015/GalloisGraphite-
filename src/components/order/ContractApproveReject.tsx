"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { approveContract, rejectContract } from "@/actions/order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  orderId: string;
  alreadyApproved?: boolean;
}

export function ContractApproveReject({ orderId, alreadyApproved }: Props) {
  const router = useRouter();
  const t = useTranslations("orders.contractActions");
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  function handleApprove() {
    startTransition(async () => {
      const result = await approveContract(orderId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("toast.approved"));
      router.refresh();
    });
  }

  function handleReject() {
    if (!reason.trim()) {
      toast.error(t("toast.missingReason"));
      return;
    }
    startTransition(async () => {
      const result = await rejectContract({ order_id: orderId, reason });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t("toast.returned"));
      setOpen(false);
      router.refresh();
    });
  }

  if (alreadyApproved) {
    return (
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3 text-sm text-emerald-400 flex items-center gap-2">
        <Check className="size-4" />
        {t("alreadyApproved")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{t("reviewTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("reviewIntro")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleApprove} disabled={isPending}>
          <Check className="size-3.5 mr-1" />
          {t("approve")}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={<Button size="sm" variant="destructive" disabled={isPending} />}
          >
            <X className="size-3.5 mr-1" />
            {t("returnForRevision")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("returnDialogTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                rows={4}
                placeholder={t("returnPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button variant="destructive" onClick={handleReject} disabled={isPending}>
                  {t("sendBack")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
