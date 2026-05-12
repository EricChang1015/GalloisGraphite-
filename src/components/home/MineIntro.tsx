import Link from "next/link";
import Image from "next/image";
import { ArrowUpRightIcon } from "lucide-react";
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

const FACTS = [
  { k: "Sites", v: "No. 1 (Antsirakambo) · No. 2 (Marovintsy) · No. 3 reserved" },
  { k: "Total area", v: "280 km² · <1% explored" },
  { k: "Average ore C", v: "~10% (operational estimate)" },
  { k: "Distance to port", v: "45 km from Tamatave" },
];

export function MineIntro({ className }: { className?: string }) {
  return (
    <section className={cn("relative bg-background", className)}>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-12 lg:gap-16">
        {/* Copy column */}
        <div className="lg:col-span-7">
          <p className="text-eyebrow">The mine · est. 1901</p>
          <h2 className="mt-4 text-display-sm text-balance text-foreground">
            A major long-operating Madagascar graphite operation, now under{" "}
            <span className="text-signal">computer-managed</span> control.
          </h2>
          <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Located in the Tamatave province of northeast Madagascar, the
              Gallois mine covers 280 km² of high-grade flake graphite deposit
              — with an average ore carbon content of ~10%, rare globally.
            </p>
            <p>
              Since taking over in 2016, Graphite Energy Inc. has driven annual
              production from under 5,000 tonnes toward a reported 140,000 t/a
              capacity across two active sites. A third site (Ambalafotaka)
              remains unexploited, and only 1% of the total area has been
              explored, with 240 million tonnes of estimated reserves reported
              by prior geological review.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              render={<Link href="/about" />}
              variant="outline"
              size="lg"
              className="h-10 gap-1.5 border-signal/40 hover:border-signal hover:bg-signal/5"
            >
              Learn about the mine
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
                alt="Madagascar graphite mine location"
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
                Tamatave · MG
              </div>
            </div>

            <ul className="grid grid-cols-2 gap-px bg-border">
              {FACTS.map((f) => (
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
