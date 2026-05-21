import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ConversationSummary } from "@/lib/chat/types";
import { profileInitials } from "@/lib/chat/display";

interface Props {
  conversations: ConversationSummary[];
}

export function ConversationList({ conversations }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        <p>No conversations yet.</p>
        <p className="mt-2">
          Message a seller from the market or a trading partner from an order.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {conversations.map((c) => (
        <li key={c.roomId}>
          <Link
            href={`/messages/${c.counterpartyId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <Avatar size="lg">
              <AvatarFallback className="bg-primary/15 text-primary font-medium">
                {profileInitials({
                  id: c.counterpartyId,
                  full_name: null,
                  company_name: c.counterpartyLabel,
                  country: c.counterpartyCountry,
                })}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{c.counterpartyLabel}</p>
              {c.counterpartyCountry ? (
                <p className="text-xs text-muted-foreground">{c.counterpartyCountry}</p>
              ) : null}
              {c.lastMessagePreview ? (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {c.lastMessagePreview}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  No messages yet
                </p>
              )}
            </div>
            {c.lastMessageAt ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {new Date(c.lastMessageAt).toLocaleString()}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
