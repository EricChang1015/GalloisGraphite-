"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { dispatchCommandOpen } from "@/components/home/CommandPaletteHost";

/**
 * Small client island in the navbar that opens the global ⌘K palette.
 * Dispatches `mada:command:open` so the navbar itself can stay a Server
 * Component.
 */
export function NavSearchTrigger() {
  const t = useTranslations("nav.search");
  return (
    <button
      type="button"
      onClick={dispatchCommandOpen}
      aria-label={t("aria")}
      className="hidden md:inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-signal/40 hover:text-foreground"
    >
      <SearchIcon className="size-3" />
      <span className="font-mono uppercase tracking-wider">{t("label")}</span>
      <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px]">
        ⌘K
      </kbd>
    </button>
  );
}
