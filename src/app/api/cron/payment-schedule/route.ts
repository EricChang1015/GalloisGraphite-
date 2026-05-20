import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyScheduleDue,
  notifyScheduleOverdue,
} from "@/lib/notifications/dispatch";
import { BL_OFFSET_DAYS } from "@/lib/validations/payment-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron daily entry point for payment-schedule housekeeping.
 *
 * What this does (idempotent):
 *   1. For each order that has a `bl_date`, back-fill `due_date` on any
 *      `bl_date_plus_N` schedule rows that don't have one yet.
 *   2. Promote `scheduled` rows whose `due_date <= today` to `due` and
 *      notify the buyer.
 *   3. Promote `due` rows whose `due_date < today` (i.e. past due) to
 *      `overdue` and notify buyer + admin.
 *
 * The cron is gated by a `CRON_SECRET` header to prevent random callers
 * from spamming the workflow. Vercel's cron infra sets `x-vercel-cron`,
 * which we also accept.
 *
 * Scheduled in `vercel.json`:
 *   { "path": "/api/cron/payment-schedule", "schedule": "0 4 * * *" }
 */
export async function GET(req: Request) {
  const headers = req.headers;
  const authorised =
    headers.get("x-vercel-cron") === "1" ||
    headers.get("x-cron-secret") === process.env.CRON_SECRET ||
    headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  let backfilled = 0;
  let promotedDue = 0;
  let promotedOverdue = 0;

  // ---------- 1. back-fill bl_date_plus_N due_date ----------
  const { data: blRows } = await admin
    .from("payment_schedules")
    .select("id, order_id, milestone, bl_offset_days, due_date, status")
    .in("milestone", ["bl_date_plus_30", "bl_date_plus_60", "bl_date_plus_90"])
    .is("due_date", null)
    .returns<
      Array<{
        id: string;
        order_id: string;
        milestone: "bl_date_plus_30" | "bl_date_plus_60" | "bl_date_plus_90";
        bl_offset_days: number | null;
        due_date: string | null;
        status: string;
      }>
    >();

  if (blRows && blRows.length > 0) {
    const orderIds = Array.from(new Set(blRows.map((r) => r.order_id)));
    const { data: orders } = await admin
      .from("orders")
      .select("id, bl_date")
      .in("id", orderIds)
      .returns<Array<{ id: string; bl_date: string | null }>>();
    const blByOrder = new Map<string, string>();
    for (const o of orders ?? []) {
      if (o.bl_date) blByOrder.set(o.id, o.bl_date);
    }
    for (const row of blRows) {
      const bl = blByOrder.get(row.order_id);
      if (!bl) continue;
      const d = new Date(bl);
      d.setDate(d.getDate() + (row.bl_offset_days ?? BL_OFFSET_DAYS[row.milestone]));
      const due = d.toISOString().slice(0, 10);
      const { error } = await admin
        .from("payment_schedules")
        .update({ due_date: due })
        .eq("id", row.id);
      if (!error) backfilled++;
    }
  }

  // ---------- 2. scheduled -> due ----------
  const { data: dueRows } = await admin
    .from("payment_schedules")
    .select("id, order_id, milestone")
    .eq("status", "scheduled")
    .not("due_date", "is", null)
    .lte("due_date", today)
    .returns<Array<{ id: string; order_id: string; milestone: string }>>();

  for (const row of dueRows ?? []) {
    const { error } = await admin
      .from("payment_schedules")
      .update({ status: "due" })
      .eq("id", row.id)
      .eq("status", "scheduled");
    if (!error) {
      promotedDue++;
      try {
        await notifyScheduleDue(row.order_id, row.id);
      } catch (_) {}
    }
  }

  // ---------- 3. due -> overdue ----------
  // Treat any row whose due_date is strictly before today as overdue.
  const { data: overdueRows } = await admin
    .from("payment_schedules")
    .select("id, order_id, milestone")
    .eq("status", "due")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .returns<Array<{ id: string; order_id: string; milestone: string }>>();

  for (const row of overdueRows ?? []) {
    const { error } = await admin
      .from("payment_schedules")
      .update({ status: "overdue" })
      .eq("id", row.id)
      .eq("status", "due");
    if (!error) {
      promotedOverdue++;
      try {
        await notifyScheduleOverdue(row.order_id, row.id);
      } catch (_) {}
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    backfilled,
    promotedDue,
    promotedOverdue,
  });
}
