import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/layout/Navbar";
import type { WorkspaceMobileSection } from "@/components/layout/MobileNav";
import { Badge } from "@/components/ui/badge";
import { getAdminActionCounts } from "@/lib/notifications/counts";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("admin");
  const counts = await getAdminActionCounts();

  const navItems = [
    { href: "/admin/users" as const, label: t("layout.nav.users") },
    { href: "/admin/categories" as const, label: t("layout.nav.categories") },
    { href: "/admin/orders" as const, label: t("layout.nav.orders") },
    { href: "/admin/payments" as const, label: t("layout.nav.payments") },
    { href: "/admin/news" as const, label: t("layout.nav.news") },
    { href: "/admin/settings" as const, label: t("layout.nav.settings") },
  ];

  const badgeFor = (href: string): React.ReactNode => {
    if (href === "/admin/users" && counts.usersNeedsAction > 0) {
      return (
        <Badge
          variant="outline"
          className="ml-auto h-5 min-w-5 px-1.5 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
          title={t("layout.badges.usersNeedsAction")}
        >
          {counts.usersNeedsAction}
        </Badge>
      );
    }
    if (href === "/admin/payments" && counts.paymentsPending > 0) {
      return (
        <Badge
          variant="outline"
          className="ml-auto h-5 min-w-5 px-1.5 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
          title={t("layout.badges.paymentsPending")}
        >
          {counts.paymentsPending}
        </Badge>
      );
    }
    if (href === "/admin/orders" && counts.ordersDisputed > 0) {
      return (
        <Badge
          variant="destructive"
          className="ml-auto h-5 min-w-5 px-1.5"
          title={t("layout.badges.disputedOrders")}
        >
          {counts.ordersDisputed}
        </Badge>
      );
    }
    return null;
  };

  const workspace: WorkspaceMobileSection = {
    label: t("layout.consoleTitle"),
    items: [
      { href: "/admin", label: t("layout.overview") },
      { href: "/dashboard", label: t("layout.links.dashboard") },
      ...navItems.map((item) => ({
        href: item.href,
        label: item.label,
        badge: badgeFor(item.href),
      })),
    ],
  };

  return (
    <>
      <Navbar workspace={workspace} />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 flex-col border-r border-border bg-card">
          <div className="px-4 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("layout.consoleTitle")}
          </div>
          <nav className="flex flex-col px-2 py-2 gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("layout.links.dashboard")}
            </Link>
            <Link
              href="/"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("layout.links.home")}
            </Link>
            <div className="my-1 border-t border-border" aria-hidden />
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <span>{item.label}</span>
                {badgeFor(item.href)}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </div>
    </>
  );
}
