"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
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
import {
  COUNTRIES,
  MADAGASCAR_ID,
  VIEW_BOX,
  VIEW_W,
  pathGen,
  project,
} from "@/lib/maps/world";

const ADVANTAGE_ICONS = [
  ShieldCheckIcon,
  AnchorIcon,
  MapPinIcon,
  ClockIcon,
];

// ─── How to add a destination port ─────────────────────────────────────────────
//
// 1. Look up the port's decimal longitude/latitude (Wikipedia's infobox shows it)
//      East lon → positive,  West lon → negative
//      North lat → positive, South lat → negative
//
// 2. Append one entry to DESTINATIONS below — that's it. The d3 projection
//    handles all coordinate math; you do NOT need to compute SVG x/y yourself.
//
//      { id: "sgp", lon: 103.85, lat: 1.29, label: "Singapore", transitDays: "~12 days" }
//
// 3. If two ports sit close together and labels overlap (e.g. Rotterdam vs
//    Hamburg), set `labelAnchor: "start"` or `"end"` to push the text aside.
//
// Origin: Toamasina (Tamatave) port, Madagascar — 49.4°E, 18.15°S
const ORIGIN = { lon: 49.4, lat: -18.15, label: "Toamasina" };

type Destination = {
  id: string;
  lon: number;
  lat: number;
  label: string;
  transitDays?: string;
  /** SVG textAnchor for the label — tune this when ports cluster together */
  labelAnchor?: "start" | "middle" | "end";
};

const DESTINATIONS: Destination[] = [
  // --- 您原本的港口（優化坐標至精確港口位置，並修正實際轉運航期） ---
  { id: "rot", lon:    4.11, lat:  51.95, label: "Rotterdam",  transitDays: "~35 days", labelAnchor: "end"   }, // 荷蘭：歐洲最大石墨分銷中心
  { id: "ham", lon:    9.93, lat:  53.54, label: "Hamburg",    transitDays: "~37 days", labelAnchor: "start" }, // 德國：傳統工業與碳素產品進口港
  { id: "yok", lon:  139.68, lat:  35.45, label: "Yokohama",   transitDays: "~32 days" },                       // 日本：東日本核心港口，鄰近部分碳素加工廠
  { id: "mum", lon:   72.95, lat:  18.95, label: "Mumbai (JNPT)", transitDays: "~12 days" },                    // 印度：西岸最大貨櫃港，最快航期
  { id: "hou", lon:  -94.98, lat:  29.68, label: "Houston",    transitDays: "~42 days" },                       // 美國：墨西哥灣傳統工業與耐火材料市場
  { id: "spo", lon:  -46.33, lat: -23.93, label: "Santos (São Paulo)", transitDays: "~18 days" },               // 巴西：桑托斯港（聖保羅外港）

  // --- 🆕 亞洲關鍵石墨與電池材料核心港口 ---
//  { id: "sha", lon:  121.61, lat:  31.37, label: "Shanghai",   transitDays: "~28 days" },                       // 中國：全球最大石墨加工與負極材料市場入口
  { id: "pus", lon:  129.08, lat:  35.10, label: "Busan",      transitDays: "~30 days" },                       // 韓國：三大電池廠（LG、SK、Samsung）戰略進口港
  //{ id: "osa", lon:  135.42, lat:  34.64, label: "Osaka",      transitDays: "~34 days" },                       // 日本：關西工業區，鄰近多家日系負極與碳素大廠
  { id: "hcm", lon:  106.77, lat:  10.76, label: "Ho Chi Minh (Cat Lai)", transitDays: "~25 days" },            // 越南：新興電子與加工供應鏈核心港
  //{ id: "mun", lon:   76.69, lat:  22.84, label: "Mundra",     transitDays: "~14 days" },                       // 印度：古吉拉特邦，西北部工業區重要石墨門戶
    // 新加坡
  { id: "sgp", lon: 103.85, lat:   1.29, label: "Singapore", transitDays: "~12 days" },                       // 新加坡：東南亞最大轉運中心，航線密集且頻次高

  // --- 🆕 歐美關鍵石墨與耐火材料核心港口 ---
  { id: "sav", lon:  -81.14, lat:  32.12, label: "Savannah",   transitDays: "~40 days" },                       // 美國：東岸最大貨櫃港，主供美東汽車與電池供應鏈
  { id: "det", lon:  -83.04, lat:  42.33, label: "Detroit",    transitDays: "~46 days" },                       // 美國：五大湖傳統五金/五大車廠（多經加拿大或東岸內陸轉運）
  //{ id: "ant", lon:    4.33, lat:  51.27, label: "Antwerp",    transitDays: "~34 days" },                       // 比利時：歐洲第二大港，耐火材料與化工核心
  //{ id: "光陽", lon:  127.69, lat:  34.91, label: "Gwangyang",  transitDays: "~29 days" },                       // 韓國：光陽港，POSCO Future M（韓國核心負極廠）所在地
];


