"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, MountainSnowIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BgGrid } from "@/components/home/BgGrid";
import { cn } from "@/lib/utils";

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

export function SustainabilityDashboard() {
  const t = useTranslations("home.sustainabilityDashboard");
  const pillars = t.raw("pillars") as Array<{ k: string; v: string }>;

  return (
    <section className="relative border-y border-border bg-surface-1">
      <BgGrid pattern="line" className="opacity-25" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        {/* Header */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-eyebrow">{t("eyebrow")}</p>
            <h2 className="text-display-sm text-balance text-foreground">
              {t("titleBefore")}{" "}
              <span className="text-signal">{t("titleHighlight")}</span>
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("body")}
            </p>
          </div>
          <Button
            render={<Link href="/sustainability" />}
            variant="outline"
            size="lg"
            className="h-10 shrink-0 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
          >
            {t("readBrief")}
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
          {pillars.map((p) => (
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
          {t("disclaimer")}{" "}
          <Link
            href="/sustainability"
            className="text-signal underline-offset-2 hover:underline"
          >
            {t("readDisclosure")}
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ── Intensity bar chart (pure SVG) ─────────────────────────────── */

type IntensityDatum = {
  name: string;
  energy: number;
  water: number;
  diesel: number;
};

type IntensityMetricKey = "energy" | "water" | "diesel";

type TooltipState = {
  x: number;
  y: number;
  category: string;
  rows: Array<{ name: string; value: number }>;
};

const CHART = {
  width: 420,
  height: 200,
  margin: { top: 8, right: 8, bottom: 36, left: 32 },
  maxY: 100,
  yTicks: [0, 25, 50, 75, 100],
} as const;

function IntensityPanel() {
  const t = useTranslations("home.sustainabilityDashboard");
  const data = t.raw("intensityData") as IntensityDatum[];
  const metrics: Array<{ key: IntensityMetricKey; label: string }> = [
    { key: "energy", label: t("metrics.energy") },
    { key: "water", label: t("metrics.water") },
    { key: "diesel", label: t("metrics.diesel") },
  ];
  const [tooltip, setTooltip] = React.useState<TooltipState | null>(null);

  const plotW = CHART.width - CHART.margin.left - CHART.margin.right;
  const plotH = CHART.height - CHART.margin.top - CHART.margin.bottom;
  const groupCount = data.length;
  const groupGap = 28;
  const groupWidth = (plotW - groupGap * (groupCount - 1)) / groupCount;
  const barGap = 6;
  const barWidth = (groupWidth - barGap * (metrics.length - 1)) / metrics.length;

  return (
    <Panel className="lg:col-span-7 lg:row-span-1" label={t("intensityLabel")}>
      <h3 className="text-base font-semibold text-foreground">
        {t("intensityTitle")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("intensityBody")}
      </p>

      <div className="relative mt-4 h-[220px] w-full">
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="size-full"
          role="img"
          aria-label={t("intensityTitle")}
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

          <g transform={`translate(${CHART.margin.left}, ${CHART.margin.top})`}>
            {CHART.yTicks.map((tick) => {
              const y = plotH - (tick / CHART.maxY) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={0}
                    y1={y}
                    x2={plotW}
                    y2={y}
                    stroke="color-mix(in oklch, var(--foreground) 8%, transparent)"
                    strokeWidth={0.5}
                  />
                  <text
                    x={-8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="var(--muted-foreground)"
                    fontFamily="var(--font-mono)"
                    fontSize={10}
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {data.map((item, groupIndex) => {
              const groupX = groupIndex * (groupWidth + groupGap);
              const fill = groupIndex === 0 ? "url(#bar-grey)" : "url(#bar-signal)";

              return (
                <g key={item.name} transform={`translate(${groupX}, 0)`}>
                  {metrics.map((metric, metricIndex) => {
                    const value = item[metric.key];
                    const barH = (value / CHART.maxY) * plotH;
                    const x = metricIndex * (barWidth + barGap);
                    const y = plotH - barH;
                    const opacity =
                      metric.key === "energy" ? 1 : metric.key === "water" ? 0.7 : 0.45;

                    return (
                      <rect
                        key={metric.key}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barH}
                        rx={4}
                        ry={4}
                        fill={fill}
                        fillOpacity={opacity}
                        className="cursor-pointer"
                        onMouseEnter={(event) => {
                          const svg = event.currentTarget.ownerSVGElement;
                          const rect = svg?.getBoundingClientRect();
                          if (!rect) return;
                          const scaleX = rect.width / CHART.width;
                          const scaleY = rect.height / CHART.height;
                          setTooltip({
                            x: rect.left + (CHART.margin.left + groupX + x + barWidth / 2) * scaleX,
                            y: rect.top + (CHART.margin.top + y) * scaleY,
                            category: item.name,
                            rows: metrics.map((m) => ({
                              name: m.label,
                              value: item[m.key],
                            })),
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}

                  <text
                    x={groupWidth / 2}
                    y={plotH + 22}
                    textAnchor="middle"
                    fill="var(--muted-foreground)"
                    fontFamily="var(--font-mono)"
                    fontSize={10}
                  >
                    {item.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {tooltip ? (
          <DashboardTooltip
            x={tooltip.x}
            y={tooltip.y}
            category={tooltip.category}
            rows={tooltip.rows}
          />
        ) : null}
      </div>
    </Panel>
  );
}

function DashboardTooltip({
  x,
  y,
  category,
  rows,
}: {
  x: number;
  y: number;
  category: string;
  rows: Array<{ name: string; value: number }>;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
      style={{ left: x, top: y - 8 }}
    >
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {category}
      </p>
      <ul className="space-y-1 font-mono text-xs">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{row.name}</span>
            <span className="tabular-nums text-foreground">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 365-day production calendar heatmap ─────────────────────────── */

function CalendarPanel() {
  const t = useTranslations("home.sustainabilityDashboard");
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
    <Panel className="lg:col-span-5" label={t("calendarLabel")}>
      <h3 className="text-base font-semibold text-foreground">
        {t("calendarTitle")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("calendarBody")}
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
        <span>{t("low")}</span>
        <div className="flex gap-[2px]">
          {[0.18, 0.4, 0.7, 1].map((v) => (
            <span
              key={v}
              className="size-2.5 rounded-[2px]"
              style={{ background: `color-mix(in oklch, var(--signal) ${Math.round(v * 95)}%, transparent)` }}
            />
          ))}
        </div>
        <span>{t("high")}</span>
      </div>
    </Panel>
  );
}

/* ── ESG roadmap timeline ───────────────────────────────────────── */

function RoadmapPanel() {
  const t = useTranslations("home.sustainabilityDashboard");
  const roadmap = t.raw("roadmap") as Array<{
    year: string;
    text: string;
    state: "done" | "active" | "future";
  }>;

  return (
    <Panel className="lg:col-span-12" label={t("roadmapLabel")}>
      <h3 className="text-base font-semibold text-foreground">
        {t("roadmapTitle")}
      </h3>

      <div className="mt-6 grid gap-4 sm:grid-cols-5">
        {roadmap.map((r, i) => (
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
