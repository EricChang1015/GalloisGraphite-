"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheckIcon,
  AnchorIcon,
  MapPinIcon,
  ClockIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BgGrid } from "@/components/home/BgGrid";
import { cn } from "@/lib/utils";

/**
 * China+1 / Strategic-sourcing section, redesigned as an "interactive supply
 * map".
 *
 * The map is an SVG world silhouette with:
 *   - Madagascar marker (origin) glowing in signal-cyan
 *   - Tamatave deep-water port marker (45 km away)
 *   - Animated arcs to Rotterdam, Hamburg, Yokohama, Mumbai, Houston,
 *     Sao Paulo — drawn with stroke-dashoffset transitions
 *
 * To stay under control we use a stylised, low-poly Equirectangular world
 * outline (no external GeoJSON / map library).
 */

const CRITICAL_LISTS = [
  { label: "US Critical Minerals List", flag: "🇺🇸" },
  { label: "EU Critical Raw Materials Act", flag: "🇪🇺" },
  { label: "Japan METI Strategic Minerals", flag: "🇯🇵" },
  { label: "Korea MOTIE Critical Resources", flag: "🇰🇷" },
  { label: "India Critical Minerals Mission", flag: "🇮🇳" },
];

const ADVANTAGES = [
  {
    Icon: ShieldCheckIcon,
    title: "China+1 sourcing option",
    body: "Madagascar-origin graphite adds a documented second-source pathway alongside established Chinese supply. Origin-traceable lots with full chain-of-custody documentation.",
  },
  {
    Icon: AnchorIcon,
    title: "Deep-water port 45 km away",
    body: "Site No. 1 (Antsirakambo) sits 45 km from the international port of Tamatave. Transit time to major destinations: 10–60 days.",
  },
  {
    Icon: MapPinIcon,
    title: "Comparable metallurgy, qualification required",
    body: "Gallois flake can be compared against Heilongjiang and Inner Mongolia reference grades. Final substitution depends on customer qualification, COA review, and application-specific testing.",
  },
  {
    Icon: ClockIcon,
    title: "Operating since 1901",
    body: "Long enough to be infrastructure, not a startup risk. Continuous supply through two world wars, independence, and the energy transition.",
  },
];

// Lat/long roughly mapped to viewBox 0..100 / 0..50 (equirectangular, simplified).
// Origin: Tamatave / Toamasina (~−18.15°, 49.4°)
const ORIGIN = { x: 60.6, y: 30.5, label: "Toamasina" };

const DESTINATIONS = [
  { id: "rot", x: 47, y: 13, label: "Rotterdam" },
  { id: "ham", x: 49, y: 12.5, label: "Hamburg" },
  { id: "yok", x: 84, y: 16, label: "Yokohama" },
  { id: "mum", x: 65, y: 20.5, label: "Mumbai" },
  { id: "hou", x: 22, y: 19, label: "Houston" },
  { id: "spo", x: 32, y: 33, label: "São Paulo" },
];

