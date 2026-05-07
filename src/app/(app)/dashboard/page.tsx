import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingBagIcon,
  PackageIcon,
  ClipboardListIcon,
  MessageSquareIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react";

export const metadata = { title: "Dashboard — Mada Graphite" };

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name, role, status, kyc_level")
    .eq("id", user!.id)
    .single<{
      full_name: string | null;
      company_name: string | null;
      role: string;
      status: string;
      kyc_level: number;
    }>();

  const isSeller = profile?.role === "seller";
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  const [ordersRes, inquiriesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_no, status, total_amount, currency, created_at")
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{
        id: string;
        order_no: string;
        status: string;
        total_amount: number;
        currency: string;
        created_at: string;
      }[]>(),
    supabase
      .from("inquiries")
      .select("id, status, requested_qty, created_at, product_categories(name)")
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{
        id: string;
        status: string;
        requested_qty: number;
        created_at: string;
        product_categories: { name: string } | null;
      }[]>(),
  ]);

  const activeOrders = ordersRes.data ?? [];
  const pendingInquiries = inquiriesRes.data ?? [];

  const statusColor: Record<string, string> = {
    draft: "text-muted-foreground",
    contract_generated: "text-blue-400 border-blue-400/40",
    signed: "text-purple-400 border-purple-400/40",
    payment_pending: "text-yellow-400 border-yellow-400/40",
    paid: "text-green-400 border-green-400/40",
    shipped: "text-cyan-400 border-cyan-400/40",
    delivered: "text-teal-400 border-teal-400/40",
    disputed: "text-red-400 border-red-400/40",
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {profile?.company_name ?? "—"} ·{" "}
            <Badge variant="secondary" className="text-xs">
              {profile?.role}
            </Badge>
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" render={<Link href="/admin" />}>
            Go to Admin Console
          </Button>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/market">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <ShoppingBagIcon className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium">Browse Market</p>
                <p className="text-xs text-muted-foreground">Find graphite listings</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/orders">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <PackageIcon className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm font-medium">My Orders</p>
                <p className="text-xs text-muted-foreground">
                  {activeOrders.length} active
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/inquiries">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <ClipboardListIcon className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm font-medium">Inquiries</p>
                <p className="text-xs text-muted-foreground">
                  {pendingInquiries.length} pending
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        {isSeller && (
          <Link href="/listings/new">
            <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 pt-4">
                <PlusIcon className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium">New Listing</p>
                  <p className="text-xs text-muted-foreground">Post a product</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Active Orders</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/orders" />} className="text-xs h-7">
                View all <ArrowRightIcon className="w-3 h-3 ml-1" />
              </Button>
          </CardHeader>
          <CardContent>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active orders.</p>
            ) : (
              <div className="space-y-2">
                {activeOrders.map((o) => (
                  <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{o.order_no}</span>
                    <span className="font-medium">{o.total_amount} {o.currency}</span>
                    <Badge variant="outline" className={`text-xs ${statusColor[o.status] ?? ""}`}>
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Inquiries */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Pending Inquiries</CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/inquiries" />} className="text-xs h-7">
                View all <ArrowRightIcon className="w-3 h-3 ml-1" />
              </Button>
          </CardHeader>
          <CardContent>
            {pendingInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending inquiries.</p>
            ) : (
              <div className="space-y-2">
                {pendingInquiries.map((inq) => (
                  <Link key={inq.id} href="/inquiries" className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted text-sm">
                    <span className="font-medium">{inq.product_categories?.name ?? "—"}</span>
                    <span className="text-muted-foreground text-xs">{inq.requested_qty} MT</span>
                    <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/40">
                      pending
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
