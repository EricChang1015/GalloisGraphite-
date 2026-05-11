"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { AiChat } from "@/components/chat/AiChat";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import {
  generateSessionId,
  useActiveSessionId,
  useChatSessions,
} from "@/lib/ai/sessions";
import { cn } from "@/lib/utils";

interface ChatPageBodyProps {
  isAuthenticated: boolean;
}

/**
 * Two-pane layout for the /chat full page:
 *   - Left: chat history (collapsible on mobile via the toggle)
 *   - Right: active conversation
 *
 * Session selection lives in localStorage; switching sessions remounts
 * AiChat (`key={sessionId}`) to cleanly reload its messages.
 */
export function ChatPageBody({ isAuthenticated }: ChatPageBodyProps) {
  const sessions = useChatSessions();
  const storedActiveId = useActiveSessionId();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const fallbackId =
    sessions.length > 0
      ? [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
      : null;
  const activeSessionId =
    storedActiveId ?? fallbackId ?? generatePlaceholderSessionId();
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <div className="flex flex-1 overflow-hidden rounded-lg border border-border bg-card">
      {/* Sidebar — collapsible on mobile */}
      <aside
        className={cn(
          "w-64 shrink-0",
          mobileSidebarOpen
            ? "absolute inset-y-0 left-0 z-20 sm:static"
            : "hidden sm:block"
        )}
      >
        <ChatHistorySidebar
          variant="full"
          onSelect={() => setMobileSidebarOpen(false)}
        />
      </aside>

      {/* Main chat */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((v) => !v)}
          className="absolute left-3 top-3 z-30 rounded-md border border-border bg-card p-1.5 text-muted-foreground sm:hidden"
          aria-label={mobileSidebarOpen ? "Close history" : "Open history"}
        >
          {mobileSidebarOpen ? (
            <X className="size-4" />
          ) : (
            <Menu className="size-4" />
          )}
        </button>

        <div className="size-full">
          <AiChat
            key={activeSessionId}
            isAuthenticated={isAuthenticated}
            variant="full"
            sessionId={activeSessionId}
            initialMessages={activeSession?.messages}
            className="rounded-none border-0"
          />
        </div>
      </div>
    </div>
  );
}

let placeholderId: string | null = null;
function generatePlaceholderSessionId(): string {
  if (placeholderId) return placeholderId;
  placeholderId = generateSessionId();
  return placeholderId;
}
