import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { ChatRoomSummary } from "@/lib/chat/types";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order/stateMachine";

interface Props {
  rooms: ChatRoomSummary[];
}

export function ChatRoomList({ rooms }: Props) {
  if (rooms.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        <p>No order conversations yet.</p>
        <p className="mt-2">
          A chat room is created when a buyer accepts a quotation and an order is
          opened.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rooms.map((room) => (
        <li key={room.roomId}>
          <Link
            href={`/orders/${room.orderId}?tab=communication`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 transition-colors sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium truncate">{room.orderNo}</p>
              <p className="text-sm text-muted-foreground truncate">
                {room.counterpartyLabel}
              </p>
              {room.lastMessagePreview ? (
                <p className="text-xs text-muted-foreground truncate">
                  {room.lastMessagePreview}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No messages yet</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {STATUS_LABEL[room.orderStatus as OrderStatus] ?? room.orderStatus}
              </Badge>
              {room.lastMessageAt ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(room.lastMessageAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
