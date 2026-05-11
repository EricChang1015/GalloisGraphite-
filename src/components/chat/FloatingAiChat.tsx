"use client";

import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { Bot, X, EyeOff } from "lucide-react";

import { AiChat } from "@/components/chat/AiChat";
import { cn } from "@/lib/utils";

const HIDDEN_KEY = "mada.ai.hidden";
const OPEN_KEY = "mada.ai.open";
const VISIBILITY_EVENT = "mada-ai-visibility-change";

/**
 * Cross-tab / cross-component event so the /chat page (which carries the
 * "Pin AI assistant" toggle) can ping the launcher to re-evaluate state
 * without a full page reload.
 */
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
// useSyncExternalStore wiring
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
  // Manual storage events don't fire on the same tab — broadcast ourselves.
  notifyVisibilityChange(getHiddenSnapshot());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FloatingAiChatProps {
  isAuthenticated?: boolean;
}

export function FloatingAiChat({
  isAuthenticated = false,
}: FloatingAiChatProps) {
  const pathname = usePathname();
  // The /chat page renders the full panel inline; suppress the launcher
  // there to avoid two parallel chat threads on the same screen.
  const suppressOnRoute = pathname === "/chat";

  const hidden = useFloatingAiHidden();
  const open = useFloatingAiOpen();

  const persistOpen = useCallback((next: boolean) => {
    setOpenInStorage(next);
  }, []);

  const handleHide = useCallback(() => {
    setOpenInStorage(false);
    setFloatingAiHidden(true);
  }, []);

  if (hidden || suppressOnRoute) return null;

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50",
            // Mobile: bottom sheet covering most of the viewport
            "inset-x-3 bottom-3 top-20",
            // Desktop: docked to bottom-right
            "sm:inset-auto sm:bottom-20 sm:right-4 sm:top-auto sm:h-[600px] sm:max-h-[80vh] sm:w-[380px]"
          )}
        >
          <div className="size-full shadow-2xl shadow-black/30 rounded-lg overflow-hidden">
            <AiChat
              isAuthenticated={isAuthenticated}
              variant="compact"
              headerActions={
                <div className="flex items-center gap-1">
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
          // Hide the floating button visually when the panel is open on
          // mobile (the panel is full-bleed there), but keep it on desktop.
          open && "max-sm:hidden"
        )}
      >
        {open ? <X className="size-5" /> : <Bot className="size-5" />}
      </button>
    </>
  );
}
