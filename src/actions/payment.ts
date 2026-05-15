"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { SubmitPaymentSchema, type SubmitPaymentInput } from "@/lib/validations/forms";
import type { ActionResult } from "./auth";

export async function submitPayment(
  input: SubmitPaymentInput
): Promise<ActionResult<{ paymentId: string }>> {
  const parsed = SubmitPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: { message: "Invalid input.", fieldErrors: z.flattenError(parsed.error).fieldErrors },
    };
  }
  if (!parsed.data.tx_hash && !parsed.data.proof_url) {
    return { data: null, error: { message: "Please provide a tx hash or proof image." } };
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_id, status, payment_terms")
    .eq("id", parsed.data.order_id)
    .single<{ id: string; buyer_id: string; status: string; payment_terms: string | null }>();

  if (!order) return { data: null, error: { message: "Order not found." } };
  if (order.buyer_id !== user.id) return { data: null, error: { message: "Access denied." } };

  // Buyer can submit payment in two contexts:
  //  - full_prepay: order.status must be `contract_signed` (we'll move to payment_pending)
  //  - net_after_arrival: order.status must be `payment_pending` (after customs cleared)
  // For backward-compatibility we also allow legacy `signed`.
  const validForSubmit =
    order.status === "contract_signed" ||
    order.status === "signed" ||
    order.status === "payment_pending";
  if (!validForSubmit) {
    return {
      data: null,
      error: { message: `Order status ${order.status} does not allow payment submission.` },
    };
  }

  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      order_id: parsed.data.order_id,
      buyer_id: user.id,
      method: parsed.data.method,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      tx_hash: parsed.data.tx_hash ?? null,
      proof_url: parsed.data.proof_url ?? null,
      note: parsed.data.note ?? null,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) return { data: null, error: { message: error.message } };

  // Move order to payment_pending if it is not already there
  if (order.status !== "payment_pending") {
    await admin
      .from("orders")
      .update({ status: "payment_pending" })
      .eq("id", parsed.data.order_id);
  }

  // Notify admin
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New payment pending review — Order ${parsed.data.order_id}`,
        html: `
          <p>A new payment has been submitted for order <strong>${parsed.data.order_id}</strong>.</p>
          <p>Amount: <strong>${parsed.data.amount} ${parsed.data.currency}</strong></p>
          <p>Method: ${parsed.data.method}</p>
          <p>TX Hash: ${parsed.data.tx_hash ?? "—"}</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/payments">Review in Admin</a></p>
        `,
      });
    }
  } catch (_) {}

  revalidatePath(`/orders/${parsed.data.order_id}`);
  revalidatePath("/admin/payments");
  // Bump the dashboard counter too so it shows "Action needed" the moment
  // the buyer submits a new payment.
  revalidatePath("/admin");

  return { data: { paymentId: payment.id }, error: null };
}

export async function verifyPayment(
  paymentId: string,
  decision: "verified" | "rejected",
  note?: string
): Promise<ActionResult<true>> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: { message: "Not authenticated." } };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { data: null, error: { message: "Admin access required." } };
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("order_id, buyer_id, amount, currency")
    .eq("id", paymentId)
    .single<{ order_id: string; buyer_id: string; amount: number; currency: string }>();

  if (!payment) return { data: null, error: { message: "Payment not found." } };

  const { error } = await admin
    .from("payments")
    .update({ status: decision, admin_note: note ?? null, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", paymentId);

  if (error) return { data: null, error: { message: error.message } };

  if (decision === "verified") {
    // Look up order's payment terms to decide what state to move to.
    const { data: orderRow } = await admin
      .from("orders")
      .select("payment_terms, status, timeline")
      .eq("id", payment.order_id)
      .single<{ payment_terms: string | null; status: string; timeline: unknown[] }>();

    // payment_pending -> paid (always)
    await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", payment.order_id);

    // Append timeline event
    const events = Array.isArray(orderRow?.timeline) ? orderRow!.timeline : [];
    const entry = {
      event: "paid",
      at: new Date().toISOString(),
      by: user.id,
      from: "payment_pending",
      to: "paid",
      payment_id: paymentId,
    };
    await admin
      .from("orders")
      .update({ timeline: [...events, entry] as import("@/types/database").Json })
      .eq("id", payment.order_id);

    // For full_prepay: paid → in_production (auto)
    // For net_after_arrival: paid → completed (auto)
    if (orderRow?.payment_terms === "net_after_arrival") {
      await admin
        .from("orders")
        .update({ status: "completed" })
        .eq("id", payment.order_id);
      const completedEntry = {
        event: "completed",
        at: new Date().toISOString(),
        by: user.id,
        from: "paid",
        to: "completed",
      };
      await admin
        .from("orders")
        .update({ timeline: [...events, entry, completedEntry] as import("@/types/database").Json })
        .eq("id", payment.order_id);
    } else {
      // Default to full_prepay branch: paid → in_production
      await admin
        .from("orders")
        .update({ status: "in_production" })
        .eq("id", payment.order_id);
      const ipEntry = {
        event: "in_production",
        at: new Date().toISOString(),
        by: user.id,
        from: "paid",
        to: "in_production",
      };
      await admin
        .from("orders")
        .update({ timeline: [...events, entry, ipEntry] as import("@/types/database").Json })
        .eq("id", payment.order_id);
    }
  }

  // Write audit log
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: decision === "verified" ? "payment_verified" : "payment_rejected",
    target_type: "payment",
    target_id: paymentId,
    metadata: { order_id: payment.order_id, note } as import("@/types/database").Json,
  });

  // Notify buyer
  try {
    const { data: buyerProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", payment.buyer_id)
      .single<{ email: string; full_name: string }>();

    if (buyerProfile?.email) {
      const subject =
        decision === "verified"
          ? "Payment verified — Mada Graphite"
          : "Payment rejected — Mada Graphite";
      const html =
        decision === "verified"
          ? `<p>Your payment of <strong>${payment.amount} ${payment.currency}</strong> has been verified. The order is now in progress.</p>`
          : `<p>Your payment has been <strong>rejected</strong>. Admin note: ${note ?? "—"}. Please contact support.</p>`;
      await sendEmail({ to: buyerProfile.email, subject, html });
    }
  } catch (_) {}

  revalidatePath("/admin/payments");
  // The admin dashboard renders the pending-payments count card and was
  // showing a stale "1 Action needed" badge after the last pending row
  // had been verified. Force a refresh of that card too.
  revalidatePath("/admin");
  revalidatePath(`/orders/${payment.order_id}`);

  return { data: true, error: null };
}
