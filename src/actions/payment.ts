"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminEmail, notifyUser } from "@/lib/notifications/dispatch";
import {
  describeCommercialGap,
  findCommercialProfileGaps,
} from "@/lib/auth/commercial";
import { SubmitPaymentSchema, type SubmitPaymentInput } from "@/lib/validations/forms";
import { autoCompleteIfReady } from "./order";
import type { ActionResult } from "./auth";
import type { Database, Json } from "@/types/database";

type PaymentScheduleStatus =
  Database["public"]["Enums"]["payment_schedule_status"];

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
    .select("id, buyer_id, order_no")
    .eq("id", parsed.data.order_id)
    .single<{ id: string; buyer_id: string; order_no: string }>();

  if (!order) return { data: null, error: { message: "Order not found." } };
  if (order.buyer_id !== user.id) return { data: null, error: { message: "Access denied." } };

  const missing = await findCommercialProfileGaps(user.id);
  if (missing.length > 0) {
    return {
      data: null,
      error: {
        message: describeCommercialGap(missing),
        code: "PROFILE_INCOMPLETE",
        fields: missing,
      },
    };
  }

  // Pull the schedule row and validate that it belongs to this order +
  // is currently due (or overdue) so we don't double-charge a paid one.
  const { data: schedule } = await supabase
    .from("payment_schedules")
    .select("id, order_id, status, amount, currency")
    .eq("id", parsed.data.schedule_id)
    .single<{
      id: string;
      order_id: string;
      status: PaymentScheduleStatus;
      amount: number;
      currency: string;
    }>();

  if (!schedule || schedule.order_id !== parsed.data.order_id) {
    return { data: null, error: { message: "Payment schedule not found for this order." } };
  }
  if (schedule.status !== "due" && schedule.status !== "overdue") {
    return {
      data: null,
      error: { message: `Schedule is in ${schedule.status} state; cannot accept payment.` },
    };
  }

  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      order_id: parsed.data.order_id,
      buyer_id: user.id,
      schedule_id: parsed.data.schedule_id,
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

  // Move the schedule into awaiting_review so the buyer can't submit
  // a second payment for the same installment while admin reviews.
  await admin
    .from("payment_schedules")
    .update({ status: "awaiting_review" })
    .eq("id", parsed.data.schedule_id);

  // Notify admin
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    await notifyAdminEmail({
      subject: `New payment pending review — Order ${order.order_no}`,
      html: `
          <p>A new payment has been submitted for order <strong>${order.order_no}</strong>.</p>
          <p>Amount: <strong>${parsed.data.amount} ${parsed.data.currency}</strong></p>
          <p>Method: ${parsed.data.method}</p>
          <p>TX Hash: ${parsed.data.tx_hash ?? "—"}</p>
          <p><a href="${appUrl}/admin/payments">Review in Admin</a></p>
        `,
    });
  } catch (_) {}

  revalidatePath(`/orders/${parsed.data.order_id}`);
  revalidatePath("/admin/payments");
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
    .select("order_id, buyer_id, amount, currency, schedule_id")
    .eq("id", paymentId)
    .single<{
      order_id: string;
      buyer_id: string;
      amount: number;
      currency: string;
      schedule_id: string | null;
    }>();

  if (!payment) return { data: null, error: { message: "Payment not found." } };

  const { error } = await admin
    .from("payments")
    .update({
      status: decision,
      admin_note: note ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) return { data: null, error: { message: error.message } };

  // Update the linked schedule row. If the payment was rejected, the
  // schedule goes back to `due` so the buyer can re-submit.
  if (payment.schedule_id) {
    if (decision === "verified") {
      await admin
        .from("payment_schedules")
        .update({ status: "paid", paid_payment_id: paymentId })
        .eq("id", payment.schedule_id);
    } else {
      await admin
        .from("payment_schedules")
        .update({ status: "due" })
        .eq("id", payment.schedule_id);
    }
  }

  // Append a timeline event so the order timeline tab still shows
  // payment activity (even though payment is no longer a stage).
  const { data: orderRow } = await admin
    .from("orders")
    .select("timeline")
    .eq("id", payment.order_id)
    .single<{ timeline: unknown[] }>();
  const events = Array.isArray(orderRow?.timeline) ? orderRow!.timeline : [];
  const entry = {
    event: decision === "verified" ? "payment_verified" : "payment_rejected",
    at: new Date().toISOString(),
    by: user.id,
    payment_id: paymentId,
    schedule_id: payment.schedule_id,
  };
  await admin
    .from("orders")
    .update({ timeline: [...events, entry] as Json })
    .eq("id", payment.order_id);

  // Auto-complete the order if customs cleared and this was the last
  // outstanding installment.
  if (decision === "verified") {
    await autoCompleteIfReady(payment.order_id, user.id);
  }

  // Write audit log
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: decision === "verified" ? "payment_verified" : "payment_rejected",
    target_type: "payment",
    target_id: paymentId,
    metadata: { order_id: payment.order_id, schedule_id: payment.schedule_id, note } as Json,
  });

  // Notify buyer
  try {
    const { data: buyerProfile } = await admin
      .from("profiles")
      .select("email, full_name, phone")
      .eq("id", payment.buyer_id)
      .single<{ email: string; full_name: string; phone: string | null }>();

    const subject =
      decision === "verified"
        ? "Payment verified — Mada Graphite"
        : "Payment rejected — Mada Graphite";
    const html =
      decision === "verified"
        ? `<p>Your payment of <strong>${payment.amount} ${payment.currency}</strong> has been verified.</p>`
        : `<p>Your payment has been <strong>rejected</strong>. Admin note: ${note ?? "—"}. Please re-submit or contact support.</p>`;
    const smsText =
      decision === "verified"
        ? `Mada Graphite: Payment of ${payment.amount} ${payment.currency} verified.`
        : `Mada Graphite: Payment rejected. Check your email for details.`;

    await notifyUser({
      email: buyerProfile?.email,
      phone: buyerProfile?.phone,
      subject,
      html,
      smsText,
    });
  } catch (_) {}

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath(`/orders/${payment.order_id}`);

  return { data: true, error: null };
}
