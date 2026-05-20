import "server-only";

import { sendEmail } from "@/lib/email/resend";
import { sendSms, isSmsConfigured } from "@/lib/sms/client";
import { getSmsNotificationsEnabled } from "@/lib/platform/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MILESTONE_LABEL,
  type PaymentMilestone,
} from "@/lib/validations/payment-schedule";

export async function notifyUser(params: {
  email?: string | null;
  phone?: string | null;
  subject: string;
  html: string;
  smsText: string;
}) {
  try {
    if (params.email) {
      await sendEmail({
        to: params.email,
        subject: params.subject,
        html: params.html,
      });
    }
  } catch (_) {}

  try {
    const phone = params.phone?.trim();
    if (
      phone &&
      isSmsConfigured() &&
      (await getSmsNotificationsEnabled())
    ) {
      await sendSms({ to: phone, content: params.smsText });
    }
  } catch (_) {}
}

export async function notifyAdminEmail(params: {
  subject: string;
  html: string;
}) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    await sendEmail({
      to: adminEmail,
      subject: params.subject,
      html: params.html,
    });
  } catch (_) {}
}

// ---------------------------------------------------------------------
// Payment schedule notifications
// ---------------------------------------------------------------------

interface ScheduleNotifyContext {
  orderNo: string;
  orderId: string;
  buyerEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  milestone: PaymentMilestone;
  amount: number;
  currency: string;
  dueDate: string | null;
}

async function loadScheduleContext(
  orderId: string,
  scheduleId: string
): Promise<ScheduleNotifyContext | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_schedules")
    .select(
      "id, milestone, amount, currency, due_date, orders!inner(id, order_no, buyer:profiles!orders_buyer_id_fkey(email, full_name, phone))"
    )
    .eq("id", scheduleId)
    .single<{
      id: string;
      milestone: PaymentMilestone;
      amount: number;
      currency: string;
      due_date: string | null;
      orders: {
        id: string;
        order_no: string;
        buyer: { email: string | null; full_name: string | null; phone: string | null } | null;
      };
    }>();
  if (!data) return null;
  return {
    orderId,
    orderNo: data.orders.order_no,
    buyerEmail: data.orders.buyer?.email ?? null,
    buyerName: data.orders.buyer?.full_name ?? null,
    buyerPhone: data.orders.buyer?.phone ?? null,
    milestone: data.milestone,
    amount: data.amount,
    currency: data.currency,
    dueDate: data.due_date,
  };
}

/**
 * Fired by the cron when a `scheduled` payment installment transitions
 * to `due`. Pings the buyer once with an email + SMS.
 */
export async function notifyScheduleDue(orderId: string, scheduleId: string) {
  const ctx = await loadScheduleContext(orderId, scheduleId);
  if (!ctx) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const label = MILESTONE_LABEL[ctx.milestone];
  await notifyUser({
    email: ctx.buyerEmail,
    phone: ctx.buyerPhone,
    subject: `Payment installment due — ${ctx.orderNo}`,
    html: `
        <p>Hi ${ctx.buyerName || "Buyer"},</p>
        <p>An installment on order <strong>${ctx.orderNo}</strong> is now due
           (milestone: <strong>${label}</strong>).</p>
        <p>Amount: <strong>${ctx.amount.toFixed(2)} ${ctx.currency}</strong></p>
        ${ctx.dueDate ? `<p>Please settle by <strong>${ctx.dueDate}</strong>.</p>` : ""}
        <p><a href="${appUrl}/orders/${ctx.orderId}">Open order to pay</a></p>
      `,
    smsText: `Mada Graphite: Payment installment due (${label}). ${appUrl}/orders/${ctx.orderId}`,
  });
}

/**
 * Fired by the cron when a `due` installment crosses past its due date.
 * Notifies both the buyer and the admin so the admin can chase.
 */
export async function notifyScheduleOverdue(orderId: string, scheduleId: string) {
  const ctx = await loadScheduleContext(orderId, scheduleId);
  if (!ctx) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const label = MILESTONE_LABEL[ctx.milestone];

  await notifyUser({
    email: ctx.buyerEmail,
    phone: ctx.buyerPhone,
    subject: `Payment installment OVERDUE — ${ctx.orderNo}`,
    html: `
        <p>Hi ${ctx.buyerName || "Buyer"},</p>
        <p>An installment on order <strong>${ctx.orderNo}</strong> is now
           <strong style="color:#d33">overdue</strong> (milestone:
           <strong>${label}</strong>).</p>
        <p>Amount: <strong>${ctx.amount.toFixed(2)} ${ctx.currency}</strong></p>
        ${ctx.dueDate ? `<p>Due date was <strong>${ctx.dueDate}</strong>.</p>` : ""}
        <p>Please settle immediately or contact support if you need help.</p>
        <p><a href="${appUrl}/orders/${ctx.orderId}">Open order</a></p>
      `,
    smsText: `Mada Graphite: Payment OVERDUE (${label}). ${appUrl}/orders/${ctx.orderId}`,
  });

  await notifyAdminEmail({
    subject: `Payment overdue — ${ctx.orderNo}`,
    html: `
        <p>Order <strong>${ctx.orderNo}</strong> has an overdue installment.</p>
        <p>Milestone: ${label}<br />
           Amount: ${ctx.amount.toFixed(2)} ${ctx.currency}<br />
           Was due: ${ctx.dueDate ?? "—"}</p>
        <p><a href="${appUrl}/admin/orders/${ctx.orderId}">Open in Admin</a></p>
      `,
  });
}
