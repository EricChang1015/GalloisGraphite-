"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

type MilestoneKey =
  | "before_production"
  | "before_shipment"
  | "before_loading"
  | "bl_received"
  | "shipping_docs"
  | "bl_plus_insurance"
  | "picked_up";

interface Milestone {
  key: MilestoneKey;
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
  const t = useTranslations("orders.milestones");
  const tLabel = useTranslations("orders.milestones.label");
  const tDone = useTranslations("orders.milestones.done");
  const [isPending, startTransition] = useTransition();

  const milestones: Milestone[] = [
    {
      key: "before_production",
      role: "seller",
      action: markBeforeProduction,
      visibleWhen: (s) => s === "contract_signed" || s === "in_production",
      done: !!timestamps.before_production_at,
    },
    {
      key: "before_shipment",
      role: "seller",
      action: markBeforeShipment,
      visibleWhen: (s) => s === "in_production" || s === "ready_to_ship",
      done: !!timestamps.before_shipment_at,
    },
    {
      key: "before_loading",
      role: "seller",
      action: markBeforeLoading,
      visibleWhen: (s) => s === "ready_to_ship",
      done: !!timestamps.before_loading_at,
    },
    {
      key: "bl_received",
      role: "buyer",
      action: markBlReceived,
      visibleWhen: (s) => s === "shipped" || s === "in_transit" || s === "arrived",
      done: !!timestamps.bl_received_at,
    },
    {
      key: "shipping_docs",
      role: "buyer",
      action: markShippingDocsReceived,
      visibleWhen: (s) => s === "shipped" || s === "in_transit" || s === "arrived",
      done: !!timestamps.shipping_docs_received_at,
    },
    {
      key: "bl_plus_insurance",
      role: "buyer",
      action: markBlPlusInsuranceReceived,
      visibleWhen: (s) => s === "shipped" || s === "in_transit" || s === "arrived",
      done: !!timestamps.bl_plus_insurance_received_at,
    },
    {
      key: "picked_up",
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
      toast.success(t("toast.ok", { label: tDone(m.key) }));
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">{t("heading")}</p>
        <p className="text-xs text-muted-foreground">{t("intro")}</p>
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
            {m.done ? `✓ ${tDone(m.key)}` : tLabel(m.key)}
          </Button>
        ))}
      </div>
    </div>
  );
}
