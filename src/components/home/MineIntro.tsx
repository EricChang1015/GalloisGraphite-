import Link from "next/link";
import Image from "next/image";
import { ArrowUpRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "A major long-operating Madagascar graphite operation" — replaces the
 * old centered prose block. Asymmetric two-column layout:
 *   - Left: oversized eyebrow + headline + dual-paragraph copy
 *   - Right: stacked spec card + map illustration tucked at the bottom
 *
 * Server Component.
 */

export async function MineIntro({ className }: { className?: string }) {
  const t = await getTranslations("home.mineIntro");
  const facts = t.raw("facts") as Array<{ k: string; v: string }>;
  const paragraphs = t.raw("paragraphs") as string[];

  return (
    <section className={cn("relative bg-background", className)}>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-12 lg:gap-16">
        {/* Copy column */}
        <div className="lg:col-span-7">
          <p className="text-eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-4 text-display-sm text-balance text-foreground">
            {t("titleBefore")}{" "}
            <span className="text-signal">{t("titleHighlight")}</span>{" "}
            {t("titleAfter")}
          </h2>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              render={<Link href="/about" />}
              variant="outline"
              size="lg"
              className="h-10 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
            >
              {t("learnMore")}
              <ArrowUpRightIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* Mini map illustration */}
            <div className="relative aspect-[5/3] w-full overflow-hidden bg-surface-2">
              <Image
                src="/images/legacy/map_a.png"
                alt={t("mapAlt")}
                fill
                className="object-contain p-6 mix-blend-luminosity opacity-70 dark:invert dark:opacity-90"
                unoptimized
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-grid-line opacity-15"
              />
              <div className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-card/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-signal backdrop-blur">
                <span className="size-1.5 rounded-full bg-signal animate-signal-pulse" />
                {t("mapBadge")}
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-px bg-border">
              {facts.map((f) => (
                <li key={f.k} className="bg-card p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {f.k}
                  </p>
                  <p className="mt-1.5 text-xs leading-snug text-foreground/85">
                    {f.v}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
