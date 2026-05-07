import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/news", label: "News" },
  { href: "/chat", label: "AI Assistant" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 text-neutral-100">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-wide"
        >
          <span className="size-6 rounded-sm bg-[color:var(--gold)]" />
          <span>MADA GRAPHITE</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-[color:var(--gold)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}
