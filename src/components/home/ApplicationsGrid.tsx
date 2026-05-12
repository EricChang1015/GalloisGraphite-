import {
  BatteryChargingIcon,
  FlameIcon,
  GemIcon,
  FlaskConicalIcon,
  HammerIcon,
  CircleDashedIcon,
  PlaneIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Applications grid — replaces the original chip cloud with an icon-led
 * 4×2 grid. Each cell has a subtle hover micro-animation (signal-cyan glow
 * on hover) and reveals a one-line technical caption.
 *
 * Server Component — pure CSS hover.
 */

type App = {
  title: string;
  caption: string;
  Icon: LucideIcon;
};

const APPS: App[] = [
  { title: "Li-ion battery anodes", caption: "Spheroidization-grade flake feedstock", Icon: BatteryChargingIcon },
  { title: "Expandable graphite", caption: "Intumescent / fire-proofing seals", Icon: FlameIcon },
  { title: "High-purity graphite", caption: "Feedstock for >99.9% C purification", Icon: SparklesIcon },
  { title: "Refractories", caption: "Steel & ceramic refractory matrices", Icon: HammerIcon },
  { title: "Metallurgy & crucibles", caption: "Bonded carbon for casting cycles", Icon: FlaskConicalIcon },
  { title: "Sealing materials", caption: "Mechanical seals · gaskets · packing", Icon: CircleDashedIcon },
  { title: "Military & aerospace", caption: "Reentry shields · solid-rocket nozzles", Icon: PlaneIcon },
  { title: "Man-made diamond", caption: "Carbon source for HPHT / CVD synthesis", Icon: GemIcon },
];

export function ApplicationsGrid() {
  return (
    <section className="relative bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mb-12 max-w-2xl space-y-3">
          <p className="text-eyebrow">Applications</p>
          <h2 className="text-display-sm text-balance text-foreground">
            Gallois graphite serves every major segment of the{" "}
            <span className="text-signal">global carbon industry.</span>
          </h2>
        </div>

        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {APPS.map((a) => {
            const Icon = a.Icon;
            return (
              <li
                key={a.title}
                className={cn(
                  "group relative flex flex-col gap-3 bg-card p-6 transition-colors duration-300",
                  "hover:bg-background"
                )}
              >
                <span
                  className={cn(
                    "relative inline-flex size-10 items-center justify-center rounded-xl border border-border bg-background transition-all duration-300",
                    "group-hover:border-signal/50 group-hover:text-signal",
                    "group-hover:shadow-[0_0_24px_-6px_color-mix(in_oklch,var(--signal)_60%,transparent)]"
                  )}
                >
                  <Icon className="size-4 transition-transform duration-300 group-hover:scale-110" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">{a.title}</h3>
                <p className="font-mono text-[11px] leading-snug text-muted-foreground">
                  {a.caption}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