export function SupplyMap() {
  return (
    <section className="relative border-y border-border bg-surface-1">
      <BgGrid pattern="line" className="opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        {/* Header */}
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl space-y-4">
            <p className="text-eyebrow">Strategic sourcing · Critical mineral</p>
            <h2 className="text-display-sm text-balance text-foreground">
              Graphite is on every critical-mineral list.{" "}
              <span className="text-signal">
                Your supply map needs China+1 optionality.
              </span>
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              China remains central to the graphite industry. Mada Graphite
              complements that base with a Madagascar-origin supply option for
              buyers who need redundancy, traceability, and procurement
              flexibility.
            </p>
          </div>
          <Button
            render={<Link href="/geopolitics" />}
            variant="outline"
            size="lg"
            className="h-10 shrink-0 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
          >
            Read the strategic case
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>

        {/* Interactive map */}
        <div className="mt-12 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <WorldMap />

          {/* Critical-mineral chip grid */}
          <div className="space-y-4 lg:col-span-4">
            <p className="text-eyebrow">Designated critical mineral by</p>
            <ul className="grid gap-2">
              {CRITICAL_LISTS.map((c) => (
                <li
                  key={c.label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs"
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="font-medium text-foreground/85">{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Advantage cards */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ADVANTAGES.map((a, idx) => {
            const Ic = a.Icon;
            return (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className={cn(
                  "group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5",
                  "transition-colors hover:border-signal/40"
                )}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background transition-colors group-hover:border-signal/40 group-hover:text-signal">
                  <Ic className="size-4" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{a.body}</p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA strip */}
        <div className="mt-12 grid items-center gap-4 rounded-2xl border border-signal/30 bg-card/50 p-5 backdrop-blur sm:grid-cols-[1fr_auto] sm:p-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Re-mapping your supply chain?
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Long-term supply agreements with locked volumes, USD pricing,
              origin-traceable documentation, and transaction-level compliance
              screening.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              render={<Link href="/geopolitics" />}
              size="lg"
              className="h-10 bg-signal text-signal-foreground hover:bg-signal/90"
            >
              The strategic case
            </Button>
            <Button
              render={<Link href="/register" />}
              size="lg"
              variant="outline"
              className="h-10"
            >
              Request KYC pack
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Stylised world map. Uses a small set of polygon paths approximating major
 * landmasses — accuracy is not a goal; visual context is. Routes draw in
 * sequentially via stroke-dashoffset transitions.
 *
 * viewBox: 100 × 50 (equirectangular projection-ish).
 */
function WorldMap() {
  const [hover, setHover] = React.useState<string | null>(null);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card lg:col-span-8">
      <div className="absolute inset-0 bg-grid-line opacity-20" aria-hidden />
      {/* Latitude guides (decorative) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex flex-col justify-between py-8 px-6 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50"
      >
        <span>60° N · Hamburg · Rotterdam</span>
        <span>0° · Equator</span>
        <span>23° S · Tropic of Capricorn</span>
      </div>

      <svg
        viewBox="0 0 100 50"
        className="relative aspect-[2/1] w-full"
        role="img"
        aria-label="Madagascar to global destinations supply map"
      >
        <defs>
          <linearGradient id="route" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.05" />
            <stop offset="50%" stopColor="var(--signal)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="origin-glow">
            <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Stylised landmasses */}
        <g
          fill="color-mix(in oklch, var(--foreground) 8%, transparent)"
          stroke="color-mix(in oklch, var(--foreground) 16%, transparent)"
          strokeWidth="0.18"
          strokeLinejoin="round"
        >
          {/* North America */}
          <path d="M8,8 L14,5 L22,4 L30,7 L34,12 L32,18 L28,24 L22,26 L16,24 L11,18 L8,12 Z" />
          {/* South America */}
          <path d="M26,28 L32,28 L36,32 L36,42 L32,46 L28,46 L26,40 L26,34 Z" />
          {/* Greenland */}
          <path d="M36,4 L41,3 L43,7 L41,11 L36,11 Z" />
          {/* Europe */}
          <path d="M45,10 L52,8 L57,11 L57,16 L52,17 L46,16 L44,13 Z" />
          {/* Africa */}
          <path d="M50,18 L56,17 L60,20 L62,26 L60,32 L57,38 L52,40 L48,36 L46,30 L47,24 Z" />
          {/* Madagascar (highlighted) */}
          <path
            d="M59.6,29.4 L61.4,29.6 L62,32 L60.6,33.5 L59.4,32.5 Z"
            fill="color-mix(in oklch, var(--signal) 50%, transparent)"
            stroke="var(--signal)"
            strokeWidth="0.3"
          />
          {/* Middle East / India */}
          <path d="M58,16 L64,15 L68,18 L66,22 L62,21 L58,18 Z" />
          {/* Asia (huge blob) */}
          <path d="M64,8 L82,5 L92,10 L94,16 L88,22 L80,21 L72,19 L66,16 Z" />
          {/* SE Asia */}
          <path d="M80,22 L86,22 L88,26 L84,28 L80,26 Z" />
          {/* Australia */}
          <path d="M82,33 L92,33 L94,38 L90,42 L84,42 L82,38 Z" />
        </g>

        {/* Routes (Madagascar -> destinations) */}
        <g fill="none" strokeLinecap="round" strokeWidth="0.18">
          {DESTINATIONS.map((d, i) => {
            const path = arcPath(ORIGIN.x, ORIGIN.y, d.x, d.y);
            const isHover = hover === d.id;
            return (
              <g key={d.id}>
                <motion.path
                  d={path}
                  stroke="url(#route)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1.4, delay: 0.2 + i * 0.18 }}
                  style={{ filter: isHover ? "drop-shadow(0 0 1.5px var(--signal))" : undefined }}
                />
              </g>
            );
          })}
        </g>

        {/* Destination markers */}
        {DESTINATIONS.map((d, i) => (
          <g
            key={`m-${d.id}`}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer"
          >
            <motion.circle
              cx={d.x}
              cy={d.y}
              r="0.8"
              fill="var(--signal)"
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.18 }}
            />
            <text
              x={d.x}
              y={d.y - 1.6}
              fontSize="1.6"
              fill="var(--foreground)"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
              opacity={hover === d.id ? 1 : 0.7}
            >
              {d.label}
            </text>
          </g>
        ))}

        {/* Origin halo */}
        <circle cx={ORIGIN.x} cy={ORIGIN.y} r="3.5" fill="url(#origin-glow)" />
        <circle
          cx={ORIGIN.x}
          cy={ORIGIN.y}
          r="1.1"
          fill="var(--signal)"
          stroke="var(--background)"
          strokeWidth="0.2"
        />
        <text
          x={ORIGIN.x}
          y={ORIGIN.y + 3}
          fontSize="1.8"
          fill="var(--signal)"
          fontFamily="var(--font-mono)"
          fontWeight="600"
          textAnchor="middle"
        >
          {ORIGIN.label} · MG
        </text>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-signal animate-signal-pulse" />
          Origin · 45 km from Tamatave port
        </span>
        <span>Transit · 10–60 days</span>
      </div>
    </div>
  );
}

function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  // Quadratic bezier with a control point lifted toward the top of the
  // viewport, giving the great-circle "arc" feel without needing real
  // spherical math.
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.18 - 4;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}
