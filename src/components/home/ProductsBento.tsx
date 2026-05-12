import Link from "next/link";
import { ArrowUpRightIcon, BoxIcon, FlaskConicalIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Bento-grid product showcase.
 *
 * Layout (lg+):
 *   ┌──────────────────────────┬─────────────────────┐
 *   │  MADA1 (large, hero)     │  Custom Grades       │
 *   │                          ├─────────────────────┤
 *   │                          │  MADA2               │
 *   └──────────────────────────┴─────────────────────┘
 *
 * Each card uses a hover reveal that swaps the description for a mono spec
 * sheet — gives the "trader/CO A" feel requested in the brief.
 *
 * Server Component — purely CSS-driven hover, no JS needed.
 */

type Spec = { k: string; v: string };

const SPECS_MADA1: Spec[] = [
  { k: "fixed_carbon", v: "94 – 99%" },
  { k: "mesh_size", v: "+35 / +50 / +80 / +100 / +150" },
  { k: "moisture", v: "≤ 0.5%" },
  { k: "ash", v: "≤ 5.0%" },
  { k: "applications", v: "Li-ion · expandable · high-purity · aerospace" },
];

const SPECS_MADA2: Spec[] = [
  { k: "fixed_carbon", v: "75 – 95%" },
  { k: "mesh_size", v: "+50 / +80 / +100 / -100" },
  { k: "moisture", v: "≤ 0.5%" },
  { k: "ash", v: "≤ 12%" },
  { k: "applications", v: "Refractory · metallurgy · crucibles" },
];

const SPECS_CUSTOM: Spec[] = [
  { k: "fixed_carbon", v: "80 – 99% on request" },
  { k: "mesh_size", v: "+32 to −100 mesh" },
  { k: "moisture", v: "Per buyer COA" },
  { k: "min_lot", v: "20 MT (one container)" },
  { k: "lead_time", v: "≈ 4–6 weeks from PO" },
];

export function ProductsBento() {
  return (
    <section className="relative bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-eyebrow">Catalogue</p>
            <h2 className="text-display-sm text-balance text-foreground">
              Two brands, six standard grades,{" "}
              <span className="text-signal">unlimited custom specs.</span>
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              From battery-grade flake to refractory feedstock, every lot ships
              with origin-traceable documentation. Hover any card for the full
              technical sheet.
            </p>
          </div>
          <Button
            render={<Link href="/products" />}
            variant="outline"
            size="lg"
            className="h-10 shrink-0 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
          >
            View full catalogue
            <ArrowUpRightIcon className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
          <BentoCard
            href="/products"
            label="01 / MADA1"
            title="Battery & aerospace flake"
            desc="Perfect crystalline structure, high density, ultra-low purification-unfavorable ash. The reference feedstock for spheroidization, expandable graphite, high-purity routes and aerospace-grade carbon."
            specs={SPECS_MADA1}
            Icon={BoxIcon}
            tone="signal"
            className="lg:col-span-2 lg:row-span-2"
            featured
          />
          <BentoCard
            href="/products"
            label="03 / Custom"
            title="Tailored grades"
            desc="80–99% fixed carbon, +32 to −100 mesh. We sample, qualify and contract to your COA — minimum one container."
            specs={SPECS_CUSTOM}
            Icon={SettingsIcon}
            tone="gold"
          />
          <BentoCard
            href="/products"
            label="02 / MADA2"
            title="Refractory & metallurgy flake"
            desc="Industrial flake for refractories, metallurgy, crucibles and as feedstock for further high-purity processing. Optimised for thermal stability and packing density."
            specs={SPECS_MADA2}
            Icon={FlaskConicalIcon}
            tone="signal"
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  href,
  label,
  title,
  desc,
  specs,
  Icon,
  tone,
  className,
  featured,
}: {
  href: string;
  label: string;
  title: string;
  desc: string;
  specs: Spec[];
  Icon: React.ComponentType<{ className?: string }>;
  tone: "signal" | "gold";
  className?: string;
  featured?: boolean;
}) {
  const accent =
    tone === "signal"
      ? {
          ring: "group-hover:border-signal/50",
          glow: "group-hover:shadow-[0_0_60px_-12px_color-mix(in_oklch,var(--signal)_50%,transparent)]",
          chip: "text-signal border-signal/40",
        }
      : {
          ring: "group-hover:border-[color:var(--gold)]/50",
          glow: "group-hover:shadow-[0_0_60px_-12px_color-mix(in_oklch,var(--gold)_50%,transparent)]",
          chip: "text-[color:var(--gold)] border-[color:var(--gold)]/40",
        };

  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all sm:p-8",
        accent.ring,
        accent.glow,
        className
      )}
    >
      {/* Subtle background pattern */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-grid-dot opacity-40 transition-opacity group-hover:opacity-70"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-xl border bg-background transition-colors",
            accent.chip
          )}
        >
          <Icon className="size-4" />
        </div>
        <p className="text-eyebrow">{label}</p>
      </div>

      {/* Title + body */}
      <div className="space-y-2.5">
        <h3
          className={cn(
            "font-semibold tracking-tight text-foreground",
            featured ? "text-3xl sm:text-4xl" : "text-xl"
          )}
        >
          {title}
        </h3>
        <p className={cn("text-muted-foreground", featured ? "text-base leading-relaxed" : "text-sm leading-relaxed")}>
          {desc}
        </p>
      </div>

      {/* Hover-revealed spec sheet (always rendered, animated in via opacity
          / translate so card height stays predictable and SSR-stable) */}
      <div
        className={cn(
          "mt-auto flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-4 backdrop-blur",
          "translate-y-1 opacity-0 transition-all duration-500",
          "group-hover:translate-y-0 group-hover:opacity-100",
          "lg:opacity-70 lg:group-hover:opacity-100"
        )}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Spec sheet
        </p>
        <ul className="space-y-1.5 font-mono text-[11px] sm:text-xs">
          {specs.map((s) => (
            <li key={s.k} className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{s.k}</span>
              <span className="text-right text-foreground/85">{s.v}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Corner arrow */}
      <ArrowUpRightIcon
        className={cn(
          "absolute right-4 top-4 size-4 text-muted-foreground transition-transform",
          "group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
          tone === "signal" ? "group-hover:text-signal" : "group-hover:text-[color:var(--gold)]"
        )}
      />
    </Link>
  );
}
