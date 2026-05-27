"use client";

import { useEffect, useState } from "react";

import { Tabs } from "@/components/ui/tabs";
import {
  isOrderDetailTab,
  type OrderDetailTab,
} from "@/lib/order/suggestedTab";

interface Props {
  /** Explicit `?tab=` from URL; takes precedence over suggestion. */
  initialTab?: string;
  /** Server-computed tab when the user has a pending action. */
  suggestedTab: OrderDetailTab;
  children: React.ReactNode;
}

export function OrderDetailTabs({ initialTab, suggestedTab, children }: Props) {
  const explicitTab = isOrderDetailTab(initialTab) ? initialTab : null;
  const resolvedTab = explicitTab ?? suggestedTab;

  const [value, setValue] = useState<OrderDetailTab>(resolvedTab);

  useEffect(() => {
    setValue(resolvedTab);
    const frame = requestAnimationFrame(() => {
      const panel = document.getElementById(`order-tab-panel-${resolvedTab}`);
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedTab]);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (next && isOrderDetailTab(next)) setValue(next);
      }}
    >
      {children}
    </Tabs>
  );
}
