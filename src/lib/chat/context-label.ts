import type { ChatMessageContextType } from "@/lib/chat/types";

export function formatContextLabel(
  type: ChatMessageContextType,
  custom?: string
): string {
  if (custom) return custom;
  switch (type) {
    case "listing":
      return "Listing";
    case "inquiry":
      return "Inquiry";
    case "order":
      return "Order";
    default:
      return "Context";
  }
}
