"use client";

import React from "react";
import Link from "next/link";
import { BotMessageSquareIcon, LeafIcon, GlobeIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 6500;

const NARRATIVES = [
  {
    id: "ai",
    Icon: BotMessageSquareIcon,
    label: "AI Trading",
    eyebrow: "AI-Native Trading · 2026",
    headline: "Where Madagascar's graphite meets a transparent, AI-assisted trade desk.",
    sub: "Mada Graphite turns 124 years of mining knowhow into a frictionless B2B platform. Inquire, contract, settle and ship — with a multilingual AI co-pilot reading specs, prices and routes alongside you.",
    ctas: [
      { label: "Open an account", href: "/register", outline: false },
      { label: "Ask the AI assistant", href: "/chat", outline: true },
    ],
    stats: [
      { value: "124 yrs", label: "Operating history" },
      { value: "140k t", label: "Annual capacity" },
      { value: "AI", label: "Spec-matching co-pilot" },
      { value: "24 h", label: "Contract generation" },
    ],
    accentLight: "#a06c00",
    accentDark: "#c9a961",
    pillClass: "data-[active=true]:bg-[color:var(--gold)] data-[active=true]:text-black",
    barClass: "bg-[color:var(--gold)]",
    eyebrowClass: "text-[color:var(--gold)]",
  },
  {
    id: "esg",
    Icon: LeafIcon,
    label: "Sustainability",
    eyebrow: "Open-cast · Year-round · No tailings dam",
    headline: "A graphite supply that doesn't cost the climate twice.",
    sub: "Open-cast deposit, weathering-formed ore, ~10% carbon at the surface — Gallois delivers high-grade flake without the energy and waste burden of metamorphic underground operations. Madagascar's stable climate enables 365-day production with no seasonal stockpile.",
    ctas: [
      { label: "Read the ESG brief", href: "/sustainability", outline: false },
      { label: "Talk to a specialist", href: "/chat", outline: true },
    ],
    stats: [
      { value: "~10%", label: "Ore carbon grade" },
      { value: "365", label: "Production days/year" },
      { value: "0", label: "Tailings dams" },
      { value: "2027", label: "Carbon-disclosed target" },
    ],
    accentLight: "#166534",
    accentDark: "#4ade80",
    pillClass: "data-[active=true]:bg-emerald-500 data-[active=true]:text-white dark:data-[active=true]:bg-emerald-400 dark:data-[active=true]:text-black",
    barClass: "bg-emerald-500 dark:bg-emerald-400",
    eyebrowClass: "text-emerald-700 dark:text-emerald-400",
  },
  {
    id: "geo",
    Icon: GlobeIcon,
    label: "Geopolitics",
    eyebrow: "Strategic Mineral · Non-Chinese Origin",
    headline: "A flake graphite supply outside Chinese export-control reach.",
    sub: "Since China's 2023 export-licensing regime on natural graphite, OEMs have been re-mapping their critical-mineral supply. Etablissements Gallois operates the world's largest non-Chinese natural flake graphite mine — same metallurgy, fewer policy risks, transparent paperwork.",
    ctas: [
      { label: "Why Madagascar", href: "/geopolitics", outline: false },
      { label: "Request KYC pack", href: "/register", outline: true },
    ],
    stats: [
      { value: "US", label: "Critical Minerals List" },
      { value: "EU", label: "Critical Raw Materials Act" },
      { value: "45 km", label: "To Tamatave deep port" },
      { value: "0", label: "Active trade sanctions" },
    ],
    accentLight: "#0369a1",
    accentDark: "#38bdf8",
    pillClass: "data-[active=true]:bg-sky-500 data-[active=true]:text-white dark:data-[active=true]:bg-sky-400 dark:data-[active=true]:text-black",
    barClass: "bg-sky-500 dark:bg-sky-400",
    eyebrowClass: "text-sky-700 dark:text-sky-400",
  },
] as const;

export function HeroNarrative() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const n = NARRATIVES[active];

  // Auto-advance — resets whenever `active` changes so manual clicks restart the timer.
  React.useEffect(() => {
    if (paused) return;
    const id = setTimeout(
      () => setActive((a) => (a + 1) % NARRATIVES.length),
      INTERVAL_MS
    );
    return () => clearTimeout(id);
  }, [active, paused]);

  function go(idx: number) {
    setActive(idx);
  }

  return (
    <section
      className="relative overflow-hidden border-b border-border bg-background"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28 grid gap-12 md:grid-cols-[1fr_auto]">
        {/* ── Left: narrative content ── */}
        <div className="space-y-7 max-w-2xl">
          <p
            key={`eyebrow-${n.id}`}
            className={cn(
              "text-xs uppercase tracking-[0.3em] animate-in fade-in slide-in-from-bottom-2 duration-300",
              n.eyebrowClass
            )}
          >
            {n.eyebrow}
          </p>

          <h1
            key={`h-${n.id}`}
            className="text-3xl sm:text-5xl font-semibold leading-tight animate-in fade-in slide-in-from-bottom-3 duration-300"
          >
            {n.headline}
          </h1>

          <p
            key={`sub-${n.id}`}
            className="text-muted-foreground text-base sm:text-lg leading-relaxed animate-in fade-in duration-500"
          >
            {n.sub}
          </p>

          <div className="flex flex-wrap gap-3 pt-1 animate-in fade-in duration-500">
            {n.ctas.map((cta) => (
              <Link
                key={cta.label}
                href={cta.href}
                className={cn(
                  buttonVariants({ size: "lg", variant: cta.outline ? "outline" : "default" })
                )}
              >
                {cta.label}
              </Link>
            ))}
          </div>

          {/* ── Tab switcher ── */}
          <div className="pt-2 space-y-3">
            <div role="tablist" className="flex flex-wrap gap-2">
              {NARRATIVES.map((narr, idx) => {
                const Ic = narr.Icon;
                const isActive = idx === active;
                return (
                  <button
                    key={narr.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => go(idx)}
                    data-active={isActive}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
                      "text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      narr.pillClass
                    )}
                  >
                    <Ic className="size-3.5" />
                    {narr.label}
                  </button>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-0.5 w-full max-w-xs rounded-full bg-border overflow-hidden">
              <div
                key={`bar-${active}-${paused}`}
                className={cn(
                  "h-full rounded-full",
                  n.barClass,
                  paused ? "w-full opacity-30" : "w-0 animate-[progress_6.5s_linear_forwards]"
                )}
              />
            </div>
          </div>
        </div>

        {/* ── Right: stats grid ── */}
        <div
          key={`stats-${n.id}`}
          className="hidden md:grid grid-cols-2 gap-3 content-start mt-2 animate-in fade-in duration-300"
        >
          {n.stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card px-5 py-4 min-w-[120px]"
            >
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  n.eyebrowClass
                )}
              >
                {s.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
