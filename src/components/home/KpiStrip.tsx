"use client";

import * as React from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * KPI strip rendered immediately under the hero. Numbers count up on first
 * intersection with the viewport; non-numeric values (e.g. "AI", "1901") are
 * passed through. Mono font for tabular weight, signal-cyan emphasis on the
 * leading digit.
 *
 * The four canonical stats are passed in from the page so other surfaces
 * (about page, dashboard) can reuse the component with a different set.
 */

export type Kpi = {
  /** Final numeric value to count to. Omit if `display` is non-numeric. */
  value?: number;
  /** Pre-formatted display string (e.g. "1901", "AI", "240M t"). Used as
   *  fallback when no `value` is provided. */
  display: string;
  /** Suffix appended after the counted number ("+ yrs", "k t/a", "M t"). */
  suffix?: string;
  /** Short caption printed below the number. */
  label: string;
};

export const HOME_KPIS: ReadonlyArray<Kpi> = [
  { display: "1901", label: "Year founded" },
  { value: 120, suffix: "+ yrs", display: "120+ yrs", label: "Years of production" },
  { value: 240, suffix: "M t", display: "240M t", label: "Estimated reserves" },
  { value: 140, suffix: "k t/a", display: "140k t/a", label: "Reported capacity" },
];

export function KpiStrip({ kpis = HOME_KPIS }: { kpis?: ReadonlyArray<Kpi> }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <section
      ref={ref}
      className="relative border-b border-border bg-surface-1"
      aria-label="Key statistics"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border md:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <KpiCell key={kpi.label} kpi={kpi} index={idx} active={inView} />
        ))}
      </div>
    </section>
  );
}

function KpiCell({ kpi, index, active }: { kpi: Kpi; index: number; active: boolean }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const [text, setText] = React.useState<string>(
    kpi.value !== undefined ? "0" : kpi.display
  );

  React.useEffect(() => {
    if (!active || kpi.value === undefined) return;
    const controls = animate(mv, kpi.value, {
      duration: 1.2,
      delay: index * 0.12,
      ease: EASE,
    });
    const unsub = rounded.on("change", (v) => setText(String(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [active, kpi.value, mv, rounded, index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08, ease: EASE }}
      className={cn(
        "group relative flex flex-col justify-between gap-3 bg-background px-6 py-8 sm:px-8 sm:py-10",
        "transition-colors hover:bg-surface-1"
      )}
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
        0{index + 1}
      </p>

      <div className="flex items-baseline gap-1 font-mono tabular-nums">
        <span className="text-4xl font-bold text-foreground sm:text-5xl">
          {kpi.value !== undefined ? text : kpi.display}
        </span>
        {kpi.suffix && (
          <span className="text-base font-medium text-signal sm:text-lg">
            {kpi.suffix}
          </span>
        )}
      </div>

      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {kpi.label}
      </p>

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-signal opacity-0 transition-all duration-500 group-hover:scale-x-100 group-hover:opacity-100"
      />
    </motion.div>
  );
}
