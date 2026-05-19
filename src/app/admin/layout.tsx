import Link from "next/link";

import { Navbar } from "@/components/layout/Navbar";
import { Badge } from "@/components/ui/badge";
import { getAdminActionCounts } from "@/lib/notifications/counts";

const ADMIN_NAV = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const counts = await getAdminActionCounts();

  const badgeFor = (href: string): React.ReactNode => {
    if (href === "/admin/payments" && counts.paymentsPending > 0) {
      return (
        <Badge
          variant="outline"
          className="ml-auto h-5 min-w-5 px-1.5 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
          title="Payments awaiting review"
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
          title="Disputed orders"
        >
          {counts.ordersDisputed}
        </Badge>
      );
    }
    return null;
  };

  return (
    <>
      <Navbar />
      <div className="flex flex-1">
        <aside className="hidden md:flex md:w-56 flex-col border-r border-border bg-card">
          <div className="px-4 py-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Admin Console
          </div>
          <nav className="flex flex-col px-2 py-2 gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Home
            </Link>
            <div className="my-1 border-t border-border" aria-hidden />
            {ADMIN_NAV.map((item) => (
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
