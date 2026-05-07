"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { SubmitPaymentSchema, type SubmitPaymentInput } from "@/lib/validations/forms";
import type { ActionResult } from "./auth";

export { SubmitPaymentSchema };
export type { SubmitPaymentInput } from "@/lib/validations/forms";

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
    .select("id, buyer_id, status")
    .eq("id", parsed.data.order_id)
    .single<{ id: string; buyer_id: string; status: string }>();

  if (!order) return { data: null, error: { message: "Order not found." } };
  if (order.buyer_id !== user.id) return { data: null, error: { message: "Access denied." } };
  if (order.status !== "signed") {
    return { data: null, error: { message: "Order must be in 'signed' status to submit payment." } };
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

  // Move order to payment_pending
  await admin
    .from("orders")
    .update({ status: "payment_pending" })
    .eq("id", parsed.data.order_id);

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
    await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", payment.order_id);
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
  revalidatePath(`/orders/${payment.order_id}`);

  return { data: true, error: null };
}
