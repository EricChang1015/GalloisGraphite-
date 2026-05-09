import type { Metadata } from "next";
import Link from "next/link";
import {
  MountainSnowIcon,
  CalendarIcon,
  UsersIcon,
  AlertCircleIcon,
  TrendingUpIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sustainability Brief — Mada Graphite",
  description:
    "How open-cast, high-grade, year-round mining in Madagascar compares to the global graphite supply on energy, waste, and community impact.",
};

const ROADMAP = [
  {
    year: "2026",
    milestone: "ESG datasheet attached to every shipment",
    status: "planned",
  },
  {
    year: "2027",
    milestone: "ISO 14001-aligned environmental audit",
    status: "planned",
  },
  {
    year: "2028",
    milestone: "Third-party verified carbon intensity label per lot",
    status: "planned",
  },
];

export default function SustainabilityPage() {
  return (
    <div className="bg-background text-foreground">
      {/* ── Hero ── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 space-y-5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
            Sustainability Brief · 2026
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
            A graphite supply that doesn&apos;t cost the climate twice.
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
            Most of the world&apos;s flake graphite is mined underground, in
            mountainous metamorphic basins, and processed with energy-intensive
            flotation. Gallois is different — and the difference matters for any
            anode-grade buyer trying to hit Scope 3 targets.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Open a trading account
            </Link>
            <Link
              href="/chat"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Ask the AI assistant
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 1: How Gallois mines differently ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 shrink-0">
            <MountainSnowIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">
              1 — How Gallois mines differently
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Gallois deposit is entirely weathering-formed. The graphite
              flakes have migrated upward over geological time — meaning the
              ore body sits at or near the surface, accessible by open-cast
              excavation without blasting or deep shaft sinking.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Average carbon content of the raw ore runs around{" "}
              <strong className="text-foreground">~10%</strong>, compared
              to the industry-typical 4–6% in metamorphic hard-rock deposits.
              That higher grade translates directly into less material moved per
              tonne of fixed carbon, fewer flotation stages, and lower chemical
              and energy inputs per tonne of product.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Current operations do not use a conventional wet tailings dam.
              Flotation tailings are managed on-site with standard earthwork
              containment; independent geotechnical characterisation is pending.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 2: Climate & Operations ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 shrink-0">
            <CalendarIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">
              2 — Climate &amp; year-round operations
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Tamatave province maintains an average temperature of 15–35 °C
              year-round with abundant water resources. Unlike mines in northern
              China (Heilongjiang), Inner Mongolia, or Canada, Gallois faces no
              winter shutdown, no freeze-thaw cycle, and no seasonal production
              halt.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              365-day continuous production has two sustainability advantages
              that are often overlooked: it eliminates the stockpiling carbon
              embedded in accumulating inventory between production seasons, and
              it allows a leaner, lower-waste supply chain — buyers can order
              closer to need.
            </p>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 3: Land & Community ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 shrink-0">
            <UsersIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">
              3 — Land footprint &amp; community
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Gallois concession covers 280 km². Active mining currently
              occupies Sites No. 1 and No. 2; Site No. 3 (Ambalafotaka) remains
              unexploited. Less than 1% of the total concession area has been
              explored, meaning the operating footprint is a small fraction of
              the licensed land.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Community metrics under collection
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Local employment ratio at both active sites</li>
                <li>Safety performance and training hours</li>
                <li>Community infrastructure support</li>
                <li>Education support for workers&apos; families</li>
              </ul>
              <p className="text-xs text-muted-foreground/70 mt-2">
                These metrics are being collected for the 2026 ESG datasheet and
                will be marked as verified, estimated, or pending review.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 4: Honest disclosure ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 shrink-0">
            <AlertCircleIcon className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">
              4 — What we don&apos;t yet track (honest disclosure)
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We believe supply-chain credibility is built on what you admit
              you don&apos;t know, not just what you claim. The following metrics
              are not yet third-party verified:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>
                <strong className="text-foreground">Diesel intensity per tonne</strong>{" "}
                — haul trucks and processing plant generators are diesel-powered;
                exact kWh/tonne FC is under measurement, target to publish 2027.
              </li>
              <li>
                <strong className="text-foreground">Carbon intensity per tonne</strong>{" "}
                — full Scope 1+2 measurement is in progress; no verified figure
                published yet.
              </li>
              <li>
                <strong className="text-foreground">Tailings characterisation</strong>{" "}
                — we describe tailings as &quot;inert sandy waste&quot; based on
                ore mineralogy; independent geotechnical characterisation is
                pending.
              </li>
              <li>
                <strong className="text-foreground">Water discharge quality</strong>{" "}
                — flotation process water is recirculated; discharge monitoring
                programme to be published in 2026 ESG datasheet.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Section 5: Roadmap ── */}
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 shrink-0">
            <TrendingUpIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold">5 — Sustainability roadmap</h2>
            <div className="space-y-3">
              {ROADMAP.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-12 shrink-0 text-center">
                    <span className="inline-block rounded-md bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {item.year}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug pt-0.5">
                    {item.milestone}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Buying for Scope 3 compliance?
            </p>
            <p className="text-sm text-muted-foreground">
              Contact our team to discuss origin documentation, lot traceability,
              and the 2026 ESG datasheet schedule.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Open an account
            </Link>
            <Link
              href="/chat"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Ask the AI assistant
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
