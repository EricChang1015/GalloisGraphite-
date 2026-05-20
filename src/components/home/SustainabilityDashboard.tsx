"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { ArrowRightIcon, MountainSnowIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BgGrid } from "@/components/home/BgGrid";
import { cn } from "@/lib/utils";

/** Returns true only on the client. Safe in React 19 / Next 16 — uses
 *  `useSyncExternalStore` so we avoid the `setState`-in-effect anti-pattern.
 *  Recharts ResponsiveContainer needs a measurable DOM, so we gate it. */
function useIsClient() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * Sustainability section, redesigned as a compact data-viz dashboard.
 *
 * Three panels:
 *   1) Open-cast vs Underground intensity bar chart (illustrative — labelled
 *      "indicative; verified data pending" to honour the disclosure rule).
 *   2) 365-day production calendar heatmap. Each cell = one day. Tropical
 *      Tamatave climate is shown as continuous green; no shutdown bands.
 *   3) ESG roadmap timeline (2024 → 2028).
 *
 * All four PILLARS from the original SustainabilitySection are preserved as
 * captions / tooltips so no copy is lost.
 */

const PILLAR_HIGHLIGHTS = [
  { k: "open_cast", v: "No underground blasting" },
  { k: "production_days", v: "365 / year" },
  { k: "ore_carbon", v: "~10% (operational est.)" },
  { k: "esg_target", v: "Datasheet 2026 · Verified label 2028" },
];

// Indicative — labelled accordingly. Numbers are normalised reference
// figures, NOT a third-party audit.
const INTENSITY_DATA = [
  { name: "Underground", energy: 100, water: 80, diesel: 95, fill: "url(#bar-grey)" },
  { name: "Open-cast (Gallois)", energy: 42, water: 28, diesel: 36, fill: "url(#bar-signal)" },
];

