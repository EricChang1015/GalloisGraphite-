import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getPublishedPartners } from "@/lib/partners/queries";

/**
 * Partner logo marquee — logos from CMS (`partners` table + storage bucket).
 */
export async function PartnersMarquee() {
  const t = await getTranslations("home.partners");
  const rows = await getPublishedPartners();
  const partners = rows
    .filter((p) => p.icon_url)
    .map((p) => ({
      name: p.name,
      href: p.href,
      logo: p.icon_url as string,
    }));

  if (!partners.length) return null;

  return (
    <section className="relative border-y border-border bg-surface-1">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-8 sm:px-6 sm:pt-20">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-eyebrow">{t("eyebrow")}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">{t("body")}</p>
        </div>
      </div>

      <div className="mask-fade-x relative overflow-hidden">
        <div className="flex w-max animate-marquee pause-on-hover gap-3 px-3 pb-3">
          {[...partners, ...partners].map((p, i) => (
            <PartnerCard
              key={`a-${p.name}-${i}`}
              partner={p}
              visitLabel={t("visit", { name: p.name })}
            />
          ))}
        </div>
      </div>

      <div className="mask-fade-x relative overflow-hidden">
        <div className="flex w-max animate-marquee-slow pause-on-hover gap-3 px-3 pb-12 [animation-direction:reverse]">
          {[...partners.slice().reverse(), ...partners.slice().reverse()].map(
            (p, i) => (
              <PartnerCard
                key={`b-${p.name}-${i}`}
                partner={p}
                visitLabel={t("visit", { name: p.name })}
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}

function PartnerCard({
  partner,
  visitLabel,
}: {
  partner: { name: string; href: string; logo: string };
  visitLabel: string;
}) {
  const inner = (
    <div className="group flex h-16 w-44 shrink-0 items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-signal/40 hover:bg-background">
      <div className="relative h-8 w-24">
        <Image
          src={partner.logo}
          alt={`${partner.name} logo`}
          fill
          className="object-contain opacity-60 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
          unoptimized
          sizes="96px"
        />
      </div>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground group-hover:text-signal sm:inline">
        {partner.name}
      </span>
    </div>
  );

  if (!partner.href) return inner;

  return (
    <Link
      href={partner.href}
      target="_blank"
      rel="noreferrer"
      aria-label={visitLabel}
      className="shrink-0"
    >
      {inner}
    </Link>
  );
}
