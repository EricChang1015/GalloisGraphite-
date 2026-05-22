#!/usr/bin/env node
/**
 * Smoke test for the listings.min_order_quantity (023) flow.
 *
 * Drives, end-to-end against the live Supabase project:
 *
 *   1. Seed a listing with min_order_quantity = 10 MT (cleaned at end).
 *   2. Insert an inquiry with requested_qty = 5 → expect server-side
 *      to reject *before* the row hits the DB. (We mimic the
 *      createInquiry guard by replaying the same SQL select + branch
 *      logic, since hitting the Server Action requires a Next.js
 *      runtime + cookies. The point is to assert the DB shape works
 *      and an end-to-end "buyer < MOQ" branch is exercised.)
 *   3. Insert an inquiry with requested_qty = 10 → expect success.
 *   4. Insert an inquiry with requested_qty = 25 → expect success.
 *
 * Usage:
 *   node scripts/smoke-listing-moq.mjs
 *   node scripts/smoke-listing-moq.mjs --cleanup    # delete the seeded rows
 *
 * Exit code:
 *   0 on success
 *   1 on any assertion failure (the script also rolls back its rows
 *     before exiting non-zero).
 */
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

/**
 * Mimic the createInquiry MOQ guard in JS so we can validate the DB
 * shape + business rule without a running Next.js server.
 */
function guardMOQ(listing, requestedQty) {
  if (listing.status !== "active") {
    return { ok: false, code: "LISTING_INACTIVE" };
  }
  if (
    listing.min_order_quantity != null &&
    requestedQty < listing.min_order_quantity
  ) {
    return {
      ok: false,
      code: "BELOW_MOQ",
      message: `Minimum order is ${listing.min_order_quantity} ${listing.unit} for this listing.`,
    };
  }
  return { ok: true };
}

const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd"; // test +seller@
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc"; // test +buyer@
const TAG = "SMOKE_MOQ";

const cleanup = process.argv.includes("--cleanup");

async function cleanupRows() {
  console.log("\n=== cleanup ===");
  await q(`
    delete from public.inquiries where message like '${TAG}%';
    delete from public.listings where description like '${TAG}%';
  `);
  console.log(`  ✓ wiped rows tagged ${TAG}`);
}

async function main() {
  if (cleanup) {
    await cleanupRows();
    process.exit(0);
  }

  console.log("=== seed listing with MOQ=10 ===");
  // Find an active flake-graphite category to attach to.
  const catRows = await q(`
    select id, name from public.product_categories
     where is_active = true
       and coalesce((spec_schema->>'is_custom')::boolean, false) = false
     order by name
     limit 1;
  `);
  if (catRows.length === 0) {
    console.error("No active flake graphite category found — cannot smoke MOQ.");
    process.exit(2);
  }
  const categoryId = catRows[0].id;
  console.log(`  category: ${catRows[0].name} (${categoryId})`);

  const listingId = randomUUID();
  await q(`
    insert into public.listings (
      id, seller_id, category_id, title, specs,
      quantity, min_order_quantity, unit,
      origin_location, unit_price, currency, incoterm,
      description, status
    ) values (
      '${listingId}', '${SELLER}', '${categoryId}',
      '${TAG} · MOQ smoke listing',
      jsonb_build_object('fixed_carbon', '94'),
      100, 10, 'MT',
      'Toamasina, Madagascar', 900, 'USDT', 'CFR',
      '${TAG}: temporary listing for smoke-listing-moq.mjs',
      'active'
    );
  `);

  const listingRows = await q(`
    select min_order_quantity, unit, status
      from public.listings where id = '${listingId}';
  `);
  const listing = listingRows[0];
  check(
    Number(listing.min_order_quantity) === 10,
    `listing.min_order_quantity = 10 (got ${listing.min_order_quantity})`
  );
  check(listing.status === "active", `listing.status = 'active'`);

  console.log("\n=== branch: requested_qty=5 (below MOQ) ===");
  {
    const guard = guardMOQ(listing, 5);
    check(!guard.ok, "guard says NOT OK", JSON.stringify(guard));
    check(guard.code === "BELOW_MOQ", `code is BELOW_MOQ (got ${guard.code})`);
    check(
      typeof guard.message === "string" && guard.message.includes("10"),
      "message mentions the MOQ floor"
    );
    // Sanity: the underlying DB still rejects a manually-crafted
    // inquiry below MOQ if we asserted the same check before insert.
    // (Database doesn't enforce MOQ; the server action does.)
  }

  console.log("\n=== branch: requested_qty=10 (== MOQ) ===");
  {
    const guard = guardMOQ(listing, 10);
    check(guard.ok, "guard says OK at MOQ");
    const inquiryId = randomUUID();
    await q(`
      insert into public.inquiries (
        id, buyer_id, seller_id, listing_id, category_id,
        requested_qty, destination, message, status
      ) values (
        '${inquiryId}', '${BUYER}', '${SELLER}', '${listingId}', '${categoryId}',
        10, 'Rotterdam, NL', '${TAG} eq-MOQ inquiry', 'pending'
      );
    `);
    const inq = await q(
      `select id, requested_qty from public.inquiries where id = '${inquiryId}';`
    );
    check(
      inq.length === 1 && Number(inq[0].requested_qty) === 10,
      "inquiry row created with requested_qty=10"
    );
  }

  console.log("\n=== branch: requested_qty=25 (> MOQ) ===");
  {
    const guard = guardMOQ(listing, 25);
    check(guard.ok, "guard says OK above MOQ");
    const inquiryId = randomUUID();
    await q(`
      insert into public.inquiries (
        id, buyer_id, seller_id, listing_id, category_id,
        requested_qty, destination, message, status
      ) values (
        '${inquiryId}', '${BUYER}', '${SELLER}', '${listingId}', '${categoryId}',
        25, 'Hamburg, DE', '${TAG} above-MOQ inquiry', 'pending'
      );
    `);
    const inq = await q(
      `select id, requested_qty from public.inquiries where id = '${inquiryId}';`
    );
    check(
      inq.length === 1 && Number(inq[0].requested_qty) === 25,
      "inquiry row created with requested_qty=25"
    );
  }

  console.log("\n=== negative: invalid constraint check (DB layer) ===");
  // The DB enforces `min_order_quantity > 0`; setting 0 should fail.
  let dbConstraintRejected = false;
  try {
    await q(`
      update public.listings
         set min_order_quantity = 0
       where id = '${listingId}';
    `);
  } catch (err) {
    dbConstraintRejected = String(err).includes(
      "listings_min_order_quantity_positive"
    );
  }
  check(
    dbConstraintRejected,
    "DB check constraint rejects min_order_quantity = 0"
  );

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  await cleanupRows();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("✗", err.message);
  try {
    await cleanupRows();
  } catch {}
  process.exit(2);
});
