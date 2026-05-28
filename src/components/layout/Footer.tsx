import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

const NAV_LINKS = [
  { href: "/about", key: "about" },
  { href: "/products", key: "products" },
  { href: "/sustainability", key: "sustainability" },
  { href: "/geopolitics", key: "geopolitics" },
  { href: "/news", key: "news" },
  { href: "/chat", key: "chat" },
  { href: "/market", key: "market" },
];

const PAYMENTS = [
  { id: "USDT TRC20", className: "border-emerald-500/30 text-emerald-400" },
  { id: "USDT ERC20", className: "border-sky-500/30 text-sky-400" },
  { id: "USDI", className: "border-fuchsia-500/30 text-fuchsia-400" },
  { id: "MUP", className: "border-signal/40 text-signal" },
  { id: "Bank Transfer", className: "border-amber-500/30 text-amber-400" },
];

/**
 * Industrial-Futurism footer.
 * - Multi-column grid with mono section labels
 * - Crypto payment chips styled as glowing pills
 * - Legal / compliance text in small mono
 *
 * Server Component.
 */
export async function Footer() {
  const tFooter = await getTranslations("footer");
  const tNav = await getTranslations("nav");

  return (
    <footer className="relative border-t border-border bg-background text-muted-foreground">
      {/* Decorative dot grid */}
      <div className="pointer-events-none absolute inset-0 bg-grid-dot opacity-30" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12">
        {/* Brand — wide column */}
        <div className="lg:col-span-4 space-y-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="size-6 rounded-sm bg-signal signal-glow" />
            <span className="font-semibold tracking-[0.18em] text-foreground">
              MADA GRAPHITE
            </span>
          </Link>
          <p className="text-sm leading-relaxed">
            {tFooter("brandBody")}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
            {tFooter("since")}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {PAYMENTS.map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all hover:bg-card ${p.className}`}
              >
                <span className="size-1 rounded-full bg-current animate-signal-pulse" />
                {p.id}
              </span>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="lg:col-span-3 space-y-3">
          <h4 className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
            {tFooter("contactHeading")}
          </h4>
          <div className="space-y-1.5 text-sm">
            <p className="text-foreground/85">{tFooter("madagascarOffice")}</p>
            <p className="text-xs leading-relaxed">
              {tFooter("addressLine1")}
              <br />
              {tFooter("addressLine2")}
            </p>
          </div>
          <div className="space-y-1.5 text-xs">
            <FooterRow label={tFooter("contactRows.headOffice")}>
              <a href="tel:+85366516516" className="hover:text-signal">
                +853 66-516-516
              </a>
            </FooterRow>
            <FooterRow label={tFooter("contactRows.chinaHotline")}>
              <a href="tel:+860532686800029" className="hover:text-signal">
                +86 0532-68680029
              </a>
            </FooterRow>
            <FooterRow label={tFooter("contactRows.sales")}>
              <a href="mailto:sales@madagraphite.com" className="hover:text-signal">
                sales@madagraphite.com
              </a>
            </FooterRow>
            <FooterRow label={tFooter("contactRows.direct")}>
              <a href="mailto:richard@madagraphite.com" className="hover:text-signal">
                richard@madagraphite.com
              </a>
            </FooterRow>
          </div>
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
            {tFooter("sitemapHeading")}
          </h4>
          <ul className="space-y-1.5 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group inline-flex items-center gap-1 text-foreground/75 transition-colors hover:text-signal"
                >
                  {l.key === "market"
                    ? tNav("items.market")
                    : tNav(`publicLinks.${l.key}`)}
                  <ArrowUpRightIcon className="size-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Compliance */}
        <div className="lg:col-span-3 space-y-3">
          <h4 className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
            {tFooter("tradingHeading")}
          </h4>
          <p className="text-sm leading-relaxed">
            {tFooter("tradingBody")}
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/70">
            {tFooter("tradingNote")}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-border bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          <span>
            {tFooter("rights", { year: new Date().getFullYear() })}
          </span>
          <span className="text-muted-foreground/60">
            {tFooter("agent")}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="w-20 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground/70">
        {label}
      </span>
      <span className="text-foreground/85 transition-colors">{children}</span>
    </p>
  );
}
