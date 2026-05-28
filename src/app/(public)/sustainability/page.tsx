import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  MountainSnowIcon,
  CalendarIcon,
  UsersIcon,
  AlertCircleIcon,
  TrendingUpIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sustainability");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const SECTION_ICONS = [
  MountainSnowIcon,
  CalendarIcon,
  UsersIcon,
  AlertCircleIcon,
  TrendingUpIcon,
];

type SustainabilitySection = {
  title: string;
  paragraphs?: string[];
  callout?: {
    title: string;
    items: string[];
    note: string;
  };
  items?: Array<{ label: string; body: string }>;
  roadmap?: Array<{ year: string; milestone: string }>;
};

export default async function SustainabilityPage() {
  const t = await getTranslations("sustainability");
  const sections = t.raw("sections") as SustainabilitySection[];

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 space-y-5">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">
            {t("hero.eyebrow")}
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
            {t("hero.title")}
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
            {t("hero.body")}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }))}>
              {t("hero.openAccount")}
            </Link>
            <Link
              href="/chat"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              {t("hero.askAi")}
            </Link>
          </div>
        </div>
      </section>

      {sections.map((section, sectionIndex) => {
        const Icon = SECTION_ICONS[sectionIndex] ?? MountainSnowIcon;
        const isDisclosure = sectionIndex === 3;
        return (
          <div key={section.title}>
            {sectionIndex > 0 && <div className="border-t border-border" />}
            <section className="mx-auto max-w-3xl px-6 py-16 space-y-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "rounded-xl p-3 shrink-0",
                    isDisclosure
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : "bg-emerald-50 dark:bg-emerald-900/20"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-6",
                      isDisclosure
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    )}
                  />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-semibold">{section.title}</h2>
                  {section.paragraphs?.map((_, paragraphIndex) => (
                    <p
                      key={paragraphIndex}
                      className="text-muted-foreground text-sm leading-relaxed"
                    >
                      {t.rich(
                        `sections.${sectionIndex}.paragraphs.${paragraphIndex}`,
                        {
                          strong: (chunks) => (
                            <strong className="text-foreground">{chunks}</strong>
                          ),
                        }
                      )}
                    </p>
                  ))}

                  {section.callout && (
                    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                        {section.callout.title}
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        {section.callout.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {section.callout.note}
                      </p>
                    </div>
                  )}

                  {section.items && (
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      {section.items.map((item) => (
                        <li key={item.label}>
                          <strong className="text-foreground">{item.label}</strong>{" "}
                          — {item.body}
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.roadmap && (
                    <div className="space-y-3">
                      {section.roadmap.map((item) => (
                        <div key={item.year} className="flex items-start gap-4">
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
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      })}

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-6 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {t("bottomCta.title")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("bottomCta.body")}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
              {t("bottomCta.openAccount")}
            </Link>
            <Link
              href="/chat"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("bottomCta.askAi")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
