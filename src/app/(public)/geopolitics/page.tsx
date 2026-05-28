import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangleIcon,
  MapIcon,
  MapPinIcon,
  BuildingIcon,
  PackageCheckIcon,
  AlertCircleIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("geopolitics");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const CriticalListSectionIcon = AlertTriangleIcon;

type CriticalList = {
  region: string;
  instrument: string;
  note: string;
};

type Advantage = {
  title: string;
  detail: string;
};

type Risk = {
  risk: string;
  mitigation: string;
};

export default async function GeopoliticsPage() {
  const t = await getTranslations("geopolitics");
  const criticalLists = t.raw("criticalLists") as CriticalList[];
  const advantages = t.raw("madagascarAdvantages") as Advantage[];
  const offers = t.raw("whatWeOffer") as string[];
  const risks = t.raw("honestRisks") as Risk[];
  const whyGalloisBullets = t.raw("sections.whyGallois.bullets") as Array<{
    strong: string;
    body: string;
  }>;

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-6 py-20 space-y-5">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400">
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
              {t("hero.requestKyc")}
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

      <ContentSection
        Icon={CriticalListSectionIcon}
        tone="sky"
        title={t("sections.inflection.title")}
      >
        {[0, 1].map((index) => (
          <p
            key={index}
            className="text-muted-foreground text-sm leading-relaxed"
          >
            {t(`sections.inflection.paragraphs.${index}`)}
          </p>
        ))}
        <div className="rounded-lg border border-sky-500/30 bg-sky-50/50 dark:bg-sky-900/10 p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Note:</strong>{" "}
            {t("sections.inflection.note")}
          </p>
        </div>
      </ContentSection>

      <ContentSection
        Icon={MapIcon}
        tone="sky"
        title={t("sections.criticalMap.title")}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("sections.criticalMap.body")}
        </p>
        <div className="space-y-3">
          {criticalLists.map((item) => (
            <div
              key={item.region}
              className="rounded-lg border border-border bg-card p-4 space-y-1"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold text-sm text-foreground">
                  {item.region}
                </p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.instrument}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </div>
      </ContentSection>

      <ContentSection
        Icon={MapPinIcon}
        tone="sky"
        title={t("sections.whyMadagascar.title")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {advantages.map((advantage) => (
            <div
              key={advantage.title}
              className="rounded-lg border border-border bg-card p-4 space-y-1.5"
            >
              <p className="font-semibold text-sm text-foreground">
                {advantage.title}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {advantage.detail}
              </p>
            </div>
          ))}
        </div>
      </ContentSection>

      <ContentSection
        Icon={BuildingIcon}
        tone="sky"
        title={t("sections.whyGallois.title")}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("sections.whyGallois.body")}
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
          {whyGalloisBullets.map((item) => (
            <li key={item.strong}>
              <strong className="text-foreground">{item.strong}</strong>{" "}
              {item.body}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground/70 border-l-2 border-sky-500/30 pl-3">
          {t("sections.whyGallois.disclaimer")}
        </p>
      </ContentSection>

      <ContentSection
        Icon={PackageCheckIcon}
        tone="sky"
        title={t("sections.offer.title")}
      >
        <ul className="space-y-3">
          {offers.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 text-sm text-muted-foreground"
            >
              <span className="mt-1.5 size-1.5 rounded-full bg-sky-500 dark:bg-sky-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection
        Icon={AlertCircleIcon}
        tone="amber"
        title={t("sections.risks.title")}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("sections.risks.body")}
        </p>
        <div className="space-y-3">
          {risks.map((item) => (
            <div
              key={item.risk}
              className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-1.5"
            >
              <p className="font-semibold text-sm text-foreground">
                ⚠ {item.risk}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.mitigation}
              </p>
            </div>
          ))}
        </div>
      </ContentSection>

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
              href="/products"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("bottomCta.viewProducts")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContentSection({
  Icon,
  tone,
  title,
  children,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  tone: "sky" | "amber";
  title: string;
  children: React.ReactNode;
}) {
  const isAmber = tone === "amber";
  return (
    <>
      <div className="border-t border-border" />
      <section className="mx-auto max-w-3xl px-6 py-16 space-y-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "rounded-xl p-3 shrink-0",
              isAmber
                ? "bg-amber-50 dark:bg-amber-900/20"
                : "bg-sky-50 dark:bg-sky-900/20"
            )}
          >
            <Icon
              className={cn(
                "size-6",
                isAmber
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-sky-600 dark:text-sky-400"
              )}
            />
          </div>
          <div className="space-y-4 w-full">
            <h2 className="text-2xl font-semibold">{title}</h2>
            {children}
          </div>
        </div>
      </section>
    </>
  );
}
