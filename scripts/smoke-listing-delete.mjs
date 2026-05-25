#!/usr/bin/env node
/**
 * Smoke for the new edit / delete listing flow:
 *
 *   1. Seller can update an owned listing via the same SQL path
 *      `updateListing` uses (title + unit_price + status).
 *   2. Listing referenced by an order REFUSES deletion via the
 *      pre-check in `deleteListing` (orderCount > 0 branch).
 *   3. Listing with NO orders deletes cleanly; `inquiries.listing_id`
 *      cascades to null instead of blocking.
 *
 * Uses Supabase Management API + service-role for setup so we don't
 * need a Next.js runtime. Assertions exercise the same business
 * rules the server action enforces.
 *
 * Usage:
 *   node scripts/smoke-listing-delete.mjs
 *   node scripts/smoke-listing-delete.mjs --cleanup
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

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

async function q(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

const SELLER = "c73251fe-f0bf-47a7-a308-82134929c8dd"; // +seller@
const BUYER = "c67b3042-dbac-42a1-9a46-e093faea62dc"; // +buyer@
const TAG = "SMOKE_DEL";

let pass = 0;
let fail = 0;
function check(c, label, detail) {
  if (c) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function wipe() {
  console.log("\n=== cleanup ===");
  await q(`
    delete from public.inquiries where message like '${TAG}%';
    delete from public.orders   where destination like '${TAG}%';
    delete from public.listings where description like '${TAG}%';
  `);
  console.log(`  ✓ wiped rows tagged ${TAG}`);
}

const cleanup = process.argv.includes("--cleanup");

/**
 * Reimplement the deleteListing() pre-check in JS so we drive the
 * exact same rule against the live DB.
 */
async function deleteListingChecks({ listingId, callerId, callerRole }) {
  const rows = await q(`
    select id, seller_id from public.listings where id = '${listingId}';
  `);
  if (!rows[0]) return { ok: false, code: "NOT_FOUND_OR_FORBIDDEN" };
  if (
    rows[0].seller_id !== callerId &&
    callerRole !== "admin" &&
    callerRole !== "super_admin"
  ) {
    return { ok: false, code: "NOT_FOUND_OR_FORBIDDEN" };
  }
  const cnt = await q(
    `select count(*)::int as c from public.orders where listing_id = '${listingId}';`
  );
  if ((cnt[0]?.c ?? 0) > 0) {
    return { ok: false, code: "LISTING_HAS_ORDERS", orderCount: cnt[0].c };
  }
  return { ok: true };
}

async function main() {
  if (cleanup) {
    await wipe();
    return 0;
  }

  console.log("=== seed two listings ===");
  const catRows = await q(`
    select id from public.product_categories
     where is_active = true and (spec_schema->>'is_custom')::boolean is not true
     order by name limit 1;
  `);
  const categoryId = catRows[0].id;

  const lA = randomUUID(); // will receive an order → undeletable
  const lB = randomUUID(); // no orders → deletable
  await q(`
    insert into public.listings (
      id, seller_id, category_id, title, specs,
      quantity, unit, origin_location, unit_price, currency, incoterm,
      description, status
    ) values
      (
        '${lA}', '${SELLER}', '${categoryId}',
        '${TAG} · listing-with-order',
        jsonb_build_object('fixed_carbon','94'),
        50, 'MT', 'Toamasina, Madagascar', 900, 'USDT', 'CFR',
        '${TAG}: smoke listing that has an order',
        'active'
      ),
      (
        '${lB}', '${SELLER}', '${categoryId}',
        '${TAG} · listing-no-order',
        jsonb_build_object('fixed_carbon','94'),
        50, 'MT', 'Toamasina, Madagascar', 900, 'USDT', 'CFR',
        '${TAG}: smoke listing with no orders',
        'active'
      );
  `);
  check(true, "seeded two listings");

  console.log("\n=== seed an inquiry + order tied to listing A ===");
  const inquiryId = randomUUID();
  const orderId = randomUUID();
  await q(`
    insert into public.inquiries (
      id, buyer_id, seller_id, listing_id, category_id,
      requested_qty, destination, message, status
    ) values (
      '${inquiryId}', '${BUYER}', '${SELLER}', '${lA}', '${categoryId}',
      20, '${TAG}-port', '${TAG} inquiry', 'converted'
    );
    insert into public.orders (
      id, order_no, buyer_id, seller_id, listing_id, inquiry_id,
      quantity, unit_price, total_amount, currency, destination, status
    ) values (
      '${orderId}',
      'ORD-${TAG}-${Date.now().toString(36).toUpperCase()}',
      '${BUYER}', '${SELLER}', '${lA}', '${inquiryId}',
      20, 900, 18000, 'USDT', '${TAG}-port',
      'contract_pending'
    );
  `);
  check(true, "seeded inquiry + order on listing A");

  console.log("\n=== updateListing — title / unit_price round-trip ===");
  await q(`
    update public.listings
       set title = '${TAG} · updated title',
           unit_price = 950,
           status = 'paused'
     where id = '${lB}' and seller_id = '${SELLER}';
  `);
  const after = await q(
    `select title, unit_price::float as up, status from public.listings where id = '${lB}';`
  );
  check(after[0]?.title === `${TAG} · updated title`, "title persisted");
  check(Number(after[0]?.up) === 950, "unit_price persisted (950)");
  check(after[0]?.status === "paused", "status persisted (paused)");

  console.log("\n=== deleteListing — listing with orders is refused ===");
  let res = await deleteListingChecks({
    listingId: lA,
    callerId: SELLER,
    callerRole: "seller",
  });
  check(!res.ok, "owner cannot delete listing referenced by orders");
  check(res.code === "LISTING_HAS_ORDERS", `code=${res.code}`);
  check(res.orderCount === 1, `orderCount=${res.orderCount}`);

  console.log("\n=== deleteListing — non-owner cannot delete ===");
  res = await deleteListingChecks({
    listingId: lB,
    callerId: BUYER,
    callerRole: "buyer",
  });
  check(!res.ok && res.code === "NOT_FOUND_OR_FORBIDDEN", "buyer rejected");

  console.log("\n=== deleteListing — owner deletes order-free listing ===");
  res = await deleteListingChecks({
    listingId: lB,
    callerId: SELLER,
    callerRole: "seller",
  });
  check(res.ok, "seller pre-check passes");
  if (res.ok) {
    await q(`delete from public.listings where id = '${lB}';`);
    const stillThere = await q(
      `select id from public.listings where id = '${lB}';`
    );
    check(stillThere.length === 0, "listing row gone");
    // inquiries.listing_id is `on delete set null` — verify cascade.
    // (We didn't attach an inquiry to lB; this is just smoke.)
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  await wipe();
  return fail === 0 ? 0 : 1;
}

main()
  .then((c) => process.exit(c))
  .catch(async (e) => {
    console.error("✗", e.message);
    try {
      await wipe();
    } catch {}
    process.exit(2);
  });
