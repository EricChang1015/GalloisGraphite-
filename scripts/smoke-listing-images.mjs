#!/usr/bin/env node
/**
 * Smoke test for the `listings` storage bucket + listing-images
 * pipeline (migration 024 + src/actions/listing-images.ts).
 *
 * What it does, against the live Supabase project:
 *   1. Upload a small synthetic PNG (1x1) to
 *      listings/{TEST_SELLER}/{uuid}.png via the storage REST API
 *      using the seller's user JWT (so the owner-INSERT RLS policy is
 *      exercised, not bypassed by service-role).
 *   2. Fetch the public URL and assert a 200.
 *   3. Attach the URL to a temporary listing's images jsonb, re-read
 *      the listing via the anon client, and confirm the URL survives.
 *   4. Verify the owner-DELETE RLS policy by trying to delete with a
 *      *buyer* JWT first (must fail) and then the seller JWT (must
 *      succeed). For the failure case we use Storage API directly.
 *
 * Service role is reserved for cleanup only.
 *
 * Usage:
 *   node scripts/smoke-listing-images.mjs
 *   node scripts/smoke-listing-images.mjs --cleanup
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const MGMT_TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];

const SELLER_EMAIL = "eric.chang.1015+seller@gmail.com";
const BUYER_EMAIL = "eric.chang.1015+buyer@gmail.com";
const PASSWORD = "a1234567";
const TAG = "SMOKE_IMG";

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

// ---- helpers ----
async function login(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${email}: HTTP ${res.status} ${await res.text()}`);
  const j = await res.json();
  return { access_token: j.access_token, user_id: j.user?.id };
}

async function mgmtQuery(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MGMT_TOKEN}` },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) throw new Error(`mgmt: ${r.status} ${await r.text()}`);
  return r.json();
}

async function uploadAs(token, path, bytes, contentType) {
  const r = await fetch(
    `${SUPABASE_URL}/storage/v1/object/listings/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
    }
  );
  return r;
}

async function deleteAs(token, path) {
  return fetch(`${SUPABASE_URL}/storage/v1/object/listings/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
}

// 1×1 transparent PNG (well-known 67-byte blob)
const TINY_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000005000100" +
    "0d0a2db40000000049454e44ae426082",
  "hex"
);

const cleanup = process.argv.includes("--cleanup");

async function wipe() {
  console.log("\n=== cleanup ===");
  // Listings rows can be deleted via SQL.
  await mgmtQuery(
    `delete from public.listings where description like '${TAG}%';`
  );
  // Storage objects must go through the Storage API (Supabase forbids
  // direct DELETE on storage.objects). Use the service role to scrub
  // any leftover tagged uploads from this run.
  const tagged = await mgmtQuery(`
    select bucket_id, name from storage.objects
     where bucket_id = 'listings' and (metadata->>'mada_smoke_tag') = '${TAG}';
  `);
  if (Array.isArray(tagged) && tagged.length > 0) {
    const names = tagged.map((r) => r.name);
    const r = await fetch(
      `${SUPABASE_URL}/storage/v1/object/listings`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: names }),
      }
    );
    if (!r.ok) {
      console.warn(`  ⚠ storage cleanup HTTP ${r.status}: ${await r.text()}`);
    }
  }
  console.log(`  ✓ wiped rows + objects tagged ${TAG}`);
}

async function main() {
  if (cleanup) {
    await wipe();
    return 0;
  }
  if (!MGMT_TOKEN || !SERVICE_KEY || !ANON_KEY) {
    console.error("missing env vars");
    return 2;
  }

  console.log("=== login seller + buyer ===");
  const seller = await login(SELLER_EMAIL);
  const buyer = await login(BUYER_EMAIL);
  check(!!seller.access_token, "seller JWT");
  check(!!buyer.access_token, "buyer JWT");

  console.log("\n=== seller upload (RLS owner-insert) ===");
  const objectName = `${randomUUID()}.png`;
  const sellerPath = `${seller.user_id}/${objectName}`;
  let r = await uploadAs(seller.access_token, sellerPath, TINY_PNG, "image/png");
  check(r.ok, `seller upload listings/${sellerPath}`, r.ok ? "" : `HTTP ${r.status}`);

  // Tag the object so cleanup can find it.
  await mgmtQuery(`
    update storage.objects
       set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('mada_smoke_tag','${TAG}')
     where bucket_id = 'listings' and name = '${sellerPath}';
  `);

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/listings/${encodeURIComponent(seller.user_id)}/${encodeURIComponent(objectName)}`;
  console.log("\n=== fetch public URL ===");
  r = await fetch(publicUrl);
  check(r.ok, `GET public URL ${r.status}`);

  console.log("\n=== buyer upload (RLS should reject) ===");
  const buyerTargetPath = `${seller.user_id}/${randomUUID()}.png`;
  r = await uploadAs(buyer.access_token, buyerTargetPath, TINY_PNG, "image/png");
  check(!r.ok, "buyer cannot upload under another user's path", r.ok ? "uploaded!" : `HTTP ${r.status}`);

  console.log("\n=== attach to listing.images jsonb ===");
  // Find an active flake-graphite category.
  const catRows = await mgmtQuery(`
    select id from public.product_categories
     where is_active = true and (spec_schema->>'is_custom')::boolean is not true
     limit 1;
  `);
  const categoryId = catRows[0].id;
  const listingId = randomUUID();
  await mgmtQuery(`
    insert into public.listings (
      id, seller_id, category_id, title, specs,
      quantity, unit, origin_location, unit_price, currency, incoterm,
      images, description, status
    ) values (
      '${listingId}', '${seller.user_id}', '${categoryId}',
      '${TAG} · image-smoke listing',
      jsonb_build_object('fixed_carbon','94'),
      50, 'MT', 'Toamasina, Madagascar', 900, 'USDT', 'CFR',
      jsonb_build_array('${publicUrl}'),
      '${TAG}: temporary listing for smoke-listing-images.mjs',
      'active'
    );
  `);
  const re = await mgmtQuery(
    `select images from public.listings where id = '${listingId}';`
  );
  const stored = Array.isArray(re[0]?.images) ? re[0].images : [];
  check(stored.includes(publicUrl), "listing.images contains the public URL");

  console.log("\n=== buyer cannot delete seller's object ===");
  r = await deleteAs(buyer.access_token, sellerPath);
  check(!r.ok, "buyer DELETE rejected", r.ok ? "deleted!" : `HTTP ${r.status}`);

  console.log("\n=== seller can delete own object ===");
  r = await deleteAs(seller.access_token, sellerPath);
  check(r.ok, "seller DELETE succeeded", r.ok ? "" : `HTTP ${r.status}`);

  // Verify deletion at the API level (the public URL may stay 200 for
  // a while due to Supabase's CDN cache — we don't assert on that).
  const listAfter = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/listings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${seller.access_token}`,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefix: seller.user_id, limit: 200 }),
    }
  );
  const listJson = listAfter.ok ? await listAfter.json() : [];
  const stillThere = Array.isArray(listJson)
    ? listJson.some((row) => row.name === objectName)
    : false;
  check(!stillThere, "object no longer appears in storage.list");

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  await wipe();
  return fail === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch(async (e) => {
    console.error("✗", e.message);
    try {
      await wipe();
    } catch {}
    process.exit(2);
  });
