"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getChatMessages } from "@/actions/chat";
import type { ChatMessageRow } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 15_000;
const REALTIME_STALE_MS = 12_000;

function mergeMessages(prev: ChatMessageRow[], incoming: ChatMessageRow[]): ChatMessageRow[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

type Options = {
  roomId: string;
  initialMessages: ChatMessageRow[];
  enabled?: boolean;
};

export function useOrderMessages({ roomId, initialMessages, enabled = true }: Options) {
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const lastRealtimeAt = useRef(Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const result = await getChatMessages({ roomId, limit: 50 });
    if (result.data?.messages) {
      setMessages(result.data.messages);
    }
  }, [roomId]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [roomId, initialMessages]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          lastRealtimeAt.current = Date.now();
          void refresh();
        }
      )
      .subscribe();

    const poll = () => {
      if (Date.now() - lastRealtimeAt.current < REALTIME_STALE_MS) return;
      void refresh();
    };

    pollingRef.current = setInterval(poll, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (pollingRef.current) clearInterval(pollingRef.current);
      void supabase.removeChannel(channel);
    };
  }, [roomId, enabled, refresh]);

  const appendMessage = useCallback((message: ChatMessageRow) => {
    setMessages((prev) => mergeMessages(prev, [message]));
  }, []);

  return { messages, refresh, appendMessage };
}
