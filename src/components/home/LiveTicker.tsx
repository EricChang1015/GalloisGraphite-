"use client";

import { ActivityIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trade-desk "ticker" rail rendered just below the hero. Items represent
 * realistic-looking inquiry / contract / shipment activity drawn from the
 * supported product space. Purely illustrative — not live data.
 *
 * Implementation: two duplicated stacks sliding via the `marquee` keyframe.
 * Pause on hover. Mono font for the trader-terminal feel.
 */

type Kind = "INQUIRY" | "CONTRACT" | "PAID" | "SHIPPED" | "QUALIFIED";

const KIND_STYLES: Record<Kind, string> = {
  INQUIRY: "bg-signal/10 text-signal border border-signal/30",
  CONTRACT: "bg-gold/10 text-[color:var(--gold)] border border-[color:var(--gold)]/30",
  PAID: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  SHIPPED: "bg-sky-500/10 text-sky-300 border border-sky-500/30",
  QUALIFIED: "bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30",
};

const ITEMS: Array<{ kind: Kind; text: string }> = [
  { kind: "INQUIRY", text: "MADA1 +80 MESH · 96% C · 200 MT · CFR Rotterdam" },
  { kind: "CONTRACT", text: "MADA2 +50 MESH · 50 MT · USDT-TRC20 · FOB Tamatave" },
  { kind: "PAID", text: "ORD-260512-A91F3 · 124,500 USDT · Verified" },
  { kind: "SHIPPED", text: "Container TGHU-7281 · ETA Hamburg 2026-06-22" },
  { kind: "QUALIFIED", text: "Li-ion anode feed · +150 MESH · 99.0% C target" },
  { kind: "INQUIRY", text: "MADA1 -100 MESH · 75 MT · Bank Transfer · CIF Yokohama" },
  { kind: "CONTRACT", text: "Custom +35 MESH · 80 MT · USDI · CFR Mumbai" },
  { kind: "PAID", text: "ORD-260510-77B22 · 87,200 USDT · Verified" },
  { kind: "SHIPPED", text: "Container HASU-9912 · ETA Antwerp 2026-06-18" },
  { kind: "QUALIFIED", text: "Expandable graphite feed · +80 MESH · 94% C min" },
];

export function LiveTicker() {
  const stack = (
    <div className="flex shrink-0 items-center gap-3 pr-3">
      {ITEMS.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[11px] font-mono whitespace-nowrap"
        >
          <span
            className={cn(
              "rounded-sm px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.18em]",
              KIND_STYLES[item.kind]
            )}
          >
            {item.kind}
          </span>
          <span className="text-foreground/85">{item.text}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      role="marquee"
      aria-label="Recent trade desk activity (illustrative)"
      className="relative border-y border-border bg-background/60 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
          <ActivityIcon className="size-3 text-signal animate-ticker-blink" />
          Live desk
        </div>

        <div className="mask-fade-x relative flex flex-1 overflow-hidden">
          <div className="flex animate-marquee pause-on-hover">
            {stack}
            {stack}
          </div>
        </div>

        <span className="hidden md:inline text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          Illustrative · Not live data
        </span>
      </div>
    </div>
  );
}
