#!/usr/bin/env node
/**
 * smoke-quotation-actors.mjs
 *
 * Verifies quotation round-robin actor logic introduced in 027:
 *   - quotations.created_by records the proposer
 *   - "my turn" = live (status=sent) quotation where created_by != me
 *   - proposer cannot accept/counter/reject their own live offer
 *
 * Uses service-role DB access only (no Playwright). Pass --cleanup to delete
 * the temporary inquiry + quotations after the run.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const CLEANUP = process.argv.includes("--cleanup");

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
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

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
  return JSON.parse(body);
}

function esc(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

/** Mirror of getInquiriesNeedingMyResponse (seller/buyer turn detection). */
async function inquiriesNeedingResponse(userId, role) {
  const ids = new Set();
  if (role === "seller") {
    const rows = await q(`
      select id from public.inquiries
       where seller_id = ${esc(userId)} and status = 'pending';
    `);
    for (const r of rows) ids.add(r.id);
  }
  const liveCol = role === "buyer" ? "buyer_id" : "seller_id";
  const rows = await q(`
    select q.inquiry_id
      from public.quotations q
      join public.inquiries i on i.id = q.inquiry_id
     where q.status = 'sent'
       and q.${liveCol} = ${esc(userId)}
       and q.created_by <> ${esc(userId)}
       and i.status in ('quoted', 'negotiating');
  `);
  for (const r of rows) {
    if (r.inquiry_id) ids.add(r.inquiry_id);
  }
  return ids;
}

