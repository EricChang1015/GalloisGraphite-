import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCurrentProfile,
  getCurrentUser,
  isAdminRole,
} from "@/lib/auth/session";
import { MobileNav } from "@/components/layout/MobileNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NavSearchTrigger } from "@/components/layout/NavSearchTrigger";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/sustainability", label: "Sustainability" },
  { href: "/geopolitics", label: "Geopolitics" },
  { href: "/news", label: "News" },
  { href: "/chat", label: "AI Assistant" },
] as const;

/**
 * Sticky, blurred navbar. Server Component — interactive bits (search,
 * theme toggle, mobile nav) are individual client islands.
 *
 * Visual:
 *  - Logo mark in signal-cyan (with soft halo)
 *  - Brand wordmark in heavy tracking
 *  - Hover underline using signal accent
 *  - Sign-up button uses signal background as the primary CTA
 */
export async function Navbar() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;
  const isAuthenticated = Boolean(user);
  const isAdmin = isAdminRole(profile?.role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 text-foreground sm:px-6">
        {/* Brand */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 shrink-0"
          aria-label="Mada Graphite — home"
        >
          <span className="relative flex size-6 items-center justify-center">
            <span className="absolute inset-0 rounded-sm bg-signal" />
            <span
              aria-hidden
              className="absolute inset-0 rounded-sm bg-signal/40 blur-md transition-opacity group-hover:opacity-100"
            />
          </span>
          <span className="text-[13px] font-semibold tracking-[0.18em]">
            MADA GRAPHITE
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
              <span
                aria-hidden
                className="absolute left-3 right-3 -bottom-px h-px scale-x-0 bg-signal transition-transform duration-300 group-hover:scale-x-100"
              />
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5 shrink-0">
          <NavSearchTrigger />
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" })
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  href="/messages"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" })
                  )}
                >
                  Messages
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" })
                    )}
                  >
                    Admin
                  </Link>
                )}
                <LogoutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" })
                  )}
                >
                  Log in
                </Link>
                <Button
                  render={<Link href="/register" />}
                  size="sm"
                  className="bg-signal text-signal-foreground hover:bg-signal/90"
                >
                  Sign up
                </Button>
              </>
            )}
          </div>
          <MobileNav
            links={NAV_LINKS}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );
}
