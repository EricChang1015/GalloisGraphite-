#!/usr/bin/env node
/**
 * A7 Scenario B — completion gate (autoCompleteIfReady).
 * Ensures customs_cleared + partial payment does NOT complete;
 * all schedules paid → completed.
 *
 * Usage: node scripts/smoke-a7-completion-gate.mjs [--cleanup]
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  createAdminQuery,
  loadEnvLocal,
  sqlEscape as esc,
} from "./lib/supabase-env.mjs";

const CLEANUP = process.argv.includes("--cleanup");
const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd";
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc";
const CATEGORY = "1f135ab2-7017-433d-95f6-247ee5278c86";

const env = loadEnvLocal();
const q = createAdminQuery(env);
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

let pass = 0;
let fail = 0;
function check(cond, label, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Mirrors `maybeAutoComplete` in src/actions/order.ts */
async function maybeAutoComplete(orderId, actorId) {
  const { data: order } = await service
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();
  if (!order || order.status !== "customs_cleared") return { skipped: true };

  const { count: remaining } = await service
    .from("payment_schedules")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .neq("status", "paid")
    .neq("status", "waived");

  if ((remaining ?? 0) > 0) return { skipped: true, remaining };

  const { error } = await service
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  await service.from("orders").select("timeline").eq("id", orderId).single();
  // timeline append omitted in smoke — status is the gate under test
  void actorId;
  return { completed: true };
}

async function seedOrder3070() {
  const listingId = randomUUID();
  const inquiryId = randomUUID();
  const quotationId = randomUUID();
  const orderId = randomUUID();
  const orderNo = `ORD-A7-GATE-${Date.now().toString(36).toUpperCase()}`;
  const total = 100_000;

  await q(`
    insert into public.listings (
      id, seller_id, category_id, title, specs, quantity, unit,
      origin_location, unit_price, currency, incoterm, description, status
    ) values (
      ${esc(listingId)}, ${esc(SELLER)}, ${esc(CATEGORY)},
      ${esc(`SMOKE · A7-GATE · 50 MT`)},
      '{"fixed_carbon":"95%"}'::jsonb,
      50, 'MT', 'Toamasina', ${total / 50}, 'USDT', 'CFR',
      'A7 completion gate', 'active'
    );
  `);

  await q(`
    insert into public.inquiries (
      id, buyer_id, seller_id, listing_id, category_id,
      requested_qty, status
    ) values (
      ${esc(inquiryId)}, ${esc(BUYER)}, ${esc(SELLER)},
      ${esc(listingId)}, ${esc(CATEGORY)},
      50, 'converted'
    );
  `);

  const validity = new Date();
  validity.setDate(validity.getDate() + 14);
  await q(`
    insert into public.quotations (
      id, inquiry_id, seller_id, buyer_id, listing_id,
      unit_price, currency, quantity, unit, incoterm,
      validity_until, status, responded_at
    ) values (
      ${esc(quotationId)}, ${esc(inquiryId)}, ${esc(SELLER)}, ${esc(BUYER)},
      ${esc(listingId)}, ${total / 50}, 'USDT', 50, 'MT', 'CFR',
      ${esc(validity.toISOString())}, 'accepted', now()
    );
  `);

  await q(`
    insert into public.orders (
      id, order_no, buyer_id, seller_id, listing_id, inquiry_id,
      current_quotation_id, quantity, unit_price, total_amount,
      currency, destination, incoterm, status, timeline,
      customs_cleared_at, accepted_at
    ) values (
      ${esc(orderId)}, ${esc(orderNo)},
      ${esc(BUYER)}, ${esc(SELLER)},
      ${esc(listingId)}, ${esc(inquiryId)}, ${esc(quotationId)},
      50, ${total / 50}, ${total},
      'USDT', 'Macau', 'CFR', 'customs_cleared',
      '[{"event":"customs_cleared","at":"${new Date().toISOString()}","by":"${BUYER}"}]'::jsonb,
      now(), now()
    );
  `);

  const prepayId = randomUUID();
  const postId = randomUUID();
  await q(`
    insert into public.payment_schedules (
      id, order_id, sequence, category, milestone, percentage,
      amount, currency, status
    ) values
      (${esc(prepayId)}, ${esc(orderId)}, 0, 'prepayment', 'contract_signed', 30, 30000, 'USDT', 'paid'),
      (${esc(postId)}, ${esc(orderId)}, 1, 'postpayment', 'accepted_by_buyer', 70, 70000, 'USDT', 'scheduled');
  `);

  return { orderId, orderNo, prepayId, postId, total };
}

async function cleanupOrder(orderId) {
  await q(`delete from public.payments where order_id = ${esc(orderId)};`);
  await q(`delete from public.payment_schedules where order_id = ${esc(orderId)};`);
  await q(`delete from public.orders where id = ${esc(orderId)};`);
}

async function main() {
  console.log("=== A7 Scenario B — completion gate (30% paid / 70% unpaid) ===\n");
  const seeded = await seedOrder3070();

  try {
    const [{ status: s0 }] = await q(
      `select status from public.orders where id = ${esc(seeded.orderId)};`
    );
    check(s0 === "customs_cleared", "order starts at customs_cleared");

    const gate0 = await maybeAutoComplete(seeded.orderId, BUYER);
    check(gate0.skipped === true && !gate0.completed, "maybeAutoComplete skips when 70% unpaid");
    const [{ status: s1 }] = await q(
      `select status from public.orders where id = ${esc(seeded.orderId)};`
    );
    check(s1 === "customs_cleared", "still customs_cleared after gate (no premature completed)");

    // Pay final 70%
    await q(`
      update public.payment_schedules
         set status = 'paid'
       where id = ${esc(seeded.postId)};
    `);

    const gate1 = await maybeAutoComplete(seeded.orderId, SELLER);
    check(gate1.completed === true, "maybeAutoComplete completes when all schedules paid");
    const [{ status: s2 }] = await q(
      `select status from public.orders where id = ${esc(seeded.orderId)};`
    );
    check(s2 === "completed", "order status is completed");

    // Regression: wrong count pattern would have completed early
    const { count: unpaid } = await service
      .from("payment_schedules")
      .select("id", { count: "exact", head: true })
      .eq("order_id", seeded.orderId)
      .neq("status", "paid")
      .neq("status", "waived");
    check((unpaid ?? 0) === 0, "Supabase head count shows 0 unpaid schedules");
  } finally {
    if (CLEANUP) {
      await cleanupOrder(seeded.orderId);
      console.log("\n--- Cleanup: removed A7 gate test order ---");
    } else {
      console.log(`\nOrder: ${seeded.orderNo} (${seeded.orderId}) — pass --cleanup to delete`);
    }
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗ FATAL:", e.message);
  process.exit(2);
});
