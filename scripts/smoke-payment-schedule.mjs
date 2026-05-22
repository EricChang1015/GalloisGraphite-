#!/usr/bin/env node
// =====================================================================
// Smoke test for the decoupled payment timeline (013/014 migration +
// payment_schedules pipeline). Drives three end-to-end scenarios:
//
//   1) FOB · 30% prepay (contract_signed) / 70% post (bl_date+30)
//   2) CFR · 30 prepay / 40 regular (loaded_onto_vessel) /
//      30 post (arrived_at_port)
//   3) CIF · 100% prepay (contract_signed)
//
// Each scenario walks the lifecycle:
//   contract_signed -> in_production -> ready_to_ship -> shipped ->
//   in_transit -> arrived -> customs_cleared
// while in parallel firing the matching milestone triggers, then has
// the buyer "submit" and the admin "verify" each schedule, finally
// ensuring the order can move to `completed`.
//
// The test mutates DB rows directly via the Supabase Management API
// (Postgres SQL) to mimic exactly what our server actions do, without
// requiring a running Next.js server. Pass/fail is logged per step.
//
// Usage:
//   node scripts/smoke-payment-schedule.mjs            # run + leave data
//   node scripts/smoke-payment-schedule.mjs --cleanup  # remove rows after
// =====================================================================
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);

