import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const FORWARD_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["contract_generated", "cancelled"],
  contract_generated: ["signed", "cancelled"],
  signed: ["payment_pending", "cancelled"],
  payment_pending: ["paid", "disputed", "cancelled"],
  paid: ["shipped", "disputed"],
  shipped: ["delivered", "disputed"],
  delivered: ["completed", "disputed"],
  completed: [],
  disputed: ["cancelled", "completed"],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return FORWARD_TRANSITIONS[from]?.includes(to) ?? false;
}
