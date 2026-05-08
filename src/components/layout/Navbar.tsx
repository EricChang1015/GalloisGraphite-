import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/geopolitics", label: "Geopolitics" },
  { href: "/news", label: "News" },
  { href: "/chat", label: "AI Assistant" },
] as const;

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 text-foreground">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-wide shrink-0"
        >
          <span className="size-6 rounded-sm bg-[color:var(--gold)]" />
          <span>MADA GRAPHITE</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-5 text-sm text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-[color:var(--gold)] whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Sign up
            </Link>
          </div>
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
