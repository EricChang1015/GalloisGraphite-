"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { SendHorizontal, Bot, User, LogIn } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const LOGIN_REQUIRED_TOKEN = "[LOGIN_REQUIRED]";

/**
 * Extract plain text from a UIMessage.
 * AI SDK v6 stores message content in message.parts[].
 */
function getMessageText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

interface AiChatProps {
  isAuthenticated?: boolean;
}

export function AiChat({ isAuthenticated = false }: AiChatProps) {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasLoginPrompt = messages.some((m) => {
    const text = getMessageText(
      (m.parts ?? []) as Array<{ type: string; text?: string }>
    );
    return m.role === "assistant" && text.includes(LOGIN_REQUIRED_TOKEN);
  });

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="size-4 text-[color:var(--gold)]" />
        <span className="text-sm font-medium">Mada Graphite AI</span>
        {!isAuthenticated && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Guest mode
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ask me anything about graphite, our products, or the platform.
          </p>
        )}

        {messages.map((message) => {
          const rawText = getMessageText(
            (message.parts ?? []) as Array<{ type: string; text?: string }>
          );
          const isLoginRequired =
            message.role === "assistant" &&
            rawText.includes(LOGIN_REQUIRED_TOKEN);
          const cleanText = rawText.replace(LOGIN_REQUIRED_TOKEN, "").trim();

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
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
                <p className="whitespace-pre-wrap">{cleanText}</p>
                {isLoginRequired && (
                  <a
                    href="/login"
                    className="mt-2 flex items-center gap-1.5 rounded-md bg-[color:var(--gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--gold-foreground)] hover:opacity-90"
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
          <div className="flex gap-3">
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
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            hasLoginPrompt && !isAuthenticated
              ? "Log in to ask about pricing and orders…"
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
        >
          <SendHorizontal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
