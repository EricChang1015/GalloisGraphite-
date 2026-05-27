"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Factory, Package, Ship, Anchor, ShieldCheck, AlertTriangle, Ban } from "lucide-react";

import {
  markInProduction,
  markReadyToShip,
  markInTransit,
  markArrived,
  markCustomsCleared,
  raiseDispute,
  cancelOrder,
} from "@/actions/order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/lib/order/stateMachine";

import { MilestoneActionButtons } from "./MilestoneActionButtons";

interface Props {
  orderId: string;
  status: OrderStatus;
  role: "buyer" | "seller" | "admin";
  ata?: string | null;
  milestoneTimestamps?: {
    before_production_at: string | null;
    before_shipment_at: string | null;
    before_loading_at: string | null;
    bl_received_at: string | null;
    shipping_docs_received_at: string | null;
    bl_plus_insurance_received_at: string | null;
    picked_up_at: string | null;
  };
}

export function OrderPhaseActions({
  orderId,
  status,
  role,
  ata,
  milestoneTimestamps,
}: Props) {
  const router = useRouter();
  const t = useTranslations("orders.phaseActions");
  const [isPending, startTransition] = useTransition();
  const [arriveAta, setArriveAta] = useState(ata ?? new Date().toISOString().slice(0, 10));
  const [arriveOpen, setArriveOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  function wrap<T>(fn: () => Promise<{ data: T | null; error: { message: string } | null }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  const isSeller = role === "seller";
  const isBuyer = role === "buyer";

  // Active state buttons. Payment is decoupled from the order timeline
  // so "in production" follows directly from "contract_signed" (the
  // contract-signing flow already auto-steps into in_production today,
  // so this button is mostly a safety hatch for orders manually held).
  const showInProduction = isSeller && status === "contract_signed";
  const showReadyToShip = isSeller && status === "in_production";
  const showInTransit = isSeller && status === "shipped";
  const showArrived =
    (isSeller || isBuyer) && (status === "shipped" || status === "in_transit");
  const showCustomsCleared = isBuyer && status === "arrived";

  const cancellableStates: OrderStatus[] = [
    "quotation_pending", "quoted", "negotiating",
    "contract_pending", "contract_signed",
    "in_production", "ready_to_ship",
    "disputed",
  ];
  const showCancel = cancellableStates.includes(status);
  const showDispute =
    !["completed", "cancelled", "disputed"].includes(status);

  const anyPrimary =
    showInProduction || showReadyToShip || showInTransit || showArrived || showCustomsCleared;

  return (
    <div className="space-y-3">
      {milestoneTimestamps && (role === "buyer" || role === "seller") && (
        <MilestoneActionButtons
          orderId={orderId}
          status={status}
          role={role}
          timestamps={milestoneTimestamps}
        />
      )}
      {anyPrimary && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">{t("nextStep")}</p>
          <div className="flex flex-wrap gap-2">
            {showInProduction && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => wrap(() => markInProduction(orderId), t("toast.inProduction"))}
              >
                <Factory className="size-3.5 mr-1" />
                {t("markInProduction")}
              </Button>
            )}
            {showReadyToShip && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => wrap(() => markReadyToShip(orderId), t("toast.readyToShip"))}
              >
                <Package className="size-3.5 mr-1" />
                {t("markReadyToShip")}
              </Button>
            )}
            {showInTransit && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  wrap(
                    () => markInTransit({ order_id: orderId }),
                    t("toast.inTransit")
                  )
                }
              >
                <Ship className="size-3.5 mr-1" />
                {t("markInTransit")}
              </Button>
            )}
            {showArrived && (
              <Dialog open={arriveOpen} onOpenChange={setArriveOpen}>
                <DialogTrigger
                  render={<Button size="sm" variant="outline" disabled={isPending} />}
                >
                  <Anchor className="size-3.5 mr-1" />
                  {t("markArrived")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("arriveDialog.title")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="ata">{t("arriveDialog.ataLabel")}</Label>
                      <Input
                        id="ata"
                        type="date"
                        value={arriveAta}
                        onChange={(e) => setArriveAta(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("arriveDialog.ataHint")}
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setArriveOpen(false)}>
                        {t("arriveDialog.cancel")}
                      </Button>
                      <Button
                        onClick={() => {
                          wrap(
                            () => markArrived({ order_id: orderId, ata: arriveAta }),
                            t("toast.arrived")
                          );
                          setArriveOpen(false);
                        }}
                        disabled={isPending}
                      >
                        {t("arriveDialog.confirm")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {showCustomsCleared && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  wrap(
                    () => markCustomsCleared(orderId),
                    t("toast.customsCleared")
                  )
                }
              >
                <ShieldCheck className="size-3.5 mr-1" />
                {t("confirmCustomsCleared")}
              </Button>
            )}
          </div>
        </div>
      )}

      {(showDispute || showCancel) && (
        <div className="flex flex-wrap gap-2">
          {showDispute && (
            <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
              <DialogTrigger
                render={<Button size="sm" variant="outline" className="text-red-400 hover:text-red-400" disabled={isPending} />}
              >
                <AlertTriangle className="size-3.5 mr-1" />
                {t("raiseDispute")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("disputeDialog.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Textarea
                    rows={4}
                    placeholder={t("disputeDialog.placeholder")}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDisputeOpen(false)}>
                      {t("disputeDialog.cancel")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (disputeReason.trim().length < 10) {
                          toast.error(t("disputeDialog.tooShort"));
                          return;
                        }
                        wrap(
                          () => raiseDispute({ order_id: orderId, reason: disputeReason }),
                          t("toast.dispute")
                        );
                        setDisputeOpen(false);
                      }}
                      disabled={isPending}
                    >
                      {t("disputeDialog.confirm")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {showCancel && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger
                render={<Button size="sm" variant="outline" className="text-muted-foreground" disabled={isPending} />}
              >
                <Ban className="size-3.5 mr-1" />
                {t("cancelOrder")}
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("cancelDialog.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Textarea
                    rows={3}
                    placeholder={t("cancelDialog.placeholder")}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCancelOpen(false)}>
                      {t("cancelDialog.keep")}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!cancelReason.trim()) {
                          toast.error(t("cancelDialog.missing"));
                          return;
                        }
                        wrap(
                          () => cancelOrder({ order_id: orderId, reason: cancelReason }),
                          t("toast.cancelled")
                        );
                        setCancelOpen(false);
                      }}
                      disabled={isPending}
                    >
                      {t("cancelDialog.confirm")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}
