"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal, Bot, User, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateSessionId,
  saveMessages as saveMessagesToStore,
  type StoredMessage,
} from "@/lib/ai/sessions";
import { cn } from "@/lib/utils";

const LOGIN_REQUIRED_TOKEN = "[LOGIN_REQUIRED]";

interface UIPart {
  type: string;
  text?: string;
}

function getMessageText(parts: UIPart[] | undefined): string {
  if (!parts) return "";
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function toStoredMessages(
  messages: ReadonlyArray<{
    id: string;
    role: string;
    parts?: UIPart[] | unknown;
  }>
): StoredMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: (m.role === "assistant" || m.role === "system"
      ? m.role
      : "user") as StoredMessage["role"],
    text: getMessageText((m.parts ?? []) as UIPart[]),
  }));
}

function fromStoredMessages(stored: StoredMessage[]): UIMessage[] {
  return stored.map(
    (m) =>
      ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.text }],
      }) as UIMessage
  );
}

interface AiChatProps {
  isAuthenticated?: boolean;
  /**
   * Visual variant.
   *  - "full"    — full panel for /chat page (header + footer + larger paddings)
   *  - "compact" — embedded in floating widget (slimmer header, tighter paddings)
   */
  variant?: "full" | "compact";
  /**
   * Optional slot rendered to the right of the header title.
   */
  headerActions?: React.ReactNode;
  className?: string;
  /**
   * Persisted chat session id. The component generates a fresh one if
   * undefined. Switching this prop is intended to be done via parent
   * remounting (`<AiChat key={sessionId} ... />`) so the underlying
   * `useChat` re-initialises cleanly.
   */
  sessionId?: string;
  /**
   * Initial messages restored from localStorage. Treated as initial state
   * — set them once via the `key={sessionId}` remount pattern above.
   */
  initialMessages?: StoredMessage[];
}

export function AiChat({
  isAuthenticated = false,
  variant = "full",
  headerActions,
  className,
  sessionId: sessionIdProp,
  initialMessages,
}: AiChatProps) {
  const compact = variant === "compact";
  const [input, setInput] = useState("");

  // Resolve a stable session id for this AiChat instance. Parents change
  // `key={sessionId}` to switch chats; we never replace this id mid-life.
  const sessionId = useMemo(
    () => sessionIdProp ?? generateSessionId(),
    [sessionIdProp]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({ "x-mada-session": sessionId }),
      }),
    [sessionId]
  );

  const initialUiMessages = useMemo(
    () => (initialMessages ? fromStoredMessages(initialMessages) : []),
    // Intentionally only computed at mount — the parent remounts via
    // `key={sessionId}` when switching to a different session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: initialUiMessages,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Persist messages to localStorage on every change. This is a pure
  // state → external-system sync, which is the canonical use of
  // useEffect.
  useEffect(() => {
    if (messages.length === 0) return;
    saveMessagesToStore(sessionId, toStoredMessages(messages));
  }, [sessionId, messages]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasLoginPrompt = messages.some(
    (m) =>
      m.role === "assistant" &&
      getMessageText(m.parts as UIPart[]).includes(LOGIN_REQUIRED_TOKEN)
  );

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border",
          compact ? "px-3 py-2" : "px-4 py-3"
        )}
      >
        <Bot className="size-4 text-[color:var(--gold)]" />
        <span className="text-sm font-medium">Mada Graphite AI</span>
        {!isAuthenticated && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            Guest
          </span>
        )}
        {headerActions ? <div className="ml-auto">{headerActions}</div> : null}
      </div>

      {/* Messages */}
      <div
        className={cn(
          "flex-1 overflow-y-auto space-y-4",
          compact ? "p-3" : "p-4"
        )}
      >
        {messages.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <p>Ask me about specs, applications, or how the platform works.</p>
            {!isAuthenticated && (
              <p className="mt-1">Pricing &amp; orders need a sign-in.</p>
            )}
          </div>
        )}

        {messages.map((message) => {
          const rawText = getMessageText(message.parts as UIPart[]);
          const isLoginRequired =
            message.role === "assistant" &&
            rawText.includes(LOGIN_REQUIRED_TOKEN);
          const cleanText = rawText.replace(LOGIN_REQUIRED_TOKEN, "").trim();

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  message.role === "user"
                    ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {message.role === "user" ? (
                  <User className="size-3.5" />
                ) : (
                  <Bot className="size-3.5" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[80%] space-y-2 rounded-xl px-3 py-2 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{cleanText}</p>
                {isLoginRequired && (
                  <a
                    href="/login"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--gold-foreground)] hover:opacity-90"
                  >
                    <LogIn className="size-3" />
                    Log in to continue
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bot className="size-3.5" />
            </div>
            <div className="rounded-xl bg-muted px-3 py-2">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">
            Error: {error.message ?? "Something went wrong. Please try again."}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className={cn(
          "flex items-end gap-2 border-t border-border",
          compact ? "p-2" : "p-3"
        )}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            hasLoginPrompt && !isAuthenticated
              ? "Log in to ask about pricing and orders…"
              : compact
                ? "Ask about specs, prices, applications…"
                : "Ask about graphite specs, applications, trade terms…"
          }
          disabled={isLoading}
          rows={1}
          className="min-h-[36px] max-h-32 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className="shrink-0"
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