export function SupplyMap() {
  const t = useTranslations("home.supplyMap");
  const criticalLists = t.raw("criticalLists") as Array<{
    label: string;
    flag: string;
  }>;
  const advantages = (
    t.raw("advantages") as Array<{ title: string; body: string }>
  ).map((advantage, index) => ({
    ...advantage,
    Icon: ADVANTAGE_ICONS[index] ?? ShieldCheckIcon,
  }));

  return (
    <section className="relative border-y border-border bg-surface-1">
      <BgGrid pattern="line" className="opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        {/* Header */}
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl space-y-4">
            <p className="text-eyebrow">{t("eyebrow")}</p>
            <h2 className="text-display-sm text-balance text-foreground">
              {t("titleBefore")}{" "}
              <span className="text-signal">
                {t("titleHighlight")}
              </span>
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t("body")}
            </p>
          </div>
          <Button
            render={<Link href="/geopolitics" />}
            variant="outline"
            size="lg"
            className="h-10 shrink-0 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
          >
            {t("readCase")}
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>

        {/* Interactive map */}
        <div className="mt-12 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <WorldMap
            mapAria={t("mapAria")}
            originLabel={t("origin")}
            hoverLabel={t("hover")}
          />

          {/* Critical-mineral chip grid */}
          <div className="space-y-4 lg:col-span-4">
            <p className="text-eyebrow">{t("criticalBy")}</p>
            <ul className="grid gap-2">
              {criticalLists.map((c) => (
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
          {advantages.map((a, idx) => {
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
              {t("ctaTitle")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("ctaBody")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              render={<Link href="/geopolitics" />}
              size="lg"
              className="h-10 bg-signal text-signal-foreground hover:bg-signal/90"
            >
              {t("strategicCase")}
            </Button>
            <Button
              render={<Link href="/register" />}
              size="lg"
              variant="outline"
              className="h-10"
            >
              {t("requestKyc")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Real-data world map. Continent paths are generated from Natural Earth 110m
 * country boundaries via d3-geo's `geoNaturalEarth1` projection — the same
 * pipeline used by The New York Times, FT, and most thematic-map publishers.
 *
 * All marker positions come from `project(lon, lat)`, so adding new ports is
 * just appending lat/lng to the DESTINATIONS list above.
 */
function WorldMap({
  mapAria,
  originLabel,
  hoverLabel,
}: {
  mapAria: string;
  originLabel: string;
  hoverLabel: string;
}) {
  const [hover, setHover] = React.useState<string | null>(null);

  // Pre-project once per render (cheap; ~6 ops)
  const originXY = React.useMemo(() => project(ORIGIN.lon, ORIGIN.lat), []);
  const destPoints = React.useMemo(
    () => DESTINATIONS.map((d) => ({ ...d, xy: project(d.lon, d.lat) })),
    []
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card lg:col-span-8">
      <svg
        viewBox={VIEW_BOX}
        className="relative aspect-[2/1] w-full"
        role="img"
        aria-label={mapAria}
      >
        <defs>
          <linearGradient id="sm-route" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="var(--signal)" stopOpacity="0.05" />
            <stop offset="50%"  stopColor="var(--signal)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.05" />
          </linearGradient>

          <radialGradient id="sm-origin-glow">
            <stop offset="0%"   stopColor="var(--signal)" stopOpacity="0.65" />
            <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="sm-ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="color-mix(in oklch, var(--signal) 4%, var(--card))" />
            <stop offset="100%" stopColor="color-mix(in oklch, var(--signal) 1%, var(--card))" />
          </linearGradient>
        </defs>

        {/* Ocean background */}
        <rect width={VIEW_W} height="500" fill="url(#sm-ocean)" />

        {/* Latitude reference lines (projected to follow the curve subtly) */}
        <LatitudeGuides />

        {/* Countries */}
        <g
          fill="color-mix(in oklch, var(--foreground) 11%, transparent)"
          stroke="color-mix(in oklch, var(--foreground) 22%, transparent)"
          strokeWidth="0.6"
          strokeLinejoin="round"
        >
          {COUNTRIES.map((c, i) => {
            const isMG = String(c.id) === MADAGASCAR_ID;
            const d = pathGen(c);
            if (!d) return null;
            return (
              <path
                key={c.id !== undefined ? String(c.id) : `country-${i}`}
                d={d}
                fill={
                  isMG
                    ? "color-mix(in oklch, var(--signal) 50%, transparent)"
                    : undefined
                }
                stroke={isMG ? "var(--signal)" : undefined}
                strokeWidth={isMG ? 1.4 : undefined}
              />
            );
          })}
        </g>

        {/* Supply routes (animated arcs) */}
        <g fill="none" strokeLinecap="round">
          {destPoints.map((d, i) => {
            const path = arcPath(originXY[0], originXY[1], d.xy[0], d.xy[1]);
            const isHover = hover === d.id;
            return (
              <motion.path
                key={d.id}
                d={path}
                stroke="url(#sm-route)"
                strokeWidth={isHover ? 2.2 : 1.4}
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 1.4, delay: 0.2 + i * 0.18 }}
                style={{
                  filter: isHover
                    ? "drop-shadow(0 0 4px var(--signal))"
                    : undefined,
                }}
              />
            );
          })}
        </g>

        {/* Destination markers */}
        {destPoints.map((d, i) => {
          const isHover = hover === d.id;
          const anchor = d.labelAnchor ?? "middle";
          const labelOffset = anchor === "middle" ? 0 : anchor === "start" ? 10 : -10;
          const [mx, my] = d.xy;

          return (
            <g
              key={`m-${d.id}`}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer"
            >
              {isHover && (
                <circle
                  cx={mx}
                  cy={my}
                  r="18"
                  fill="none"
                  stroke="var(--signal)"
                  strokeWidth="1.5"
                  opacity="0.45"
                />
              )}

              <motion.circle
                cx={mx}
                cy={my}
                r={isHover ? 8 : 6}
                fill="var(--signal)"
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.6 + i * 0.18 }}
                style={{
                  filter: isHover
                    ? "drop-shadow(0 0 6px var(--signal))"
                    : undefined,
                }}
              />

              {/* Hit area for easier hover */}
              <circle cx={mx} cy={my} r="20" fill="transparent" />

              <text
                x={mx + labelOffset}
                y={my - 14}
                fontSize="13"
                fill="var(--foreground)"
                fontFamily="var(--font-mono)"
                textAnchor={anchor}
                opacity={isHover ? 1 : 0.75}
              >
                {d.label}
              </text>

              {isHover && d.transitDays && (
                <g pointerEvents="none">
                  <rect
                    x={mx - 50}
                    y={my + 12}
                    width="100"
                    height="26"
                    rx="5"
                    fill="var(--card)"
                    stroke="var(--signal)"
                    strokeWidth="1.2"
                  />
                  <text
                    x={mx}
                    y={my + 30}
                    fontSize="13"
                    fill="var(--signal)"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {d.transitDays}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Origin marker (Toamasina) */}
        <circle
          cx={originXY[0]}
          cy={originXY[1]}
          r="32"
          fill="url(#sm-origin-glow)"
        />
        <circle
          cx={originXY[0]}
          cy={originXY[1]}
          r="9"
          fill="var(--signal)"
          stroke="var(--background)"
          strokeWidth="2"
        />
        <text
          x={originXY[0]}
          y={originXY[1] + 28}
          fontSize="15"
          fill="var(--signal)"
          fontFamily="var(--font-mono)"
          fontWeight="700"
          textAnchor="middle"
        >
          {ORIGIN.label} · MG
        </text>
      </svg>

      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-signal-pulse rounded-full bg-signal" />
          {originLabel}
        </span>
        <span>{hoverLabel}</span>
      </div>
    </div>
  );
}

/**
 * Decorative latitude reference lines + labels. Y-positions come from the
 * shared projection so they stay aligned even if the projection is retuned.
 */
function LatitudeGuides() {
  const lats = [
    { value: 66.5,  label: "66°N" },
    { value: 23.5,  label: "23°N" },
    { value: 0,     label: "0°"   },
    { value: -23.5, label: "23°S" },
  ];

  return (
    <g>
      <g
        stroke="color-mix(in oklch, var(--foreground) 7%, transparent)"
        strokeWidth="0.8"
        strokeDasharray="4 6"
      >
        {lats.map((l) => {
          const y = project(0, l.value)[1];
          return <line key={l.label} x1="0" y1={y} x2={VIEW_W} y2={y} />;
        })}
      </g>
      <g
        fontSize="11"
        fontFamily="var(--font-mono)"
        fill="color-mix(in oklch, var(--foreground) 35%, transparent)"
        dominantBaseline="middle"
      >
        {lats.map((l) => {
          const y = project(0, l.value)[1];
          return (
            <text key={l.label} x={6} y={y}>
              {l.label}
            </text>
          );
        })}
      </g>
    </g>
  );
}

/**
 * Quadratic-bezier arc giving a great-circle feel.
 * Control point is lifted above the midpoint proportional to horizontal span.
 * Tuned for the 1000×500 viewBox.
 */
function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - Math.abs(x2 - x1) * 0.18 - 30;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}
