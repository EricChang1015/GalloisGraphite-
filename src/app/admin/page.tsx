import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsersIcon, PackageIcon, CreditCardIcon, NewspaperIcon } from "lucide-react";

export const metadata = { title: "Admin Dashboard — Mada Graphite" };

// The dashboard renders live action-required counters; never serve a stale
// static copy. (Verifying a payment from /admin/payments revalidates /admin,
// but we also need to make sure the very first load isn't cached.)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const admin = createAdminClient();

  const [usersRes, ordersRes, pendingPaymentsRes, categoriesRes] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }),
    admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin.from("product_categories").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const stats = [
    {
      label: "Total Users",
      value: usersRes.count ?? 0,
      icon: UsersIcon,
      href: "/admin/users",
      color: "text-blue-400",
    },
    {
      label: "Total Orders",
      value: ordersRes.count ?? 0,
      icon: PackageIcon,
      href: "/admin/orders",
      color: "text-green-400",
    },
    {
      label: "Payments Pending",
      value: pendingPaymentsRes.count ?? 0,
      icon: CreditCardIcon,
      href: "/admin/payments",
      color: (pendingPaymentsRes.count ?? 0) > 0 ? "text-yellow-400" : "text-muted-foreground",
      alert: (pendingPaymentsRes.count ?? 0) > 0,
    },
    {
      label: "Active Categories",
      value: categoriesRes.count ?? 0,
      icon: NewspaperIcon,
      href: "/admin/categories",
      color: "text-purple-400",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform overview and quick access to key workflows.
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
                      <Badge variant="destructive" className="text-xs">
                        Action needed
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">⭐ Priority Action</p>
        <p>
          Go to{" "}
          <Link href="/admin/payments" className="text-primary underline">
            Payments
          </Link>{" "}
          to review any pending buyer payments. Verified payments automatically advance orders to
          &quot;paid&quot; status.
        </p>
      </div>
    </div>
  );
}
