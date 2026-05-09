import Link from "next/link";
import { SunIcon, CalendarIcon, MountainSnowIcon, FlaskConicalIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PILLARS = [
  {
    Icon: MountainSnowIcon,
    title: "Open-cast mining",
    body: "No underground blasting. The weathering-formed deposit indicates lower overburden and diesel intensity potential; third-party verification is pending.",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    Icon: CalendarIcon,
    title: "365-day production",
    body: "Tamatave province operates at 15–35 °C year-round with abundant water. No seasonal shutdowns — lower stockpile carbon and leaner working capital.",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    Icon: FlaskConicalIcon,
    title: "~10% ore carbon grade",
    body: "Operational estimates indicate ~10% raw ore carbon grade. Verified sampling and audit data will replace estimates as the ESG programme matures.",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    Icon: SunIcon,
    title: "ESG disclosure roadmap",
    body: "We commit to attaching an ESG datasheet to every shipment by 2026, and a third-party-verified carbon intensity label per lot by 2028.",
    accentClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
  },
] as const;

export function SustainabilitySection() {
  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        {/* Header */}
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
              Lower-impact extraction
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
              A graphite supply that doesn&apos;t cost the climate twice.
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl">
              Most flake graphite is mined underground in metamorphic basins with
              energy-intensive flotation. Gallois is structurally different —
              open-cast, high-grade, and operating in a climate that never
              requires a seasonal shutdown.
            </p>
          </div>
          <Link
            href="/sustainability"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            Read the ESG brief →
          </Link>
        </div>

        {/* Pillars grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => {
            const Ic = p.Icon;
            return (
              <div
                key={p.title}
                className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-emerald-500/40 transition-colors"
              >
                <div className={cn("inline-flex rounded-lg p-2.5", p.bgClass)}>
                  <Ic className={cn("size-5", p.accentClass)} />
                </div>
                <h3 className="font-semibold text-sm text-foreground">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Honest disclaimer */}
        <p className="text-xs text-muted-foreground/70 border-l-2 border-emerald-500/30 pl-3">
          All figures are based on operational estimates. Third-party verification
          is in progress; verified data will replace estimates as audits complete.{" "}
          <Link href="/sustainability" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Read the full disclosure →
          </Link>
        </p>
      </div>
    </section>
  );
}
