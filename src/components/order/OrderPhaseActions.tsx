"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

interface Props {
  orderId: string;
  status: OrderStatus;
  role: "buyer" | "seller" | "admin";
  ata?: string | null;
}

export function OrderPhaseActions({ orderId, status, role, ata }: Props) {
  const router = useRouter();
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

  // Active state buttons
  const showInProduction =
    isSeller && (status === "contract_signed" || status === "paid");
  const showReadyToShip = isSeller && status === "in_production";
  const showInTransit = isSeller && status === "shipped";
  const showArrived =
    (isSeller || isBuyer) && (status === "shipped" || status === "in_transit");
  const showCustomsCleared = isBuyer && status === "arrived";

  const cancellableStates: OrderStatus[] = [
    "draft", "quotation_pending", "quoted", "negotiating",
    "contract_pending", "contract_signed",
    "payment_pending", "in_production", "ready_to_ship",
    "disputed",
  ];
  const showCancel = cancellableStates.includes(status);
  const showDispute =
    !["completed", "cancelled", "disputed"].includes(status);

  const anyPrimary =
    showInProduction || showReadyToShip || showInTransit || showArrived || showCustomsCleared;

  return (
    <div className="space-y-3">
      {anyPrimary && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-medium">Next step</p>
          <div className="flex flex-wrap gap-2">
            {showInProduction && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => wrap(() => markInProduction(orderId), "Marked as in production.")}
              >
                <Factory className="size-3.5 mr-1" />
                Mark In Production
              </Button>
            )}
            {showReadyToShip && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => wrap(() => markReadyToShip(orderId), "Marked as ready to ship.")}
              >
                <Package className="size-3.5 mr-1" />
                Mark Ready to Ship
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
                    "Marked as in transit."
                  )
                }
              >
                <Ship className="size-3.5 mr-1" />
                Mark In Transit
              </Button>
            )}
            {showArrived && (
              <Dialog open={arriveOpen} onOpenChange={setArriveOpen}>
                <DialogTrigger
                  render={<Button size="sm" variant="outline" disabled={isPending} />}
                >
                  <Anchor className="size-3.5 mr-1" />
                  Mark Arrived
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark vessel arrived</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="ata">Actual Time of Arrival (ATA)</Label>
                      <Input
                        id="ata"
                        type="date"
                        value={arriveAta}
                        onChange={(e) => setArriveAta(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Payment due date will be computed from this date for net-after-arrival terms.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setArriveOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          wrap(
                            () => markArrived({ order_id: orderId, ata: arriveAta }),
                            "Marked as arrived."
                          );
                          setArriveOpen(false);
                        }}
                        disabled={isPending}
                      >
                        Confirm Arrival
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
                    "Customs cleared. Order moves to next phase."
                  )
                }
              >
                <ShieldCheck className="size-3.5 mr-1" />
                Confirm Customs Cleared
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
                Raise Dispute
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Raise a dispute</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Textarea
                    rows={4}
                    placeholder="Describe the issue. Admin will be notified to mediate."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDisputeOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (disputeReason.trim().length < 10) {
                          toast.error("Please describe the issue (≥10 chars).");
                          return;
                        }
                        wrap(
                          () => raiseDispute({ order_id: orderId, reason: disputeReason }),
                          "Dispute raised. Admin notified."
                        );
                        setDisputeOpen(false);
                      }}
                      disabled={isPending}
                    >
                      Raise Dispute
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
                Cancel Order
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this order</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Textarea
                    rows={3}
                    placeholder="Reason for cancellation."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCancelOpen(false)}>
                      Keep Order
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (!cancelReason.trim()) {
                          toast.error("Please enter a reason.");
                          return;
                        }
                        wrap(
                          () => cancelOrder({ order_id: orderId, reason: cancelReason }),
                          "Order cancelled."
                        );
                        setCancelOpen(false);
                      }}
                      disabled={isPending}
                    >
                      Cancel Order
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