export function SustainabilityDashboard() {
  return (
    <section className="relative border-y border-border bg-surface-1">
      <BgGrid pattern="line" className="opacity-25" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        {/* Header */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-eyebrow">Lower-impact extraction</p>
            <h2 className="text-display-sm text-balance text-foreground">
              A graphite supply that{" "}
              <span className="text-signal">doesn&apos;t cost the climate twice.</span>
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Most flake graphite is mined underground in metamorphic basins
              with energy-intensive flotation. Gallois is structurally
              different — open-cast, high-grade, and operating in a climate
              that never requires a seasonal shutdown.
            </p>
          </div>
          <Button
            render={<Link href="/sustainability" />}
            variant="outline"
            size="lg"
            className="h-10 shrink-0 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
          >
            Read the ESG brief
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>

        {/* Dashboard grid */}
        <div className="mt-12 grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
          <IntensityPanel />
          <CalendarPanel />
          <RoadmapPanel />
        </div>

        {/* Pillar key-value strip */}
        <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {PILLAR_HIGHLIGHTS.map((p) => (
            <li key={p.k} className="bg-card px-4 py-4 sm:px-5 sm:py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {p.k}
              </p>
              <p className="mt-1.5 text-sm text-foreground">{p.v}</p>
            </li>
          ))}
        </ul>

        {/* Honest disclaimer */}
        <p className="mt-8 max-w-3xl border-l-2 border-signal/40 pl-4 text-xs leading-relaxed text-muted-foreground/80">
          All figures are based on operational estimates. Third-party
          verification is in progress; verified data will replace estimates as
          audits complete.{" "}
          <Link
            href="/sustainability"
            className="text-signal underline-offset-2 hover:underline"
          >
            Read the full disclosure →
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ── Intensity bar chart ────────────────────────────────────────── */

function IntensityPanel() {
  // Defer Recharts to the client only; ResponsiveContainer can't measure
  // a 0×0 SSR DOM tree, which produces a noisy build warning.
  const mounted = useIsClient();

  return (
    <Panel className="lg:col-span-7 lg:row-span-1" label="Intensity index · indicative">
      <h3 className="text-base font-semibold text-foreground">
        Open-cast vs underground · normalised intensity
      </h3>
      <p className="text-xs text-muted-foreground">
        Reference comparison only. Verified Gallois figures will replace this
        chart as third-party audits complete.
      </p>

      <div className="mt-4 h-[220px] w-full">
        {mounted ? (
        <ResponsiveContainer
          width="100%"
          height="100%"
          // Workaround for recharts 3.x noisy "width(-1) and height(-1)"
          // console warning during the brief gap between first render and
          // ResizeObserver settling. See recharts/recharts#6716 (fix landed
          // post-3.8.1; remove this prop once the upstream patch ships).
          initialDimension={{ width: 100, height: 220 }}
        >
          <BarChart
            data={INTENSITY_DATA}
            barCategoryGap={28}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="bar-grey" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="color-mix(in oklch, var(--foreground) 22%, transparent)" />
                <stop offset="100%" stopColor="color-mix(in oklch, var(--foreground) 8%, transparent)" />
              </linearGradient>
              <linearGradient id="bar-signal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--signal)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--signal)" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)", fontSize: 10 }}
              width={28}
            />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<DashboardTooltip />} />
            <Bar dataKey="energy" name="Energy" radius={[4, 4, 0, 0]}>
              {INTENSITY_DATA.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
            <Bar dataKey="water" name="Water" radius={[4, 4, 0, 0]} fillOpacity={0.7}>
              {INTENSITY_DATA.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
            <Bar dataKey="diesel" name="Diesel" radius={[4, 4, 0, 0]} fillOpacity={0.45}>
              {INTENSITY_DATA.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        ) : (
          <div className="size-full animate-pulse rounded-xl bg-muted/30" />
        )}
      </div>
    </Panel>
  );
}

function DashboardTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 p-3 backdrop-blur shadow-lg">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {payload.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{p.name}</span>
            <span className="tabular-nums text-foreground">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 365-day production calendar heatmap ─────────────────────────── */

function CalendarPanel() {
  // Build 52 weeks × 7 days = 364 cells. We tint each cell by a simulated
  // utilisation index — Tamatave runs year-round; only short cyclone-window
  // dips appear (cells 0–6, 32–38, 220–226 modelled as light dips).
  const cells = React.useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 7 * 52; i++) {
      // Base 0.7–1.0 utilisation
      let u = 0.7 + ((i * 7919) % 30) / 100;
      // Soft "wet season" dip in early Jan / mid-Mar bands (decorative)
      if ((i > 0 && i < 14) || (i > 64 && i < 75)) u *= 0.78;
      arr.push(Math.min(1, u));
    }
    return arr;
  }, []);

  return (
    <Panel className="lg:col-span-5" label="Production calendar · 365 days">
      <h3 className="text-base font-semibold text-foreground">
        Year-round production
      </h3>
      <p className="text-xs text-muted-foreground">
        Continuous operation in Tamatave&apos;s 15–35 °C climate. Cell tint shows
        modelled utilisation — actual lot-level uptime ships with the COA.
      </p>

      <div className="mt-5 grid grid-flow-col grid-rows-7 gap-[3px]">
        {cells.map((u, i) => (
          <span
            key={i}
            title={`Day ${i + 1} · ${(u * 100).toFixed(0)}%`}
            className="aspect-square rounded-[2px]"
            style={{
              background:
                u > 0.95
                  ? "color-mix(in oklch, var(--signal) 95%, transparent)"
                  : u > 0.85
                    ? "color-mix(in oklch, var(--signal) 65%, transparent)"
                    : u > 0.75
                      ? "color-mix(in oklch, var(--signal) 35%, transparent)"
                      : "color-mix(in oklch, var(--signal) 14%, transparent)",
            }}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Low</span>
        <div className="flex gap-[2px]">
          {[0.18, 0.4, 0.7, 1].map((v) => (
            <span
              key={v}
              className="size-2.5 rounded-[2px]"
              style={{ background: `color-mix(in oklch, var(--signal) ${Math.round(v * 95)}%, transparent)` }}
            />
          ))}
        </div>
        <span>High</span>
      </div>
    </Panel>
  );
}

/* ── ESG roadmap timeline ───────────────────────────────────────── */

const ROADMAP = [
  { year: "2024", text: "Operational baseline · 140k t/a capacity reached", state: "done" as const },
  { year: "2025", text: "Lot-level COA + chain-of-custody documentation rolled out", state: "done" as const },
  { year: "2026", text: "ESG datasheet attached to every shipment", state: "active" as const },
  { year: "2027", text: "Pilot third-party audit (energy / water / diesel)", state: "future" as const },
  { year: "2028", text: "Verified carbon-intensity label per lot", state: "future" as const },
];

function RoadmapPanel() {
  return (
    <Panel className="lg:col-span-12" label="Disclosure roadmap · 2024 → 2028">
      <h3 className="text-base font-semibold text-foreground">
        From operational estimates to verified, lot-level disclosure
      </h3>

      <div className="mt-6 grid gap-4 sm:grid-cols-5">
        {ROADMAP.map((r, i) => (
          <motion.div
            key={r.year}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="relative rounded-xl border border-border bg-background/40 p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2 rounded-full",
                  r.state === "done" && "bg-emerald-400",
                  r.state === "active" && "bg-signal animate-signal-pulse",
                  r.state === "future" && "bg-muted-foreground/40"
                )}
              />
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {r.year}
              </p>
            </div>
            <p className="mt-3 text-sm leading-snug text-foreground/85">
              {r.text}
            </p>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}

/* ── Shared panel chrome ────────────────────────────────────────── */

function Panel({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-eyebrow">{label}</p>
        <MountainSnowIcon className="size-3.5 text-muted-foreground/60" />
      </div>
      {children}
    </div>
  );
}
