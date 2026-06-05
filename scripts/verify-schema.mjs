#!/usr/bin/env node
// 一次性驗證 013/014 migration 已落地：
//   - payment_schedules 表存在 + 必要欄位
//   - orders 已加 incoterm + 9 個 milestone 時間戳
//   - orders.payment_terms / payment_due_days / payment_due_date 已 drop
//   - contracts.payment_terms / payment_due_days 已 drop
//   - payments.schedule_id 已新增
import { readFileSync } from "node:fs";

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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body}`);
  return JSON.parse(body);
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

async function cols(table) {
  const rows = await q(`
    select column_name, data_type
      from information_schema.columns
     where table_schema = 'public' and table_name = '${table}'
     order by column_name;
  `);
  return new Map(rows.map((r) => [r.column_name, r.data_type]));
}

async function main() {
  console.log("=== payment_schedules ===");
  const ps = await cols("payment_schedules");
  for (const c of [
    "id", "order_id", "sequence", "category", "milestone", "percentage",
    "amount", "currency", "bl_offset_days", "due_date", "status",
    "paid_payment_id", "notes", "created_at", "updated_at",
  ]) {
    check(ps.has(c), `payment_schedules.${c} exists`);
  }

  console.log("\n=== orders new columns ===");
  const orders = await cols("orders");
  for (const c of [
    "incoterm",
    "before_production_at", "before_shipment_at", "before_loading_at",
    "loaded_at", "bl_received_at", "shipping_docs_received_at",
    "bl_plus_insurance_received_at", "picked_up_at", "accepted_at",
  ]) {
    check(orders.has(c), `orders.${c} exists`);
  }

  console.log("\n=== legacy columns dropped ===");
  for (const c of ["payment_terms", "payment_due_days", "payment_due_date"]) {
    check(!orders.has(c), `orders.${c} dropped`);
  }
  const contracts = await cols("contracts");
  for (const c of ["payment_terms", "payment_due_days"]) {
    check(!contracts.has(c), `contracts.${c} dropped`);
  }

  console.log("\n=== payments.schedule_id ===");
  const payments = await cols("payments");
  check(payments.has("schedule_id"), "payments.schedule_id exists");

  console.log("\n=== enums ===");
  const enums = await q(`
    select t.typname,
           array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname in (
       'payment_category', 'payment_milestone', 'payment_schedule_status'
     )
     group by t.typname;
  `);
  const normalize = (labels) => {
    if (Array.isArray(labels)) return labels;
    if (typeof labels === "string") {
      // PG array literal "{a,b,c}" → ["a","b","c"]
      return labels.replace(/^[{"]|[}"]$/g, "").split(",").map((s) => s.trim());
    }
    return [];
  };
  const enumMap = new Map(enums.map((e) => [e.typname, normalize(e.labels)]));
  const catActual = enumMap.get("payment_category") ?? [];
  const catExpected = ["prepayment", "regular_payment", "postpayment"];
  check(
    catActual.length === catExpected.length &&
      catExpected.every((v) => catActual.includes(v)),
    `payment_category enum (${catActual.length} values)`
  );

  const milestoneExpected = [
    "contract_signed", "before_production", "before_shipment", "before_loading",
    "loaded_onto_vessel", "bl_received", "shipping_docs_received",
    "bl_plus_insurance_received", "arrived_at_port", "goods_picked_up",
    "accepted_by_buyer", "bl_date_plus_30", "bl_date_plus_60", "bl_date_plus_90",
  ];
  const msActual = enumMap.get("payment_milestone") ?? [];
  check(
    milestoneExpected.every((v) => msActual.includes(v)),
    `payment_milestone enum has 14 expected values (got ${msActual.length})`
  );

  const ssExpected = ["scheduled", "due", "awaiting_review", "paid", "overdue", "waived"];
  const ssActual = enumMap.get("payment_schedule_status") ?? [];
  check(
    ssExpected.every((v) => ssActual.includes(v)),
    `payment_schedule_status enum (${ssActual.length} values)`
  );

  console.log("\n=== chat_rooms denorm columns ===");
  const chatRooms = await cols("chat_rooms");
  for (const c of [
    "last_message_at",
    "last_message_preview",
    "party_user_low",
    "party_user_high",
  ]) {
    check(chatRooms.has(c), `chat_rooms.${c} exists`);
  }

  console.log("\n=== messages context columns ===");
  const messages = await cols("messages");
  for (const c of ["context_type", "context_id"]) {
    check(messages.has(c), `messages.${c} exists`);
  }

  console.log("\n=== party chat enums ===");
  const chatEnums = await q(`
    select t.typname,
           array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
     where t.typname in ('chat_type', 'chat_message_context_type')
     group by t.typname;
  `);
  const chatEnumMap = new Map(
    chatEnums.map((e) => [e.typname, normalize(e.labels)])
  );
  const chatType = chatEnumMap.get("chat_type") ?? [];
  check(chatType.includes("party"), `chat_type includes party (got ${chatType.join(",")})`);
  const ctxType = chatEnumMap.get("chat_message_context_type") ?? [];
  check(
    ["listing", "inquiry", "order"].every((v) => ctxType.includes(v)),
    `chat_message_context_type has listing/inquiry/order (${ctxType.length} values)`
  );

  const partyIdx = await q(`
    select indexname from pg_indexes
     where schemaname = 'public' and tablename = 'chat_rooms'
       and indexname = 'idx_chat_rooms_party_pair';
  `);
  check(partyIdx.length > 0, "idx_chat_rooms_party_pair exists");

  console.log("\n=== KYC (019) ===");
  const kycBucket = await q(`
    select id, public from storage.buckets where id = 'kyc';
  `);
  check(kycBucket.length === 1, "storage.buckets kyc exists");
  check(kycBucket[0]?.public === false, "kyc bucket is private");

  const kycSettings = await q(`
    select key, value from public.platform_settings
     where key in ('kyc_min_level_inquiry', 'kyc_min_level_listing');
  `);
  const kycKeys = new Set(kycSettings.map((r) => r.key));
  check(kycKeys.has("kyc_min_level_inquiry"), "platform_settings kyc_min_level_inquiry");
  check(kycKeys.has("kyc_min_level_listing"), "platform_settings kyc_min_level_listing");

  const kycTrigger = await q(`
    select tgname from pg_trigger
     where tgrelid = 'public.profiles'::regclass
       and tgname = 'trg_profiles_guard_kyc_level';
  `);
  check(kycTrigger.length === 1, "trg_profiles_guard_kyc_level exists");

  console.log("\n=== KYC phone / levels (020) ===");
  const phoneCol = await q(`
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'phone_verified_at';
  `);
  check(phoneCol.length === 1, "profiles.phone_verified_at exists");

  const otpTable = await q(`
    select tablename from pg_tables
     where schemaname = 'public' and tablename = 'phone_otp_challenges';
  `);
  check(otpTable.length === 1, "phone_otp_challenges table exists");

  console.log("\n=== profiles.avatar_url (021) ===");
  const profiles = await cols("profiles");
  check(profiles.has("avatar_url"), "profiles.avatar_url exists");

  console.log("\n=== avatars storage bucket (021) ===");
  const avatarBuckets = await q(`
    select id, public, file_size_limit
      from storage.buckets
     where id = 'avatars';
  `);
  check(avatarBuckets.length === 1, "avatars bucket exists");
  if (avatarBuckets[0]) {
    check(avatarBuckets[0].public === true, "avatars bucket is public");
    check(
      avatarBuckets[0].file_size_limit === 2097152,
      "avatars file_size_limit is 2 MB"
    );
  }

  console.log("\n=== product_categories spec_schema shape (022) ===");
  const specSample = await q(`
    select count(*) filter (where (spec_schema ? 'product_type')
                              and (spec_schema ? 'mesh_size')
                              and (spec_schema ? 'fixed_carbon_min')
                              and (spec_schema ? 'fixed_carbon_max')
                              and (spec_schema ? 'is_custom')) as structured,
           count(*) filter (where is_active and coalesce((spec_schema->>'is_custom')::boolean, false)) as active_custom,
           count(*) filter (where is_active and not coalesce((spec_schema->>'is_custom')::boolean, false)) as active_standard,
           count(*) filter (where not is_active) as deactivated
      from public.product_categories;
  `);
  const stats = specSample[0] ?? {};
  check(Number(stats.structured) >= 7, `≥7 categories use the structured spec_schema (got ${stats.structured})`);
  check(Number(stats.active_custom) >= 1, `at least 1 active Custom Grade category (got ${stats.active_custom})`);
  check(Number(stats.active_standard) >= 6, `at least 6 active standard mesh categories (got ${stats.active_standard})`);
  check(Number(stats.deactivated) >= 6, `legacy MADA brand rows deactivated (got ${stats.deactivated})`);

  console.log("\n=== listings storage bucket (024) ===");
  const listingsBucket = await q(`
    select id, public, file_size_limit, allowed_mime_types
      from storage.buckets
     where id = 'listings';
  `);
  check(listingsBucket.length === 1, "listings bucket exists");
  if (listingsBucket[0]) {
    check(listingsBucket[0].public === true, "listings bucket is public");
    check(
      listingsBucket[0].file_size_limit === 2097152,
      `listings file_size_limit is 2 MiB (got ${listingsBucket[0].file_size_limit})`
    );
    const mimes = Array.isArray(listingsBucket[0].allowed_mime_types)
      ? listingsBucket[0].allowed_mime_types
      : String(listingsBucket[0].allowed_mime_types ?? "")
          .replace(/^[{"]|[}"]$/g, "")
          .split(",")
          .map((s) => s.replace(/^"|"$/g, "").trim());
    for (const m of ["image/jpeg", "image/png", "image/webp"]) {
      check(mimes.includes(m), `listings MIME whitelist includes ${m}`);
    }
  }
  const listingsPolicies = await q(`
    select polname from pg_policy
     where polrelid = 'storage.objects'::regclass
       and polname in (
         'listings:public read',
         'listings:owner insert',
         'listings:owner update',
         'listings:owner delete'
       );
  `);
  const polNames = new Set(listingsPolicies.map((p) => p.polname));
  for (const p of [
    "listings:public read",
    "listings:owner insert",
    "listings:owner update",
    "listings:owner delete",
  ]) {
    check(polNames.has(p), `policy ${p} exists`);
  }

  console.log("\n=== listings.min_order_quantity (023) ===");
  const listings = await cols("listings");
  check(listings.has("min_order_quantity"), "listings.min_order_quantity exists");
  if (listings.has("min_order_quantity")) {
    check(listings.get("min_order_quantity") === "numeric", "listings.min_order_quantity type is numeric");
  }
  const moqIsNullable = await q(`
    select is_nullable from information_schema.columns
     where table_schema='public' and table_name='listings' and column_name='min_order_quantity';
  `);
  check(moqIsNullable[0]?.is_nullable === "YES", "listings.min_order_quantity is nullable");
  const moqCheck = await q(`
    select conname from pg_constraint
     where conrelid = 'public.listings'::regclass
       and conname  = 'listings_min_order_quantity_positive';
  `);
  check(moqCheck.length === 1, "listings_min_order_quantity_positive constraint exists");

  console.log("\n=== quotations.created_by (027) ===");
  const quotations = await cols("quotations");
  check(quotations.has("created_by"), "quotations.created_by exists");
  if (quotations.has("created_by")) {
    const nullable = await q(`
      select is_nullable from information_schema.columns
       where table_schema='public' and table_name='quotations' and column_name='created_by';
    `);
    check(nullable[0]?.is_nullable === "NO", "quotations.created_by is NOT NULL");
  }
  const createdByOrphans = await q(`
    select count(*)::int as n from public.quotations where created_by is null;
  `);
  check(Number(createdByOrphans[0]?.n) === 0, "no quotations.created_by NULL rows after backfill");
  const createdByIdx = await q(`
    select indexname from pg_indexes
     where schemaname='public' and tablename='quotations' and indexname='idx_quotations_created_by';
  `);
  check(createdByIdx.length === 1, "idx_quotations_created_by exists");

  console.log("\n=== mine photos (031) ===");
  const mineCats = await cols("mine_photo_categories");
  check(mineCats.has("slug"), "mine_photo_categories.slug exists");
  check(mineCats.has("cover_url"), "mine_photo_categories.cover_url exists");
  const minePhotos = await cols("mine_photos");
  check(minePhotos.has("full_url"), "mine_photos.full_url exists");
  check(minePhotos.has("thumb_url"), "mine_photos.thumb_url exists");
  const mineBucket = await q(`
    select id, public, file_size_limit from storage.buckets where id = 'mine-photos';
  `);
  check(mineBucket.length === 1, "mine-photos bucket exists");
  if (mineBucket.length) {
    check(mineBucket[0].public === true, "mine-photos bucket is public");
  }
  const minePolicies = await q(`
    select polname from pg_policy
     where polrelid = 'storage.objects'::regclass
       and polname in (
         'mine-photos:public read',
         'mine-photos:admin insert',
         'mine-photos:admin update',
         'mine-photos:admin delete'
       );
  `);
  const minePolNames = new Set(minePolicies.map((p) => p.polname));
  for (const p of [
    "mine-photos:public read",
    "mine-photos:admin insert",
    "mine-photos:admin update",
    "mine-photos:admin delete",
  ]) {
    check(minePolNames.has(p), `policy ${p} exists`);
  }

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(2);
});
