import Link from "next/link";

const NAV_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/products", label: "Products" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/geopolitics", label: "Geopolitics" },
  { href: "/news", label: "News" },
  { href: "/chat", label: "AI Assistant" },
  { href: "/market", label: "Market" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-background text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {/* Brand */}
        <div className="space-y-3 lg:col-span-1">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-sm bg-[color:var(--gold)] flex-shrink-0" />
            <span className="font-semibold text-foreground tracking-wide">
              MADA GRAPHITE
            </span>
          </div>
          <p className="text-xs leading-relaxed">
            B2B trading platform for Madagascar natural flake graphite. Operated
            by Graphite Energy Inc. — exclusive sales agent of Etablissements
            Gallois S.A.
          </p>
          <p className="text-xs text-muted-foreground/80">
            In continuous production since 1901.
          </p>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <h4 className="text-foreground font-semibold tracking-wide">
            Contact
          </h4>
          <div className="space-y-1.5 text-xs">
            <p className="text-foreground/80">Madagascar office:</p>
            <p>
              Boulevard de l&apos;Ivondro, Cité Canada,
              <br />
              Toamasina 501, Madagascar
            </p>
          </div>
          <div className="space-y-1 text-xs">
            <p>
              <span className="text-muted-foreground/80">Head office: </span>
              <a
                href="tel:+85366516516"
                className="text-foreground hover:text-[color:var(--gold)] transition-colors"
              >
                +853 66-516-516
              </a>
            </p>
            <p>
              <span className="text-muted-foreground/80">China hotline: </span>
              <a
                href="tel:+860532686800029"
                className="text-foreground hover:text-[color:var(--gold)] transition-colors"
              >
                +86 0532-68680029
              </a>
            </p>
          </div>
          <div className="space-y-1 text-xs">
            <p>
              <a
                href="mailto:sales@madagraphite.com"
                className="text-foreground hover:text-[color:var(--gold)] transition-colors"
              >
                sales@madagraphite.com
              </a>
            </p>
            <p>
              <a
                href="mailto:richard@madagraphite.com"
                className="text-foreground hover:text-[color:var(--gold)] transition-colors"
              >
                richard@madagraphite.com
              </a>
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          <h4 className="text-foreground font-semibold tracking-wide">
            Quick Links
          </h4>
          <ul className="space-y-1.5 text-xs">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-[color:var(--gold)] transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Payment */}
        <div className="space-y-3">
          <h4 className="text-foreground font-semibold tracking-wide">
            Trading
          </h4>
          <p className="text-xs">Accepted payment methods:</p>
          <div className="flex flex-wrap gap-1.5">
            {["USDT TRC20", "USDT ERC20", "USDI", "MUP", "Bank Transfer"].map(
              (m) => (
                <span
                  key={m}
                  className="rounded border border-border bg-muted px-2 py-0.5 text-xs text-foreground/80"
                >
                  {m}
                </span>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground/80">
            All payments manually verified by platform admins.
          </p>
        </div>
      </div>

      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground/80">
        © {new Date().getFullYear()} Graphite Energy Inc. All rights reserved. ·{" "}
        <span className="text-muted-foreground/60">
          Exclusive sales agent of Etablissements Gallois S.A.
        </span>
      </div>
    </footer>
  );
}
