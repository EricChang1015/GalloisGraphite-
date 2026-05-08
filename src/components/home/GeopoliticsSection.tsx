import Link from "next/link";
import { ShieldCheckIcon, MapPinIcon, AnchorIcon, ClockIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    title: "Same metallurgy, fewer policy risks",
    body: "Gallois flake matches Heilongjiang and Inner Mongolia reference grades. Switching to Mada supply requires no reformulation — only a new origin declaration.",
  },
  {
    Icon: ClockIcon,
    title: "Operating since 1901",
    body: "Long enough to be infrastructure, not a startup risk. Continuous supply through two world wars, independence, and the energy transition.",
  },
];

export function GeopoliticsSection() {
  return (
    <section className="border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
        {/* Header */}
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">
              Strategic sourcing
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
              Graphite is on every critical-mineral list. <br className="hidden sm:block" />
              <span className="text-sky-600 dark:text-sky-400">
                Your supply map needs China+1 optionality.
              </span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl">
              China remains central to the graphite industry. Mada Graphite
              complements that base with a Madagascar-origin supply option for
              buyers who need redundancy, traceability, and procurement
              flexibility.
            </p>
          </div>
          <Link
            href="/geopolitics"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          >
            Read the strategic case →
          </Link>
        </div>

        {/* Critical mineral badges */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Graphite designated critical mineral by:
          </p>
          <div className="flex flex-wrap gap-2">
            {CRITICAL_LISTS.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50 dark:bg-sky-900/20 px-3 py-1 text-xs font-medium text-sky-700 dark:text-sky-300"
              >
                <span>{item.flag}</span>
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Advantage cards */}
        <div className="grid gap-5 sm:grid-cols-2">
          {ADVANTAGES.map((a) => {
            const Ic = a.Icon;
            return (
              <div
                key={a.title}
                className="rounded-xl border border-border bg-background p-5 space-y-2 hover:border-sky-500/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg p-2 bg-sky-50 dark:bg-sky-900/20 shrink-0">
                    <Ic className="size-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-foreground">
                      {a.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {a.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA strip */}
        <div className="rounded-xl border border-sky-500/30 bg-sky-50/50 dark:bg-sky-900/10 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground">
              Re-mapping your supply chain?
            </p>
            <p className="text-xs text-muted-foreground">
              We offer long-term supply agreements with locked volumes, USD pricing, and origin-traceable KYC documentation.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/geopolitics"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              The strategic case
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Request KYC pack
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
