"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { getPartyChatWithUser } from "@/actions/chat";
import { CounterpartyCard } from "@/components/messages/CounterpartyCard";
import { PartyChatPanel } from "@/components/messages/PartyChatPanel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ChatContext, ChatMessageRow } from "@/lib/chat/types";
import type { CounterpartyProfile } from "@/lib/chat/display";
import { counterpartyLabel } from "@/lib/chat/display";
import { cn } from "@/lib/utils";

interface Props {
  counterparty: CounterpartyProfile;
  currentUserId: string;
  context?: ChatContext;
  variant?: "button" | "card";
  className?: string;
}

export function MessageCounterpartyButton({
  counterparty,
  currentUserId,
  context,
  variant = "button",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await getPartyChatWithUser(counterparty.id);
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      setRoomId(result.data!.roomId);
      setMessages(result.data!.messages);
    });
  }, [open, counterparty.id]);

  if (counterparty.id === currentUserId) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={
              variant === "card"
                ? "shrink-0 gap-1"
                : cn("gap-1", className)
            }
          />
        }
      >
        <MessageCircle className="size-4" />
        Message
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-4">
        <SheetHeader>
          <SheetTitle>Message {counterpartyLabel(counterparty)}</SheetTitle>
        </SheetHeader>
        <CounterpartyCard profile={counterparty} />
        {isPending || !roomId ? (
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        ) : (
          <PartyChatPanel
            roomId={roomId}
            currentUserId={currentUserId}
            initialMessages={messages}
            pendingContext={context}
            className="flex-1 min-h-0"
          />
        )}
        <Link
          href={`/messages/${counterparty.id}`}
          className="text-sm text-primary underline underline-offset-4"
        >
          Open full thread
        </Link>
      </SheetContent>
    </Sheet>
  );
}
