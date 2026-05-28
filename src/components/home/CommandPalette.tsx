"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  SearchIcon,
  PackageIcon,
  GlobeIcon,
  LeafIcon,
  BotIcon,
  ShoppingBagIcon,
  FileTextIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ⌘K command palette. Opens via:
 *   - global hotkey (Cmd/Ctrl + K)
 *   - imperatively via the `open` / `onOpenChange` props (e.g. clicked from
 *     the hero search hint or navbar)
 *
 * Items are static for MVP — products / pages / quick actions. As the
 * product catalogue grows we can swap the source for a Supabase query.
 */

type CmdItem = {
  id: string;
  label: string;
  hint: string;
  href: string;
  Icon: LucideIcon;
  keywords?: string[];
};

const ITEM_META: Record<string, { href: string; Icon: LucideIcon }> = {
  mada1: { href: "/products", Icon: PackageIcon },
  mada2: { href: "/products", Icon: PackageIcon },
  custom: { href: "/products", Icon: PackageIcon },
  market: { href: "/market", Icon: ShoppingBagIcon },
  ai: { href: "/chat", Icon: BotIcon },
  esg: { href: "/sustainability", Icon: LeafIcon },
  geopolitics: { href: "/geopolitics", Icon: GlobeIcon },
  kyc: { href: "/register", Icon: FileTextIcon },
};

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isOpenKey =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isOpenKey) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-md"
            onClick={() => onOpenChange(false)}
          />
          {/* Panel content lives in an inner component so its state (query
              / highlight) resets naturally on every open via mount. */}
          <PalettePanel onOpenChange={onOpenChange} />
        </>
      )}
    </AnimatePresence>
  );
}

function PalettePanel({ onOpenChange }: { onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const t = useTranslations("home.commandPalette");
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const items = React.useMemo(
    () =>
      (t.raw("items") as Array<Omit<CmdItem, "href" | "Icon">>).map((item) => ({
        ...item,
        href: ITEM_META[item.id]?.href ?? "/",
        Icon: ITEM_META[item.id]?.Icon ?? FileTextIcon,
      })),
    [t]
  );

  // React 19 "store info from previous render" pattern — keeps highlight in
  // bounds when the filtered list shrinks, without setState-in-effect.
  const [prevQuery, setPrevQuery] = React.useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setActive(0);
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) ||
        it.hint.toLowerCase().includes(q) ||
        it.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [items, query]);

  function go(item: CmdItem) {
    onOpenChange(false);
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && filtered[active]) {
      e.preventDefault();
      go(filtered[active]);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{
        duration: 0.18,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      }}
      className={cn(
        "fixed left-1/2 top-[18vh] z-[81] w-[min(640px,92vw)] -translate-x-1/2",
        "overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
        "signal-glow"
      )}
      role="dialog"
      aria-label={t("aria")}
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SearchIcon className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ESC
        </kbd>
      </div>

      <ul className="max-h-[60vh] overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </li>
        ) : (
          filtered.map((it, i) => {
            const Icon = it.Icon;
            const isActive = i === active;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-signal/10 text-foreground"
                      : "text-foreground/80 hover:bg-muted/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border border-border bg-background",
                      isActive && "border-signal/50 text-signal"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">{it.label}</span>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      {it.hint}
                    </span>
                  </span>
                  {isActive && (
                    <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      ↵
                    </kbd>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{t("navigate")}</span>
        <span>{t("open")}</span>
        <span>{t("dismiss")}</span>
      </div>
    </motion.div>
  );
}
