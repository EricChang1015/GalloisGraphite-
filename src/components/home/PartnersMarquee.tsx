import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Partner logo marquee. Two duplicated rails sliding in opposite directions
 * give a continuous, calmer feel than a single track. Logos are monochrome
 * (grayscale + low opacity) and snap to full color + brand on hover.
 *
 * Server Component. Marquee is pure CSS keyframes (animate-marquee /
 * animate-marquee-slow + pause-on-hover), so no JS or framer-motion is
 * needed for this surface.
 */

const PARTNERS = [
  { name: "Vesuvius", href: "https://www.vesuvius.com/en/index.html", logo: "/images/partners/vesuvius.svg" },
  { name: "AMG Graphite GK", href: "https://www.maaxlubritech.com/amg-graphite-gk/", logo: "/images/partners/amg-graphite-gk.png" },
  { name: "Asbury", href: "https://www.asbury.com/", logo: "/images/partners/asbury.svg" },
  { name: "Minchem Impex", href: "https://minchem.in/", logo: "/images/partners/minchem-impex.png" },
  { name: "SGL Carbon", href: "https://www.sglcarbon.com/", logo: "/images/partners/sgl-carbon.svg" },
  { name: "Krosaki Harima", href: "https://www.krosaki.co.jp/en", logo: "/images/partners/krosaki-harima.png" },
  { name: "RHI Magnesita", href: "https://www.rhimagnesita.com/", logo: "/images/partners/rhi-magnesita.svg" },
  { name: "GMI", href: "https://www.graphitemachininginc.com/", logo: "/images/partners/gmi.png" },
  { name: "Superior Graphite", href: "https://superiorgraphite.com/", logo: "/images/partners/superior-graphite.svg" },
  { name: "Morgan Advanced Materials", href: "https://www.morganadvancedmaterials.com/", logo: "/images/partners/morgan-advanced-materials.svg" },
  { name: "CGM", href: "https://www.cgmgraphite.com/", logo: "/images/partners/cgm.jpg" },
  { name: "Zircar Refractories", href: "https://zircarrefractories.in/", logo: "/images/partners/zircar-refractories.png" },
  { name: "Aug. Gundlach", href: "https://www.aug-gundlach.de/", logo: "/images/partners/aug-gundlach.jpg" },
  { name: "AGC PPL", href: "#", logo: "/images/partners/agc-ppl.png" },
  { name: "UNIMEX", href: "https://unimextr.com/", logo: "/images/partners/unimex.png" },
] as const;

export async function PartnersMarquee() {
  const t = await getTranslations("home.partners");

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
          <p className="max-w-md text-xs text-muted-foreground">
            {t("body")}
          </p>
        </div>
      </div>

      {/* Track 1 → */}
      <div className="mask-fade-x relative overflow-hidden">
        <div className="flex w-max animate-marquee pause-on-hover gap-3 px-3 pb-3">
          {[...PARTNERS, ...PARTNERS].map((p, i) => (
            <PartnerCard key={`a-${i}`} partner={p} visitLabel={t("visit", { name: p.name })} />
          ))}
        </div>
      </div>

      {/* Track 2 ← (reversed direction via negative animation) */}
      <div className="mask-fade-x relative overflow-hidden">
        <div className="flex w-max animate-marquee-slow pause-on-hover gap-3 px-3 pb-12 [animation-direction:reverse]">
          {[...PARTNERS.slice().reverse(), ...PARTNERS.slice().reverse()].map((p, i) => (
            <PartnerCard key={`b-${i}`} partner={p} visitLabel={t("visit", { name: p.name })} />
          ))}
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

  if (partner.href === "#") return inner;

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
