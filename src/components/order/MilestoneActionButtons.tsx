"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  markBeforeProduction,
  markBeforeShipment,
  markBeforeLoading,
  markBlReceived,
  markShippingDocsReceived,
  markBlPlusInsuranceReceived,
  markGoodsPickedUp,
} from "@/actions/order";
import { Button } from "@/components/ui/button";

type ActionFn = (orderId: string) => Promise<{ data: unknown; error: { message: string } | null }>;

interface Milestone {
  key: string;
  label: string;
  role: "buyer" | "seller";
  action: ActionFn;
  /** Order status range when this milestone makes sense. */
  visibleWhen: (status: string) => boolean;
  /** When the corresponding timestamp on `orders` is set, button is disabled. */
  done: boolean;
}

interface Props {
  orderId: string;
  status: string;
  role: "buyer" | "seller" | "other";
  /** Timestamps from `orders` so we can disable already-performed milestones. */
  timestamps: {
    before_production_at: string | null;
    before_shipment_at: string | null;
    before_loading_at: string | null;
    bl_received_at: string | null;
    shipping_docs_received_at: string | null;
    bl_plus_insurance_received_at: string | null;
    picked_up_at: string | null;
  };
}

export function MilestoneActionButtons({ orderId, status, role, timestamps }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const milestones: Milestone[] = [
    {
      key: "before_production",
      label: "Mark Before Production",
      role: "seller",
      action: markBeforeProduction,
      visibleWhen: (s) => s === "contract_signed" || s === "in_production",
      done: !!timestamps.before_production_at,
    },
    {
      key: "before_shipment",
      label: "Mark Before Shipment",
      role: "seller",
      action: markBeforeShipment,
      visibleWhen: (s) => s === "in_production" || s === "ready_to_ship",
      done: !!timestamps.before_shipment_at,
    },
    {
      key: "before_loading",
      label: "Mark Before Loading",
      role: "seller",
      action: markBeforeLoading,
      visibleWhen: (s) => s === "ready_to_ship",
      done: !!timestamps.before_loading_at,
    },
    {
      key: "bl_received",
      label: "Mark B/L Received",
      role: "buyer",
      action: markBlReceived,
      visibleWhen: (s) => s === "shipped" || s === "in_transit" || s === "arrived",
      done: !!timestamps.bl_received_at,
    },
    {
      key: "shipping_docs",
      label: "Mark Shipping Docs Received",
      role: "buyer",
      action: markShippingDocsReceived,
      visibleWhen: (s) => s === "shipped" || s === "in_transit" || s === "arrived",
      done: !!timestamps.shipping_docs_received_at,
    },
    {
      key: "bl_plus_insurance",
      label: "Mark B/L + Insurance Received",
      role: "buyer",
      action: markBlPlusInsuranceReceived,
      visibleWhen: (s) => s === "shipped" || s === "in_transit" || s === "arrived",
      done: !!timestamps.bl_plus_insurance_received_at,
    },
    {
      key: "picked_up",
      label: "Mark Goods Picked Up",
      role: "buyer",
      action: markGoodsPickedUp,
      visibleWhen: (s) => s === "arrived" || s === "customs_cleared",
      done: !!timestamps.picked_up_at,
    },
  ];

  const visible = milestones.filter(
    (m) => m.role === role && m.visibleWhen(status)
  );

  if (role === "other" || visible.length === 0) return null;

  function run(m: Milestone) {
    startTransition(async () => {
      const result = await m.action(orderId);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`${m.label.replace(/^Mark /, "")} ✓`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">Milestone Triggers</p>
        <p className="text-xs text-muted-foreground">
          Use these to mark fine-grained events that aren&apos;t covered by the
          main shipment buttons. Each click may release a corresponding payment
          installment to the buyer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {visible.map((m) => (
          <Button
            key={m.key}
            type="button"
            size="sm"
            variant="outline"
            disabled={m.done || isPending}
            onClick={() => run(m)}
            className="h-7 text-[11px]"
          >
            {m.done ? `✓ ${m.label.replace(/^Mark /, "")}` : m.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
