"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRightIcon, SparklesIcon, CommandIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BgGrid, MeshGradient } from "@/components/home/BgGrid";
import { LiveTicker } from "@/components/home/LiveTicker";
import { dispatchCommandOpen } from "@/components/home/CommandPaletteHost";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Hero — Industrial-Futurism landing block.
 *
 * Layout (desktop, asymmetric 12-col grid):
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  EYEBROW (mono)                                           │
 *   │                                                           │
 *   │  oversized display headline                               │
 *   │  ────────────────────                                     │
 *   │  sub copy + dual CTA                  spec terminal card  │
 *   │  ⌘K hint                              (mono, glassy)      │
 *   └───────────────────────────────────────────────────────────┘
 *   ── live ticker rail ──
 *
 * Background: dot-grid + drifting mesh gradient. Pure CSS animations,
 * GPU-only transforms.
 */

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.08 * i, ease: EASE },
  }),
};

export function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative overflow-hidden bg-background">
      <MeshGradient />
      <BgGrid pattern="dot" className="opacity-60" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pt-16 pb-12 sm:px-6 sm:pt-24 lg:grid-cols-12 lg:gap-12 lg:pt-32 lg:pb-20">
        {/* ── Left: copy ────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <motion.p
            custom={0}
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            className="text-eyebrow"
          >
            <span className="mr-2 inline-block size-1.5 translate-y-[-2px] rounded-full bg-signal align-middle animate-signal-pulse" />
            {t("eyebrow")}
          </motion.p>

          <motion.h1
            custom={1}
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            className="text-display mt-6 text-balance text-foreground"
          >
            {t("titleBefore")}{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-br from-signal to-[color:var(--gold)] bg-clip-text text-transparent">
                {t("titleHighlight")}
              </span>
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-1 h-3 rounded-full bg-signal/20 blur-md"
              />
            </span>{" "}
            {t("titleAfter")}
          </motion.h1>

          <motion.p
            custom={2}
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {t("body")}
          </motion.p>

          <motion.div
            custom={3}
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button
              render={<Link href="/register" />}
              size="lg"
              className={cn(
                "group h-11 gap-2 px-5 text-sm font-semibold",
                "bg-signal text-signal-foreground hover:bg-signal/90"
              )}
            >
              {t("openAccount")}
              <ArrowUpRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>

            <Button
              render={<Link href="/chat" />}
              size="lg"
              variant="outline"
              className="group h-11 gap-2 border-signal/40 px-5 text-sm font-medium hover:border-signal hover:bg-signal/5"
            >
              <SparklesIcon className="size-4 text-signal" />
              {t("askAi")}
            </Button>
          </motion.div>

          <motion.button
            custom={4}
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            type="button"
            onClick={dispatchCommandOpen}
            className={cn(
              "mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs",
              "text-muted-foreground transition-all hover:border-signal/40 hover:text-foreground"
            )}
          >
            <CommandIcon className="size-3" />
            <span className="font-mono uppercase tracking-wider">
              {t("searchHint")}
            </span>
            <kbd className="ml-1 inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </motion.button>
        </div>

        {/* ── Right: spec-sheet terminal card ───────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          className="lg:col-span-5 lg:pt-6"
        >
          <SpecTerminal matchScoreLabel={t("terminal.matchScore")} />
        </motion.div>
      </div>

      <LiveTicker />
    </section>
  );
}

/**
 * Glassy "spec sheet" card styled like a developer terminal. Renders an
 * inline COA snippet for MADA1 +80 mesh — keeps the trader/credibility
 * angle without resorting to stock photography.
 */
function SpecTerminal({ matchScoreLabel }: { matchScoreLabel: string }) {
  return (
    <div className="group relative">
      {/* Glow halo (signal cyan) */}
      <div
        aria-hidden
        className="absolute -inset-x-4 -inset-y-2 rounded-3xl bg-signal/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-xl",
          "transition-shadow duration-300 group-hover:shadow-[0_0_60px_-12px_color-mix(in_oklch,var(--signal)_50%,transparent)]"
        )}
      >
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500/60" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            COA · MADA1-+80M-260512
          </p>
          <span className="size-2.5" />
        </div>

        {/* Body */}
        <div className="space-y-4 p-5 font-mono text-[11px] leading-relaxed sm:p-6 sm:text-xs">
          <CodeLine k="brand" v="MADA1" hl />
          <CodeLine k="grade" v="+80 mesh / -100 mesh" />
          <CodeLine k="fixed_carbon" v="95.8%" />
          <CodeLine k="moisture" v="0.32%" />
          <CodeLine k="ash" v="3.71%" />
          <CodeLine k="volatile" v="0.17%" />
          <CodeLine k="bulk_density_g_cm3" v="0.51" />

          <div className="my-2 h-px bg-border" />

          <CodeLine k="origin" v="Antsirakambo · Tamatave · MG" />
          <CodeLine k="incoterm" v="CFR Rotterdam" />
          <CodeLine k="lot_size_mt" v="200" />
          <CodeLine k="settlement" v="USDT-TRC20 · USDI · MUP · Bank" hl />

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {matchScoreLabel}
            </p>
            <p className="flex items-center gap-2 text-signal">
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-signal/60" />
                <span className="relative inline-flex size-2 rounded-full bg-signal" />
              </span>
              <span className="font-semibold tabular-nums">98.2</span>
              <span className="text-muted-foreground">/ 100</span>
            </p>
          </div>
        </div>

        {/* Shimmer overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-signal/8 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function CodeLine({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={cn(
          "tabular-nums",
          hl ? "text-signal font-medium" : "text-foreground/85"
        )}
      >
        {v}
      </span>
    </div>
  );
}