const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !url) {
  console.error("✗ Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(2);
}
const ref = new URL(url).hostname.split(".")[0];

const CLEANUP = process.argv.includes("--cleanup");

async function q(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return body ? JSON.parse(body) : [];
}

function escape(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ---------- Test fixtures --------------------------------------------
const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd"; // +seller@
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc"; // +buyer@
const ADMIN = SELLER; // anyone with a uuid; we don't enforce admin role at SQL layer
// Same UUID as before; migration 022 renamed it to "Flake Graphite +100 Mesh".
const CATEGORY = "1f135ab2-7017-433d-95f6-247ee5278c86"; // Flake Graphite +100 Mesh

// Track created order IDs so --cleanup can remove them
const createdOrderIds = [];

let pass = 0;
let fail = 0;
function check(cond, label, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function createScenarioOrder({ tag, incoterm, totalAmount }) {
  const listingId = randomUUID();
  const inquiryId = randomUUID();
  const quotationId = randomUUID();
  const orderId = randomUUID();
  createdOrderIds.push(orderId);

  const validity = new Date();
  validity.setDate(validity.getDate() + 14);
  const orderNo = `ORD-SMOKE-${tag}-${Date.now().toString(36).toUpperCase()}`;

  // listing
  await q(`
    insert into public.listings (
      id, seller_id, category_id, title, specs, quantity, unit,
      origin_location, unit_price, currency, incoterm, description, status
    ) values (
      ${escape(listingId)}, ${escape(SELLER)}, ${escape(CATEGORY)},
      ${escape(`SMOKE · ${tag} · 50 MT`)},
      '{"fixed_carbon":"95-97%"}'::jsonb,
      50, 'MT', 'Toamasina, Madagascar',
      ${totalAmount / 50}, 'USDT', ${escape(incoterm)},
      'Smoke test listing', 'active'
    );
  `);

  // inquiry
  await q(`
    insert into public.inquiries (
      id, buyer_id, seller_id, listing_id, category_id,
      requested_qty, target_price, destination, message, status
    ) values (
      ${escape(inquiryId)}, ${escape(BUYER)}, ${escape(SELLER)},
      ${escape(listingId)}, ${escape(CATEGORY)},
      50, ${totalAmount / 50}, 'Macau Port',
      'Smoke test inquiry', 'quoted'
    );
  `);

  // quotation
  await q(`
    insert into public.quotations (
      id, inquiry_id, seller_id, buyer_id, listing_id,
      unit_price, currency, quantity, unit, incoterm,
      origin_port, destination_port, validity_until, status,
      responded_at, countered_by
    ) values (
      ${escape(quotationId)}, ${escape(inquiryId)}, ${escape(SELLER)},
      ${escape(BUYER)}, ${escape(listingId)},
      ${totalAmount / 50}, 'USDT', 50, 'MT', ${escape(incoterm)},
      'Toamasina', 'Macau Port',
      ${escape(validity.toISOString())}, 'accepted', now(), ${escape(BUYER)}
    );
  `);

  // order — start at contract_signed; incoterm captured snapshot-style
  await q(`
    insert into public.orders (
      id, order_no, buyer_id, seller_id, listing_id, inquiry_id,
      current_quotation_id, quantity, unit_price, total_amount,
      currency, destination, incoterm, status, timeline
    ) values (
      ${escape(orderId)},
      ${escape(orderNo)},
      ${escape(BUYER)}, ${escape(SELLER)},
      ${escape(listingId)}, ${escape(inquiryId)}, ${escape(quotationId)},
      50, ${totalAmount / 50}, ${totalAmount},
      'USDT', 'Macau Port', ${escape(incoterm)},
      'contract_signed',
      '[{"event":"contract_signed","at":"${new Date().toISOString()}","by":"${BUYER}"}]'::jsonb
    );
  `);

  return { orderId, totalAmount, incoterm, tag };
}

async function buildSchedules(order, schedule) {
  // schedule: [{ sequence, category, milestone, percentage, bl_offset_days? }]
  for (const row of schedule) {
    const amount = (order.totalAmount * Number(row.percentage)) / 100;
    await q(`
      insert into public.payment_schedules (
        order_id, sequence, category, milestone, percentage,
        amount, currency, bl_offset_days, status
      ) values (
        ${escape(order.orderId)}, ${row.sequence}, ${escape(row.category)},
        ${escape(row.milestone)}, ${row.percentage},
        ${amount}, 'USDT',
        ${row.bl_offset_days == null ? "null" : row.bl_offset_days},
        'scheduled'
      );
    `);
  }
  const [{ sum }] = await q(`
    select coalesce(sum(percentage), 0)::numeric as sum
      from public.payment_schedules
     where order_id = ${escape(order.orderId)};
  `);
  check(Number(sum) === 100, `[${order.tag}] schedule percentages sum to 100`, `got ${sum}`);
}

async function triggerMilestone(order, milestone, opts = {}) {
  // mimic actions/order.ts triggerMilestone(): scheduled -> due
  // and (for B/L offsets) backfill due_date = bl_date + N
  let setClause = `status = 'due'`;
  if (opts.dueDate) setClause += `, due_date = ${escape(opts.dueDate)}`;
  const result = await q(`
    update public.payment_schedules
       set ${setClause}
     where order_id = ${escape(order.orderId)}
       and milestone = ${escape(milestone)}
       and status = 'scheduled'
   returning id, status, due_date;
  `);
  return result;
}

async function submitPayment(order, scheduleId, amount) {
  // mimic actions/payment.ts submitPayment(): create payment, set schedule -> awaiting_review
  const paymentId = randomUUID();
  await q(`
    insert into public.payments (
      id, order_id, buyer_id, schedule_id, amount, currency,
      method, status, tx_hash
    ) values (
      ${escape(paymentId)}, ${escape(order.orderId)}, ${escape(BUYER)},
      ${escape(scheduleId)}, ${amount}, 'USDT',
      'usdt_trc20', 'pending', '0xsmoke${randomUUID().slice(0, 6)}'
    );
  `);
  await q(`
    update public.payment_schedules
       set status = 'awaiting_review'
     where id = ${escape(scheduleId)};
  `);
  return paymentId;
}

async function verifyPayment(order, scheduleId, paymentId) {
  // mimic actions/payment.ts verifyPayment(): payment verified + schedule paid
  await q(`
    update public.payments
       set status = 'verified', reviewed_at = now(), reviewed_by = ${escape(ADMIN)}
     where id = ${escape(paymentId)};
  `);
  await q(`
    update public.payment_schedules
       set status = 'paid', paid_payment_id = ${escape(paymentId)}
     where id = ${escape(scheduleId)};
  `);
}

async function advance(order, to) {
  await q(`
    update public.orders
       set status = ${escape(to)}
     where id = ${escape(order.orderId)};
  `);
}

async function settleSchedulesAt(order, milestone, expectedCount, opts = {}) {
  const rows = await triggerMilestone(order, milestone, opts);
  check(
    rows.length === expectedCount,
    `[${order.tag}] triggerMilestone(${milestone}) flipped ${expectedCount} schedule(s)`,
    `got ${rows.length}`
  );
  for (const row of rows) {
    const [{ amount, status }] = await q(`
      select amount, status from public.payment_schedules where id = ${escape(row.id)};
    `);
    check(status === "due", `[${order.tag}] schedule ${milestone} is due`);
    const paymentId = await submitPayment(order, row.id, amount);
    const [{ status: awaiting }] = await q(`
      select status from public.payment_schedules where id = ${escape(row.id)};
    `);
    check(awaiting === "awaiting_review", `[${order.tag}] schedule ${milestone} awaiting_review after submit`);
    await verifyPayment(order, row.id, paymentId);
    const [{ status: paid, paid_payment_id }] = await q(`
      select status, paid_payment_id from public.payment_schedules where id = ${escape(row.id)};
    `);
    check(
      paid === "paid" && paid_payment_id === paymentId,
      `[${order.tag}] schedule ${milestone} paid + linked to payment`
    );
  }
}

async function runScenario(opts) {
  console.log(`\n=== ${opts.tag} · ${opts.incoterm} · total ${opts.totalAmount} USDT ===`);

  const order = await createScenarioOrder(opts);
  await buildSchedules(order, opts.schedule);

  // Step 1: contract_signed milestones (paid right away if any prepayment uses that)
  await settleSchedulesAt(order, "contract_signed", opts.schedule.filter((s) => s.milestone === "contract_signed").length);

  // Step 2: in_production
  await advance(order, "in_production");
  await settleSchedulesAt(order, "before_production", opts.schedule.filter((s) => s.milestone === "before_production").length);

  // Step 3: ready_to_ship
  await advance(order, "ready_to_ship");
  await settleSchedulesAt(order, "before_shipment", opts.schedule.filter((s) => s.milestone === "before_shipment").length);

  // Step 4: shipped — set bl_date so we can backfill bl_date_plus_N
  const blDate = new Date();
  blDate.setDate(blDate.getDate() - 1);
  const blDateStr = blDate.toISOString().slice(0, 10);
  await q(`
    update public.orders
       set status = 'shipped',
           atd = current_date,
           bl_date = ${escape(blDateStr)},
           loaded_at = now()
     where id = ${escape(order.orderId)};
  `);
  await settleSchedulesAt(
    order,
    "loaded_onto_vessel",
    opts.schedule.filter((s) => s.milestone === "loaded_onto_vessel").length
  );

  // Step 5: in_transit
  await advance(order, "in_transit");

  // Step 6: arrived
  await q(`update public.orders set status = 'arrived', ata = current_date where id = ${escape(order.orderId)};`);
  await settleSchedulesAt(
    order,
    "arrived_at_port",
    opts.schedule.filter((s) => s.milestone === "arrived_at_port").length
  );

  // Step 7: customs_cleared + accepted_by_buyer milestone
  await advance(order, "customs_cleared");
  await settleSchedulesAt(
    order,
    "accepted_by_buyer",
    opts.schedule.filter((s) => s.milestone === "accepted_by_buyer").length
  );

  // Step 8: bl_date_plus_N postpayments (backfill due_date then settle)
  for (const row of opts.schedule.filter((s) =>
    ["bl_date_plus_30", "bl_date_plus_60", "bl_date_plus_90"].includes(s.milestone)
  )) {
    const due = new Date(blDate);
    due.setDate(due.getDate() + (row.bl_offset_days ?? 30));
    const dueStr = due.toISOString().slice(0, 10);
    await settleSchedulesAt(order, row.milestone, 1, { dueDate: dueStr });
  }

  // Final assertion: all schedules paid + order eligible to complete
  const [{ count: unpaid }] = await q(`
    select count(*)::int as count
      from public.payment_schedules
     where order_id = ${escape(order.orderId)}
       and status <> 'paid';
  `);
  check(unpaid === 0, `[${order.tag}] all schedules paid`, `${unpaid} still unpaid`);

  await advance(order, "completed");
  const [{ status }] = await q(`select status from public.orders where id = ${escape(order.orderId)};`);
  check(status === "completed", `[${order.tag}] order reached completed`);
}

// ---------- Validator-level checks (mirror Zod refinements in TS) -----
function localValidatorChecks() {
  console.log("\n=== Validator refinements (mirroring Zod) ===");

  const sum = (entries) => entries.reduce((a, e) => a + e.percentage, 0);
  check(sum([{ percentage: 30 }, { percentage: 70 }]) === 100, "30/70 sums to 100");
  check(
    Math.abs(sum([{ percentage: 30 }, { percentage: 40 }, { percentage: 30 }]) - 100) < 0.01,
    "30/40/30 sums to 100"
  );
  check(sum([{ percentage: 100 }]) === 100, "100 sums to 100");
  check(sum([{ percentage: 50 }, { percentage: 40 }]) !== 100, "50/40 (=90) does NOT equal 100");

  const fobRegular = ["loaded_onto_vessel", "bl_received"];
  const cifRegular = ["loaded_onto_vessel", "bl_plus_insurance_received"];
  check(!fobRegular.includes("shipping_docs_received"), "FOB rejects shipping_docs_received");
  check(!cifRegular.includes("bl_received"), "CIF rejects bl_received");
  check(cifRegular.includes("bl_plus_insurance_received"), "CIF accepts bl_plus_insurance_received");
}

// ---------- Scenarios -------------------------------------------------
async function main() {
  localValidatorChecks();

  try {
    await runScenario({
      tag: "FOB-30-70",
      incoterm: "FOB",
      totalAmount: 215_000,
      schedule: [
        { sequence: 0, category: "prepayment", milestone: "contract_signed", percentage: 30 },
        { sequence: 1, category: "postpayment", milestone: "bl_date_plus_30", percentage: 70, bl_offset_days: 30 },
      ],
    });

    await runScenario({
      tag: "CFR-30-40-30",
      incoterm: "CFR",
      totalAmount: 240_000,
      schedule: [
        { sequence: 0, category: "prepayment", milestone: "contract_signed", percentage: 30 },
        { sequence: 1, category: "regular_payment", milestone: "loaded_onto_vessel", percentage: 40 },
        { sequence: 2, category: "postpayment", milestone: "arrived_at_port", percentage: 30 },
      ],
    });

    await runScenario({
      tag: "CIF-100-prepay",
      incoterm: "CIF",
      totalAmount: 180_000,
      schedule: [
        { sequence: 0, category: "prepayment", milestone: "contract_signed", percentage: 100 },
      ],
    });
  } finally {
    if (CLEANUP) {
      console.log("\n--- Cleanup ---");
      for (const id of createdOrderIds) {
        await q(`delete from public.payments where order_id = ${escape(id)};`);
        await q(`delete from public.payment_schedules where order_id = ${escape(id)};`);
        await q(`delete from public.orders where id = ${escape(id)};`);
      }
      console.log(`✓ removed ${createdOrderIds.length} order(s) and their dependents`);
    } else if (createdOrderIds.length) {
      console.log("\n(Use --cleanup to delete the seeded smoke orders.)");
      for (const id of createdOrderIds) {
        console.log(`  http://localhost:3000/orders/${id}`);
      }
    }
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("✗ FATAL:", err.message);
  process.exit(2);
});
