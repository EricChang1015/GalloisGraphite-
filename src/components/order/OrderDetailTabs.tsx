"use client";

import { Tabs } from "@/components/ui/tabs";

const VALID_TABS = new Set([
  "overview",
  "quotation",
  "contract",
  "payment",
  "shipment",
  "documents",
  "timeline",
]);

interface Props {
  initialTab?: string;
  children: React.ReactNode;
}

export function OrderDetailTabs({ initialTab, children }: Props) {
  const defaultValue =
    initialTab && VALID_TABS.has(initialTab) ? initialTab : "overview";

  return <Tabs defaultValue={defaultValue}>{children}</Tabs>;
}
