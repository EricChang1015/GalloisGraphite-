import Link from "next/link";
import { ArrowUpRightIcon, SparklesIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { BgGrid } from "@/components/home/BgGrid";

/**
 * End-of-page CTA — the "Not sure what grade you need?" block, redesigned
 * as a glassy panel sitting on top of a cyan halo. Asymmetric: copy on
 * the left, dual CTAs floating right.
 */

export async function ClosingCta() {
  const t = await getTranslations("home.closingCta");

  return (
    <section className="relative overflow-hidden bg-background">
      <BgGrid pattern="dot" className="opacity-50" />

      {/* Halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <p className="text-eyebrow text-center">
            <SparklesIcon className="mr-1.5 inline size-3 text-signal animate-signal-pulse" />
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 text-center text-display text-balance">
            <span className="text-foreground">{t("titleLine1")}</span>
            <br />
            <span className="bg-gradient-to-br from-signal to-[color:var(--gold)] bg-clip-text text-transparent">
              {t("titleLine2")}
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-center text-base leading-relaxed text-muted-foreground">
            {t("body")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button
              render={<Link href="/chat" />}
              size="lg"
              className="group h-12 gap-2 px-6 text-sm font-semibold bg-signal text-signal-foreground hover:bg-signal/90"
            >
              <SparklesIcon className="size-4" />
              {t("askAi")}
              <ArrowUpRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
            <Button
              render={<Link href="/register" />}
              size="lg"
              variant="outline"
              className="h-12 gap-2 px-6 text-sm font-medium"
            >
              {t("startTrading")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