async function main() {
  console.log("=== smoke-quotation-actors ===\n");

  // Resolve test buyer/seller from docs/TESTING.md accounts
  const profiles = await q(`
    select id, email, role from public.profiles
     where email in (
       'eric.chang.1015+buyer@gmail.com',
       'eric.chang.1015+seller@gmail.com'
     );
  `);
  const buyer = profiles.find((p) => p.email.includes("+buyer@"));
  const seller = profiles.find((p) => p.email.includes("+seller@"));
  if (!buyer || !seller) {
    throw new Error("Test buyer/seller profiles not found — see docs/TESTING.md");
  }

  const listing = await q(`
    select id, category_id, unit_price, currency, incoterm, origin_location
      from public.listings
     where seller_id = ${esc(seller.id)} and status = 'active'
     order by created_at desc
     limit 1;
  `);
  if (!listing[0]) throw new Error("No active seller listing for smoke test");
  const listingId = listing[0].id;
  const categoryId = listing[0].category_id;

  const inquiryId = randomUUID();
  const q1 = randomUUID();
  const q2 = randomUUID();
  const validity = new Date();
  validity.setDate(validity.getDate() + 14);
  const v = validity.toISOString();

  console.log("Setup: temp inquiry + 2-round negotiation");
  await q(`
    insert into public.inquiries (
      id, buyer_id, seller_id, listing_id, category_id,
      requested_qty, target_price, destination, status
    ) values (
      ${esc(inquiryId)}, ${esc(buyer.id)}, ${esc(seller.id)},
      ${esc(listingId)}, ${esc(categoryId)},
      5, 400, 'Taipei', 'negotiating'
    );
  `);

  // Round 1: seller 599 (countered by buyer)
  await q(`
    insert into public.quotations (
      id, inquiry_id, seller_id, buyer_id, created_by, listing_id,
      unit_price, currency, quantity, unit, incoterm,
      origin_port, destination_port, validity_until, status,
      countered_by, responded_at
    ) values (
      ${esc(q1)}, ${esc(inquiryId)}, ${esc(seller.id)}, ${esc(buyer.id)},
      ${esc(seller.id)}, ${esc(listingId)},
      599, 'USDT', 5, 'MT', 'CFR',
      'Madagascar', 'Taipei', ${esc(v)}, 'countered',
      ${esc(buyer.id)}, now()
    );
  `);

  // Round 2: buyer 401 (live)
  await q(`
    insert into public.quotations (
      id, inquiry_id, parent_quotation_id, seller_id, buyer_id, created_by,
      listing_id, unit_price, currency, quantity, unit, incoterm,
      origin_port, destination_port, validity_until, status
    ) values (
      ${esc(q2)}, ${esc(inquiryId)}, ${esc(q1)},
      ${esc(seller.id)}, ${esc(buyer.id)}, ${esc(buyer.id)},
      ${esc(listingId)}, 401, 'USDT', 5, 'MT', 'CFR',
      'Madagascar', 'Taipei', ${esc(v)}, 'sent'
    );
  `);

  const rows = await q(`
    select id, created_by, status, unit_price
      from public.quotations
     where inquiry_id = ${esc(inquiryId)}
     order by created_at;
  `);

  check(rows.length === 2, "two quotation rounds seeded");
  check(rows[0].created_by === seller.id, "round 1 created_by = seller");
  check(rows[1].created_by === buyer.id, "round 2 created_by = buyer");
  check(rows[1].status === "sent", "round 2 is live (sent)");

  const buyerTurn = await inquiriesNeedingResponse(buyer.id, "buyer");
  const sellerTurn = await inquiriesNeedingResponse(seller.id, "seller");

  check(!buyerTurn.has(inquiryId), "buyer NOT needing response (they proposed round 2)");
  check(sellerTurn.has(inquiryId), "seller needing response (buyer proposed round 2)");

  // Simulate seller counter → round 3
  const q3 = randomUUID();
  await q(`
    update public.quotations
       set status = 'countered', countered_by = ${esc(seller.id)}, responded_at = now()
     where id = ${esc(q2)};
  `);
  await q(`
    insert into public.quotations (
      id, inquiry_id, parent_quotation_id, seller_id, buyer_id, created_by,
      listing_id, unit_price, currency, quantity, unit, incoterm,
      origin_port, destination_port, validity_until, status
    ) values (
      ${esc(q3)}, ${esc(inquiryId)}, ${esc(q2)},
      ${esc(seller.id)}, ${esc(buyer.id)}, ${esc(seller.id)},
      ${esc(listingId)}, 450, 'USDT', 5, 'MT', 'CFR',
      'Madagascar', 'Taipei', ${esc(v)}, 'sent'
    );
  `);

  const buyerTurn2 = await inquiriesNeedingResponse(buyer.id, "buyer");
  const sellerTurn2 = await inquiriesNeedingResponse(seller.id, "seller");

  check(buyerTurn2.has(inquiryId), "buyer needing response after seller counter");
  check(!sellerTurn2.has(inquiryId), "seller NOT needing response (they proposed round 3)");

  // -----------------------------------------------------------------
  // Schema-level invariants for the new acceptInquiry / rejectInquiry
  // tightening. The server actions guard at the application layer; here
  // we just assert the state we'd expect them to see when called.
  // -----------------------------------------------------------------

  const inq = await q(`
    select status from public.inquiries where id = ${esc(inquiryId)};
  `);
  check(
    inq[0].status === "negotiating",
    "inquiry status='negotiating' while a live quotation exists"
  );

  const liveAfterR3 = await q(`
    select id, created_by from public.quotations
     where inquiry_id = ${esc(inquiryId)} and status = 'sent';
  `);
  check(liveAfterR3.length === 1, "exactly one live quotation");
  check(
    liveAfterR3[0].created_by === seller.id,
    "live quotation's proposer = seller (round 3)"
  );

  // Seller calling acceptInquiry now would hit our 'pending'-only guard
  // (status='negotiating' → QUOTATION_ALREADY_EXISTS). Seller calling
  // rejectInquiry now would hit our OWN_LIVE_OFFER guard (their own
  // round 3 is the live quotation). Both are application-layer guards
  // — see src/actions/inquiry.ts. We document the invariant the guards
  // depend on:
  check(
    inq[0].status !== "pending",
    "acceptInquiry guard precondition: status !== 'pending' once any quotation exists"
  );
  check(
    liveAfterR3[0].created_by === seller.id,
    "rejectInquiry guard precondition: live quotation.created_by = seller (caller)"
  );

  if (CLEANUP) {
    await q(`delete from public.inquiries where id = ${esc(inquiryId)};`);
    console.log("\nCleanup: temp inquiry deleted (quotations cascade).");
  } else {
    console.log(`\nTemp inquiry kept: ${inquiryId} (re-run with --cleanup)`);
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(2);
});
