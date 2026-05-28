import Link from "next/link";
import { ArrowUpRightIcon, BoxIcon, FlaskConicalIcon, SettingsIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
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

type ProductCardCopy = {
  label: string;
  title: string;
  desc: string;
  specs: Spec[];
};

export async function ProductsBento() {
  const t = await getTranslations("home.productsBento");
  const cards = t.raw("cards") as ProductCardCopy[];

  return (
    <section className="relative bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
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
            render={<Link href="/products" />}
            variant="outline"
            size="lg"
            className="h-10 shrink-0 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
          >
            {t("viewCatalogue")}
            <ArrowUpRightIcon className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2">
          <BentoCard
            href="/products"
            label={cards[0]?.label ?? "01 / MADA1"}
            title={cards[0]?.title ?? "MADA1"}
            desc={cards[0]?.desc ?? ""}
            specs={cards[0]?.specs ?? []}
            Icon={BoxIcon}
            tone="signal"
            className="lg:col-span-2 lg:row-span-2"
            featured
            specSheetLabel={t("specSheet")}
          />
          <BentoCard
            href="/products"
            label={cards[1]?.label ?? "03 / Custom"}
            title={cards[1]?.title ?? "Custom"}
            desc={cards[1]?.desc ?? ""}
            specs={cards[1]?.specs ?? []}
            Icon={SettingsIcon}
            tone="gold"
            specSheetLabel={t("specSheet")}
          />
          <BentoCard
            href="/products"
            label={cards[2]?.label ?? "02 / MADA2"}
            title={cards[2]?.title ?? "MADA2"}
            desc={cards[2]?.desc ?? ""}
            specs={cards[2]?.specs ?? []}
            Icon={FlaskConicalIcon}
            tone="signal"
            specSheetLabel={t("specSheet")}
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
  specSheetLabel,
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
  specSheetLabel: string;
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
          {specSheetLabel}
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
