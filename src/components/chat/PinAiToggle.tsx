"use client";

import { Bot, EyeOff } from "lucide-react";

import {
  setFloatingAiHidden,
  useFloatingAiHidden,
} from "@/components/chat/FloatingAiChat";
import { cn } from "@/lib/utils";

/**
 * Lets the user re-pin (or temporarily hide) the floating AI launcher.
 * Renders inline next to the /chat page heading. Subscribes to the same
 * localStorage event the launcher uses, so toggling here updates the
 * launcher in the same tab without a reload.
 */
export function PinAiToggle({ className }: { className?: string }) {
  const hidden = useFloatingAiHidden();

  function toggle() {
    setFloatingAiHidden(!hidden);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!hidden}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {hidden ? <Bot className="size-3.5" /> : <EyeOff className="size-3.5" />}
      {hidden
        ? "Pin AI assistant to every page"
        : "Hide AI assistant on every page"}
    </button>
  );
}
