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
import { getTranslations } from "next-intl/server";
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

const APP_ICONS: LucideIcon[] = [
  BatteryChargingIcon,
  FlameIcon,
  SparklesIcon,
  HammerIcon,
  FlaskConicalIcon,
  CircleDashedIcon,
  PlaneIcon,
  GemIcon,
];

export async function ApplicationsGrid() {
  const t = await getTranslations("home.applications");
  const apps = (t.raw("items") as Array<Omit<App, "Icon">>).map((app, index) => ({
    ...app,
    Icon: APP_ICONS[index] ?? SparklesIcon,
  }));

  return (
    <section className="relative bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="mb-12 max-w-2xl space-y-3">
          <p className="text-eyebrow">{t("eyebrow")}</p>
          <h2 className="text-display-sm text-balance text-foreground">
            {t("titleBefore")}{" "}
            <span className="text-signal">{t("titleHighlight")}</span>
          </h2>
        </div>

        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {apps.map((a) => {
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
