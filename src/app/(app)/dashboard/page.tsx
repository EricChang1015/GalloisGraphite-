import { createServerClient } from "@/lib/supabase/server";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type {
  DashboardInquiry,
  DashboardOrder,
  DashboardProfile,
} from "@/components/dashboard/types";

export const metadata = { title: "Dashboard — Mada Graphite" };

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name, role, status, kyc_level")
    .eq("id", user!.id)
    .single<DashboardProfile>();

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
      .returns<DashboardOrder[]>(),
    supabase
      .from("inquiries")
      .select("id, status, requested_qty, created_at, product_categories(name)")
      .or(`buyer_id.eq.${user!.id},seller_id.eq.${user!.id}`)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<DashboardInquiry[]>(),
  ]);

  return (
    <DashboardShell
      data={{
        profile: profile ?? null,
        activeOrders: ordersRes.data ?? [],
        pendingInquiries: inquiriesRes.data ?? [],
        isSeller,
        isAdmin,
      }}
    />
  );
}
