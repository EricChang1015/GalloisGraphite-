"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";

import {
  clearAllSessions,
  deleteSession as deleteSessionFromStore,
  setActiveSession,
  startNewSession,
  useActiveSessionId,
  useChatSessions,
  type ChatSession,
} from "@/lib/ai/sessions";
import { cn } from "@/lib/utils";

interface ChatHistorySidebarProps {
  className?: string;
  /**
   * Compact = used inside the floating widget's drop-down. Renders fewer
   * details, smaller paddings, no "Clear all" footer.
   */
  variant?: "full" | "compact";
  /**
   * Optional callback fired after the user picks a session. Useful for the
   * floating widget which closes the dropdown on selection.
   */
  onSelect?: (sessionId: string) => void;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

export function ChatHistorySidebar({
  className,
  variant = "full",
  onSelect,
}: ChatHistorySidebarProps) {
  const sessions = useChatSessions();
  const activeId = useActiveSessionId();
  const compact = variant === "compact";

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  function handleSelect(id: string) {
    setActiveSession(id);
    onSelect?.(id);
  }

  function handleNew() {
    const id = startNewSession();
    onSelect?.(id);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteSessionFromStore(id);
  }

  function handleClearAll() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete all chat history? This cannot be undone.")
    ) {
      return;
    }
    clearAllSessions();
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-card",
        compact ? "" : "border-r border-border",
        className
      )}
    >
      {/* New chat */}
      <div
        className={cn(
          "border-b border-border",
          compact ? "p-2" : "p-3"
        )}
      >
        <button
          type="button"
          onClick={handleNew}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[color:var(--gold)] px-3 py-2 text-xs font-medium text-[color:var(--gold-foreground)] hover:opacity-90"
        >
          <MessageSquarePlus className="size-3.5" />
          New chat
        </button>
      </div>

      {/* Session list */}
      <div className={cn("flex-1 overflow-y-auto", compact ? "p-1" : "p-2")}>
        {sorted.length === 0 ? (
          <p
            className={cn(
              "text-center text-xs text-muted-foreground",
              compact ? "py-4" : "py-8"
            )}
          >
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeId}
                compact={compact}
                onClick={() => handleSelect(s.id)}
                onDelete={(e) => handleDelete(e, s.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {!compact && sorted.length > 0 && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Clear all history
          </button>
        </div>
      )}
    </div>
  );
}

interface SessionRowProps {
  session: ChatSession;
  active: boolean;
  compact: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SessionRow({
  session,
  active,
  compact,
  onClick,
  onDelete,
}: SessionRowProps) {
  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md text-left text-xs transition-colors",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          compact ? "px-2 py-1.5" : "px-2.5 py-2"
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="flex-1 min-w-0 text-left"
        >
          <div className="truncate font-medium">
            {session.title || "Untitled chat"}
          </div>
          <div className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-muted-foreground">
            {formatRelative(session.updatedAt)} · {session.messages.length} msg
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete this conversation"
          className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </li>
  );
}
