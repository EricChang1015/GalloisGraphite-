import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ShoppingBagIcon,
  PackageIcon,
  ClipboardListIcon,
  PlusIcon,
  ArrowRightIcon,
  AlertTriangleIcon,
  SettingsIcon,
  ListIcon,
} from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import {
  describeOrderActionKey,
  getInquiriesNeedingMyResponse,
  getOrderActionOwner,
  getUserActionCounts,
} from "@/lib/notifications/counts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: `${t("metaTitle")} — Mada Graphite` };
}

// Counts can shift after any server-action mutation that revalidates
// `/dashboard`; never serve a stale prerender.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InquiryRow = {
  id: string;
  status: string;
  requested_qty: number;
  created_at: string;
  product_categories: { name: string } | null;
  listings: { id: string; title: string } | null;
};

type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();

  if (!user || !profile) redirect("/login");

  const supabase = await createServerClient();

  const isSeller = profile.role === "seller";
  const isBuyer = profile.role === "buyer";
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";

  const counts = await getUserActionCounts(user.id, profile.role);
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const tEnums = await getTranslations("enums");

  // "My turn" inquiry IDs — accurate post-027: pending + live quotations
  // whose `created_by` is the OTHER party. See `counts.ts` for details.
  const myTurnIds = await getInquiriesNeedingMyResponse(
    supabase,
    user.id,
    profile.role
  );

  const [ordersRes, actionableInquiriesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_no, status, total_amount, currency, buyer_id, seller_id, created_at"
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<OrderRow[]>(),
    myTurnIds.size > 0
      ? supabase
          .from("inquiries")
          .select(
            "id, status, requested_qty, created_at, product_categories(name), listings(id, title)"
          )
          .in("id", Array.from(myTurnIds))
          .order("created_at", { ascending: false })
          .limit(5)
          .returns<InquiryRow[]>()
      : Promise.resolve({ data: [] as InquiryRow[] }),
  ]);

  const activeOrders = ordersRes.data ?? [];
  const actionableInquiries = actionableInquiriesRes.data ?? [];

  // Build the "Priority Actions" feed: blend orders-needing-my-action with
  // inquiries-needing-my-response, sort by most recent, take top 5. This is
  // what we surface front-and-centre so a user doesn't have to dig into the
  // Inquiries page to discover they have an open task.
  type Priority = {
    key: string;
    href: string;
    title: string;
    sub: string;
    createdAt: string;
    tone: "gold" | "red";
  };

  const orderPriorities: Priority[] = activeOrders
    .filter((o) => {
      const owner = getOrderActionOwner(o.status);
      if (owner === "admin") return true; // disputed → surface to both parties
      if (isSeller) return owner === "seller";
      if (isBuyer) return owner === "buyer";
      return false;
    })
    .map((o) => {
      const role: "buyer" | "seller" =
        o.buyer_id === user.id ? "buyer" : "seller";
      const actionKey = describeOrderActionKey(o.status, role);
      const hint = actionKey
        ? tEnums(actionKey)
        : tEnums(`order.status.${o.status as "draft"}`);
      const tone: "gold" | "red" = o.status === "disputed" ? "red" : "gold";
      return {
        key: `order-${o.id}`,
        href: `/orders/${o.id}`,
        title: t("priority.orderLabel", { orderNo: o.order_no }),
        sub: hint,
        createdAt: o.created_at,
        tone,
      };
    });

  const inquiryPriorities: Priority[] = actionableInquiries.map((inq) => {
    const productName =
      inq.listings?.title ??
      inq.product_categories?.name ??
      t("inquiryDefaultName");
    const sub = isSeller
      ? inq.status === "negotiating"
        ? t("inquiryAction.respondCounter")
        : t("inquiryAction.sendQuotation")
      : inq.status === "negotiating"
        ? t("inquiryAction.respondCounter")
        : t("inquiryAction.reviewQuotation");
    return {
      key: `inquiry-${inq.id}`,
      href: "/inquiries",
      title: productName,
      sub,
      createdAt: inq.created_at,
      tone: "gold",
    };
  });

  const priorities = [...orderPriorities, ...inquiryPriorities]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const statusColor: Record<string, string> = {
    draft: "text-muted-foreground",
    contract_generated: "text-blue-400 border-blue-400/40",
    contract_pending: "text-blue-400 border-blue-400/40",
    signed: "text-purple-400 border-purple-400/40",
    contract_signed: "text-purple-400 border-purple-400/40",
    payment_pending: "text-yellow-400 border-yellow-400/40",
    paid: "text-green-400 border-green-400/40",
    in_production: "text-green-400 border-green-400/40",
    ready_to_ship: "text-cyan-400 border-cyan-400/40",
    shipped: "text-cyan-400 border-cyan-400/40",
    in_transit: "text-cyan-400 border-cyan-400/40",
    arrived: "text-teal-400 border-teal-400/40",
    customs_cleared: "text-teal-400 border-teal-400/40",
    delivered: "text-teal-400 border-teal-400/40",
    disputed: "text-red-400 border-red-400/40",
  };

  const inquirySubtitle = counts
    ? counts.inquiriesNeedingMyResponse > 0
      ? t("quick.inquiriesNeedingResponse", {
          count: counts.inquiriesNeedingMyResponse,
        })
      : t("quick.inquiriesAllCaughtUp")
    : t("quick.inquiriesEmDash");

  const orderSubtitleParts: string[] = [];
  if (counts) {
    if (counts.ordersNeedingMyAction > 0) {
      orderSubtitleParts.push(
        t("quick.ordersNeedingAction", { count: counts.ordersNeedingMyAction })
      );
    }
    if (counts.ordersDisputed > 0) {
      orderSubtitleParts.push(
        t("quick.ordersDisputed", { count: counts.ordersDisputed })
      );
    }
    if (orderSubtitleParts.length === 0) {
      orderSubtitleParts.push(
        t("quick.ordersActive", { count: activeOrders.length })
      );
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {profile.full_name
              ? t("welcomeNamed", { name: profile.full_name })
              : t("welcome")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {profile.company_name ?? t("noCompany")} ·{" "}
            <Badge variant="secondary" className="text-xs">
              {tEnums(`role.${profile.role}`)}
            </Badge>
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" render={<Link href="/admin" />}>
            {t("goToAdmin")}
          </Button>
        )}
      </div>

      {counts?.profileIncomplete && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {t("profileIncomplete.title")}
            </p>
            <p className="text-muted-foreground">
              {t("profileIncomplete.body")}
            </p>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/settings" />}>
            {tCommon("actions.openSettings")}
          </Button>
        </div>
      )}

      {/* Quick links — mirror the desktop sidebar so phone users have
          the same surface area. Wraps to multiple rows on mobile. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/market">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <ShoppingBagIcon className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium">{t("quick.market")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("quick.marketSub")}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/orders">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <PackageIcon className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("quick.orders")}</p>
                <p className="text-xs text-muted-foreground">
                  {orderSubtitleParts.join(" · ") ||
                    t("quick.ordersActive", { count: activeOrders.length })}
                </p>
              </div>
              {counts && counts.ordersNeedingMyAction > 0 && (
                <Badge
                  variant="outline"
                  className="border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                >
                  {counts.ordersNeedingMyAction}
                </Badge>
              )}
            </CardContent>
          </Card>
        </Link>
        <Link href="/inquiries">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <ClipboardListIcon className="w-5 h-5 text-purple-400" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("quick.inquiries")}</p>
                <p className="text-xs text-muted-foreground">{inquirySubtitle}</p>
              </div>
              {counts && counts.inquiriesNeedingMyResponse > 0 && (
                <Badge
                  variant="outline"
                  className="border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                >
                  {counts.inquiriesNeedingMyResponse}
                </Badge>
              )}
            </CardContent>
          </Card>
        </Link>
        {isSeller && (
          <Link href="/listings">
            <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 pt-4">
                <ListIcon className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-medium">{t("quick.myListings")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("quick.myListingsSub")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        {isSeller && (
          <Link href="/listings/new">
            <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-3 pt-4">
                <PlusIcon className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-medium">{t("quick.newListing")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("quick.newListingSub")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        <Link href="/settings">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
            <CardContent className="flex items-center gap-3 pt-4">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{t("quick.settings")}</p>
                <p className="text-xs text-muted-foreground">
                  {counts?.profileIncomplete
                    ? t("quick.settingsNeedsAttention")
                    : t("quick.settingsDefault")}
                </p>
              </div>
              {counts?.profileIncomplete && (
                <span
                  className="inline-block size-2 rounded-full bg-destructive"
                  aria-label={t("quick.settingsNeedsAttention")}
                />
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Priority Actions */}
      {priorities.length > 0 && (
        <Card className="border-[color:var(--gold)]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-[color:var(--gold)]">⭐</span>
              {t("priority.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("priority.subtitle")}
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
                    {p.tone === "red" ? tCommon("disputed") : tCommon("yourTurn")}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t("activeOrders.title")}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/orders" />}
              className="text-xs h-7"
            >
              {tCommon("actions.viewAll")} <ArrowRightIcon className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("activeOrders.empty")}
              </p>
            ) : (
              <div className="space-y-2">
                {activeOrders.map((o) => {
                  const role: "buyer" | "seller" =
                    o.buyer_id === user.id ? "buyer" : "seller";
                  const owner = getOrderActionOwner(o.status);
                  const isMyTurn = owner === role;
                  const isDisputed = o.status === "disputed";
                  return (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-muted text-sm"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {o.order_no}
                      </span>
                      <span className="font-medium hidden sm:inline">
                        {o.total_amount} {o.currency}
                      </span>
                      <div className="flex items-center gap-1">
                        {isDisputed ? (
                          <Badge variant="destructive" className="text-xs">
                            {tCommon("disputed")}
                          </Badge>
                        ) : isMyTurn ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                          >
                            {tCommon("yourTurn")}
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColor[o.status] ?? ""}`}
                        >
                          {tEnums(`order.status.${o.status as "draft"}`)}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inquiries needing your response */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              {isSeller
                ? t("inquiriesPanel.titleSeller")
                : isBuyer
                  ? t("inquiriesPanel.titleBuyer")
                  : t("inquiriesPanel.titleDefault")}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/inquiries" />}
              className="text-xs h-7"
            >
              {tCommon("actions.viewAll")} <ArrowRightIcon className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {actionableInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isSeller
                  ? t("inquiriesPanel.emptySeller")
                  : isBuyer
                    ? t("inquiriesPanel.emptyBuyer")
                    : t("inquiriesPanel.emptyDefault")}
              </p>
            ) : (
              <div className="space-y-2">
                {actionableInquiries.map((inq) => (
                  <Link
                    key={inq.id}
                    href="/inquiries"
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-muted text-sm"
                  >
                    <span className="font-medium truncate">
                      {inq.listings?.title ??
                        inq.product_categories?.name ??
                        "—"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {tCommon("units.tons", { count: inq.requested_qty })}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs border-[color:var(--gold)]/40 text-[color:var(--gold)]"
                    >
                      {inq.status === "negotiating"
                        ? t("inquiriesPanel.statusNegotiating")
                        : t("inquiriesPanel.statusYourTurn")}
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
