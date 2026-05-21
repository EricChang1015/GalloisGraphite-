"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Bot, History, X, EyeOff } from "lucide-react";

import { AiChat } from "@/components/chat/AiChat";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import {
  generateSessionId,
  setActiveSession,
  useActiveSessionId,
  useChatSessions,
} from "@/lib/ai/sessions";
import type { AiChatUserAvatar } from "@/lib/profile/avatar";
import { cn } from "@/lib/utils";

const HIDDEN_KEY = "mada.ai.hidden";
const OPEN_KEY = "mada.ai.open";
const VISIBILITY_EVENT = "mada-ai-visibility-change";

function notifyVisibilityChange(hidden: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(VISIBILITY_EVENT, { detail: { hidden } })
  );
}

export function setFloatingAiHidden(hidden: boolean) {
  if (typeof window === "undefined") return;
  if (hidden) {
    window.localStorage.setItem(HIDDEN_KEY, "1");
  } else {
    window.localStorage.removeItem(HIDDEN_KEY);
  }
  notifyVisibilityChange(hidden);
}

export function isFloatingAiHidden(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(HIDDEN_KEY) === "1";
}

// ---------------------------------------------------------------------------
// useSyncExternalStore wiring for visibility flags
// ---------------------------------------------------------------------------

function subscribeLocalStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VISIBILITY_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VISIBILITY_EVENT, callback);
  };
}

function getHiddenSnapshot(): boolean {
  return window.localStorage.getItem(HIDDEN_KEY) === "1";
}

function getOpenSnapshot(): boolean {
  return window.localStorage.getItem(OPEN_KEY) === "1";
}

const FALSE_SNAPSHOT = () => false;

export function useFloatingAiHidden(): boolean {
  return useSyncExternalStore(
    subscribeLocalStorage,
    getHiddenSnapshot,
    FALSE_SNAPSHOT
  );
}

function useFloatingAiOpen(): boolean {
  return useSyncExternalStore(
    subscribeLocalStorage,
    getOpenSnapshot,
    FALSE_SNAPSHOT
  );
}

function setOpenInStorage(next: boolean) {
  if (typeof window === "undefined") return;
  if (next) window.localStorage.setItem(OPEN_KEY, "1");
  else window.localStorage.removeItem(OPEN_KEY);
  notifyVisibilityChange(getHiddenSnapshot());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FloatingAiChatProps {
  isAuthenticated?: boolean;
  userAvatar?: AiChatUserAvatar | null;
}

export function FloatingAiChat({
  isAuthenticated = false,
  userAvatar = null,
}: FloatingAiChatProps) {
  const pathname = usePathname();
  // The /chat page renders the full panel inline; suppress the launcher
  // there to avoid two parallel chat threads on the same screen.
  const suppressOnRoute = pathname === "/chat";

  const hidden = useFloatingAiHidden();
  const open = useFloatingAiOpen();

  const sessions = useChatSessions();
  const storedActiveId = useActiveSessionId();

  // History dropdown is panel-local UI state.
  const [historyOpen, setHistoryOpen] = useState(false);

  // Resolve the session that should be loaded into AiChat. We prefer the
  // explicit active id from storage; otherwise fall back to the most
  // recently updated session, otherwise generate a fresh id.
  const fallbackId =
    sessions.length > 0
      ? [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
      : null;
  const activeSessionId =
    storedActiveId ?? fallbackId ?? generateSessionIdOnce();
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const persistOpen = useCallback((next: boolean) => {
    setOpenInStorage(next);
  }, []);

  const handleHide = useCallback(() => {
    setOpenInStorage(false);
    setFloatingAiHidden(true);
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSession(id);
    setHistoryOpen(false);
  }, []);

  if (hidden || suppressOnRoute) return null;

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50",
            "inset-x-3 bottom-3 top-20",
            "sm:inset-auto sm:bottom-20 sm:right-4 sm:top-auto sm:h-[600px] sm:max-h-[80vh] sm:w-[380px]"
          )}
        >
          <div className="relative size-full rounded-lg overflow-hidden shadow-2xl shadow-black/30">
            <AiChat
              key={activeSessionId}
              isAuthenticated={isAuthenticated}
              userAvatar={userAvatar}
              variant="compact"
              sessionId={activeSessionId}
              initialMessages={activeSession?.messages}
              headerActions={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((v) => !v)}
                    aria-label="Show chat history"
                    aria-expanded={historyOpen}
                    title="History"
                    className={cn(
                      "rounded-md p-1 transition-colors",
                      historyOpen
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <History className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleHide}
                    aria-label="Hide AI assistant on every page"
                    title="Hide on every page"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <EyeOff className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => persistOpen(false)}
                    aria-label="Close AI assistant"
                    title="Close"
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              }
            />

            {/* History dropdown — overlays the messages area */}
            {historyOpen && (
              <div
                className="absolute inset-x-0 top-[42px] bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur"
                role="dialog"
                aria-label="Chat history"
              >
                <ChatHistorySidebar
                  variant="compact"
                  onSelect={handleSelectSession}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Launcher button */}
      <button
        type="button"
        onClick={() => persistOpen(!open)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex size-12 items-center justify-center rounded-full shadow-lg shadow-black/30 transition-transform hover:scale-105 active:scale-95",
          "bg-[color:var(--gold)] text-[color:var(--gold-foreground)]",
          open && "max-sm:hidden"
        )}
      >
        {open ? <X className="size-5" /> : <Bot className="size-5" />}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Session-id helpers
// ---------------------------------------------------------------------------

let placeholderSessionId: string | null = null;

/**
 * Returns a deterministic session id when localStorage is empty, so the
 * floating widget renders without a `null` key while the user is yet to
 * start their first conversation. We don't write this id back — once they
 * send the first message, AiChat itself persists the session.
 */
function generateSessionIdOnce(): string {
  if (placeholderSessionId) return placeholderSessionId;
  placeholderSessionId = generateSessionId();
  return placeholderSessionId;
}
