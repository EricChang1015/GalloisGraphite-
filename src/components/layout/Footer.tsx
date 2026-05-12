import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

const NAV_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/products", label: "Products" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/geopolitics", label: "Geopolitics" },
  { href: "/news", label: "News" },
  { href: "/chat", label: "AI Assistant" },
  { href: "/market", label: "Market" },
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
export function Footer() {
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
            B2B trading platform for Madagascar natural flake graphite.
            Operated by Graphite Energy Inc. — exclusive sales agent of
            Etablissements Gallois S.A.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80">
            In continuous production since 1901
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
            {"// Contact"}
          </h4>
          <div className="space-y-1.5 text-sm">
            <p className="text-foreground/85">Madagascar office</p>
            <p className="text-xs leading-relaxed">
              Boulevard de l&apos;Ivondro, Cité Canada,
              <br />
              Toamasina 501, Madagascar
            </p>
          </div>
          <div className="space-y-1.5 text-xs">
            <FooterRow label="Head office">
              <a href="tel:+85366516516" className="hover:text-signal">
                +853 66-516-516
              </a>
            </FooterRow>
            <FooterRow label="China hotline">
              <a href="tel:+860532686800029" className="hover:text-signal">
                +86 0532-68680029
              </a>
            </FooterRow>
            <FooterRow label="Sales">
              <a href="mailto:sales@madagraphite.com" className="hover:text-signal">
                sales@madagraphite.com
              </a>
            </FooterRow>
            <FooterRow label="Direct">
              <a href="mailto:richard@madagraphite.com" className="hover:text-signal">
                richard@madagraphite.com
              </a>
            </FooterRow>
          </div>
        </div>

        {/* Quick links */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
            {"// Sitemap"}
          </h4>
          <ul className="space-y-1.5 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="group inline-flex items-center gap-1 text-foreground/75 transition-colors hover:text-signal"
                >
                  {l.label}
                  <ArrowUpRightIcon className="size-3 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Compliance */}
        <div className="lg:col-span-3 space-y-3">
          <h4 className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
            {"// Trading"}
          </h4>
          <p className="text-sm leading-relaxed">
            All payments are manually verified and remain subject to invoice
            review, KYC/AML checks, sanctions screening, and final admin
            approval.
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/70">
            Origin-traceable lots · Chain-of-custody documentation ·
            Transaction-level compliance screening.
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-border bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
          <span>
            © {new Date().getFullYear()} Graphite Energy Inc. — All rights reserved
          </span>
          <span className="text-muted-foreground/60">
            Exclusive sales agent of Etablissements Gallois S.A.
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
