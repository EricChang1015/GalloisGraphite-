import Link from "next/link";
import {
  UsersIcon,
  PackageIcon,
  CreditCardIcon,
  AlertOctagonIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminActionCounts } from "@/lib/notifications/counts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: `${t("meta.dashboard")} — Mada Graphite` };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();

  const [usersRes, ordersRes, counts] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }),
    getAdminActionCounts(),
  ]);

  const stats = [
    {
      label: t("dashboard.stats.totalUsers"),
      value: usersRes.count ?? 0,
      icon: UsersIcon,
      href: "/admin/users",
      color: "text-blue-400",
      alert: false as const,
      alertTone: "info" as const,
    },
    {
      label: t("dashboard.stats.totalOrders"),
      value: ordersRes.count ?? 0,
      icon: PackageIcon,
      href: "/admin/orders",
      color: "text-green-400",
      alert: false as const,
      alertTone: "info" as const,
    },
    {
      label: t("dashboard.stats.disputedOrders"),
      value: counts.ordersDisputed,
      icon: AlertOctagonIcon,
      href: "/admin/orders?status=disputed",
      color: counts.ordersDisputed > 0 ? "text-destructive" : "text-muted-foreground",
      alert: counts.ordersDisputed > 0,
      alertTone: "destructive" as const,
    },
    {
      label: t("dashboard.stats.paymentsPending"),
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
      title: t("dashboard.priority.disputedTitle", { count: counts.ordersDisputed }),
      sub: t("dashboard.priority.disputedSub"),
      tone: "red",
    });
  }
  if (counts.paymentsPending > 0) {
    priorities.push({
      key: "payments",
      href: "/admin/payments",
      title: t("dashboard.priority.paymentsTitle", { count: counts.paymentsPending }),
      sub: t("dashboard.priority.paymentsSub"),
      tone: "gold",
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("dashboard.subtitle")}</p>
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
                        {t("dashboard.actionNeeded")}
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
              {t("dashboard.priority.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("dashboard.priority.subtitle")}
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
                    {p.tone === "red"
                      ? t("dashboard.priority.badgeDisputed")
                      : t("dashboard.priority.badgeReview")}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">{t("dashboard.caughtUp.title")}</p>
          <p>
            {t.rich("dashboard.caughtUp.body", {
              usersLink: (chunks) => (
                <Link href="/admin/users" className="text-primary underline">
                  {chunks}
                </Link>
              ),
              categoriesLink: (chunks) => (
                <Link href="/admin/categories" className="text-primary underline">
                  {chunks}
                </Link>
              ),
              newsLink: (chunks) => (
                <Link href="/admin/news" className="text-primary underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
