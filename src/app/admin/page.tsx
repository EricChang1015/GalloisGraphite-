import Link from "next/link";
import {
  UsersIcon,
  PackageIcon,
  CreditCardIcon,
  AlertOctagonIcon,
} from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminActionCounts } from "@/lib/notifications/counts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Admin Dashboard — Mada Graphite" };

// The dashboard renders live action-required counters; never serve a stale
// static copy. Verifying a payment from /admin/payments revalidates /admin,
// but we also need to make sure the very first load isn't cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const admin = createAdminClient();

  const [usersRes, ordersRes, counts] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }),
    getAdminActionCounts(),
  ]);

  const stats = [
    {
      label: "Total Users",
      value: usersRes.count ?? 0,
      icon: UsersIcon,
      href: "/admin/users",
      color: "text-blue-400",
      alert: false as const,
      alertTone: "info" as const,
    },
    {
      label: "Total Orders",
      value: ordersRes.count ?? 0,
      icon: PackageIcon,
      href: "/admin/orders",
      color: "text-green-400",
      alert: false as const,
      alertTone: "info" as const,
    },
    {
      label: "Disputed Orders",
      value: counts.ordersDisputed,
      icon: AlertOctagonIcon,
      href: "/admin/orders?status=disputed",
      color: counts.ordersDisputed > 0 ? "text-destructive" : "text-muted-foreground",
      alert: counts.ordersDisputed > 0,
      alertTone: "destructive" as const,
    },
    {
      label: "Payments Pending",
      value: counts.paymentsPending,
      icon: CreditCardIcon,
      href: "/admin/payments",
      color:
        counts.paymentsPending > 0 ? "text-yellow-400" : "text-muted-foreground",
      alert: counts.paymentsPending > 0,
      alertTone: "warning" as const,
    },
  ];

  type PriorityItem = {
    key: string;
    href: string;
    title: string;
    sub: string;
    tone: "gold" | "red";
  };

  const priorities: PriorityItem[] = [];
  if (counts.ordersDisputed > 0) {
    priorities.push({
      key: "disputed",
      href: "/admin/orders?status=disputed",
      title: `${counts.ordersDisputed} disputed order${counts.ordersDisputed === 1 ? "" : "s"}`,
      sub: "Open mediation: review timeline + force-transition if needed.",
      tone: "red",
    });
  }
  if (counts.paymentsPending > 0) {
    priorities.push({
      key: "payments",
      href: "/admin/payments",
      title: `${counts.paymentsPending} payment${counts.paymentsPending === 1 ? "" : "s"} awaiting review`,
      sub: "Verifying a proof automatically advances the order to paid.",
      tone: "gold",
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform overview and the items waiting on the admin team.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold">{stat.value}</span>
                    {stat.alert && (
                      <Badge
                        variant={
                          stat.alertTone === "destructive"
                            ? "destructive"
                            : "outline"
                        }
                        className={
                          stat.alertTone === "destructive"
                            ? "text-xs"
                            : "text-xs border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                        }
                      >
                        {stat.alertTone === "destructive"
                          ? "Action needed"
                          : "Action needed"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {priorities.length > 0 ? (
        <Card className="border-[color:var(--gold)]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-[color:var(--gold)]">⭐</span>
              Priority Actions
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Items waiting on the admin team.
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {priorities.map((p) => (
                <Link
                  key={p.key}
                  href={p.href}
                  className="flex items-center justify-between gap-3 py-2.5 hover:text-foreground"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.sub}</p>
                  </div>
                  <Badge
                    variant={p.tone === "red" ? "destructive" : "outline"}
                    className={
                      p.tone === "red"
                        ? "shrink-0"
                        : "shrink-0 border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                    }
                  >
                    {p.tone === "red" ? "Disputed" : "Review"}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">All caught up</p>
          <p>
            No disputed orders and no pending payments to review. Use the
            sidebar to manage{" "}
            <Link href="/admin/users" className="text-primary underline">
              users
            </Link>
            ,{" "}
            <Link href="/admin/categories" className="text-primary underline">
              categories
            </Link>
            , or{" "}
            <Link href="/admin/news" className="text-primary underline">
              news
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
