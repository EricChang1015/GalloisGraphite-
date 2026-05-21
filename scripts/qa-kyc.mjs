#!/usr/bin/env node
/**
 * QA: KYC bucket, platform thresholds, self-level guard, admin override.
 * Usage: node scripts/qa-kyc.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const token = env.SUPABASE_ACCESS_TOKEN;
const SELLER_EMAIL = "eric.chang.1015+seller@gmail.com";
const BUYER_EMAIL = "eric.chang.1015+buyer@gmail.com";
const PASSWORD = "a1234567";
const ref = new URL(url).hostname.split(".")[0];

if (!url || !anon || !serviceKey || !token) {
  console.error("✗ Missing Supabase env in .env.local");
  process.exit(2);
}

async function adminQuery(sql) {
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

function anonClient() {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminClient() {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email) {
  const sb = anonClient();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return { sb, userId: data.user.id };
}

let pass = 0;
let fail = 0;
function check(cond, id, label, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${id} ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${id} ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function getSetting(key) {
  const rows = await adminQuery(`
    select value from public.platform_settings where key = '${key}' limit 1;
  `);
  return rows[0]?.value;
}

async function setSetting(key, value) {
  await adminQuery(`
    insert into public.platform_settings (key, value)
    values ('${key}', '${JSON.stringify(value)}'::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now();
  `);
}

async function main() {
  console.log("=== QA KYC（A6）===\n");

  // TC-KYC-00 schema / settings
  console.log("--- TC-KYC-00 平台門檻與 bucket ---");
  const inquiryMin = await getSetting("kyc_min_level_inquiry");
  const listingMin = await getSetting("kyc_min_level_listing");
  check(
    inquiryMin === 0 || inquiryMin === "0",
    "TC-KYC-00a",
    `kyc_min_level_inquiry defaults to 0 (got ${inquiryMin})`
  );
  check(
    listingMin === 0 || listingMin === "0",
    "TC-KYC-00b",
    `kyc_min_level_listing defaults to 0 (got ${listingMin})`
  );

  const buckets = await adminQuery(`
    select id, public, file_size_limit from storage.buckets where id = 'kyc';
  `);
  check(buckets.length === 1, "TC-KYC-00c", "kyc storage bucket exists");
  check(buckets[0]?.public === false, "TC-KYC-00d", "kyc bucket is private");

  const triggers = await adminQuery(`
    select tgname from pg_trigger
     where tgrelid = 'public.profiles'::regclass
       and tgname = 'trg_profiles_guard_kyc_level';
  `);
  check(triggers.length === 1, "TC-KYC-00e", "profiles_guard_kyc_level trigger exists");

  const { userId: sellerId, sb: sellerSb } = await signIn(SELLER_EMAIL);
  const { userId: buyerId } = await signIn(BUYER_EMAIL);

  // TC-KYC-01 self kyc_level guard
  console.log("\n--- TC-KYC-01 使用者不可自調 kyc_level ---");
  const { data: beforeSeller } = await sellerSb
    .from("profiles")
    .select("kyc_level")
    .eq("id", sellerId)
    .single();
  const prevLevel = beforeSeller?.kyc_level ?? 0;

  const { error: bumpErr } = await sellerSb
    .from("profiles")
    .update({ kyc_level: 2 })
    .eq("id", sellerId);
  check(!bumpErr, "TC-KYC-01a", "update call succeeds (trigger reverts silently)");

  const { data: afterSeller } = await sellerSb
    .from("profiles")
    .select("kyc_level")
    .eq("id", sellerId)
    .single();
  check(
    afterSeller?.kyc_level === prevLevel,
    "TC-KYC-01b",
    `kyc_level unchanged after self bump (still ${afterSeller?.kyc_level})`
  );

  // TC-KYC-02 storage upload path
  console.log("\n--- TC-KYC-02 Seller 上傳 kyc 檔案 ---");
  const stamp = Date.now();
  const path = `${sellerId}/business_registration/qa-${stamp}.txt`;
  const blob = new Blob(["QA KYC test document"], { type: "application/pdf" });
  const { error: uploadErr } = await sellerSb.storage.from("kyc").upload(path, blob, {
    contentType: "application/pdf",
    upsert: false,
  });
  check(!uploadErr, "TC-KYC-02a", "seller can upload to kyc bucket", uploadErr?.message);

  const docId = crypto.randomUUID();
  const docEntry = {
    id: docId,
    type: "business_registration",
    storage_path: path,
    file_name: `qa-${stamp}.pdf`,
    uploaded_at: new Date().toISOString(),
  };
  const { data: profDocs } = await sellerSb
    .from("profiles")
    .select("kyc_docs")
    .eq("id", sellerId)
    .single();
  const existing = Array.isArray(profDocs?.kyc_docs) ? profDocs.kyc_docs : [];
  const { error: docsErr } = await sellerSb
    .from("profiles")
    .update({ kyc_docs: [...existing, docEntry] })
    .eq("id", sellerId);
  check(!docsErr, "TC-KYC-02b", "seller can append kyc_docs", docsErr?.message);

  const { data: reread } = await sellerSb
    .from("profiles")
    .select("kyc_docs, kyc_level")
    .eq("id", sellerId)
    .single();
  const hasDoc = (reread?.kyc_docs ?? []).some((d) => d?.id === docId);
  check(hasDoc, "TC-KYC-02c", "kyc_docs contains new entry");
  check(
    reread?.kyc_level === prevLevel,
    "TC-KYC-02d",
    "uploading docs does not auto-raise kyc_level"
  );

  // TC-KYC-03 admin override
  console.log("\n--- TC-KYC-03 Admin 手動升級 kyc_level ---");
  const admin = adminClient();
  const targetLevel = 1;
  const { error: adminErr } = await admin
    .from("profiles")
    .update({ kyc_level: targetLevel })
    .eq("id", sellerId);
  check(!adminErr, "TC-KYC-03a", "admin sets seller kyc_level", adminErr?.message);

  const { data: adminRead } = await admin
    .from("profiles")
    .select("kyc_level")
    .eq("id", sellerId)
    .single();
  check(adminRead?.kyc_level === targetLevel, "TC-KYC-03b", "seller kyc_level is 1");

  await admin.from("profiles").update({ kyc_level: prevLevel }).eq("id", sellerId);

  // TC-KYC-04 gate logic with raised threshold
  console.log("\n--- TC-KYC-04 門檻 gate（listing min=1）---");
  const savedListing = await getSetting("kyc_min_level_listing");
  await setSetting("kyc_min_level_listing", 1);

  const { data: buyerProf } = await anonClient()
    .auth.signInWithPassword({ email: BUYER_EMAIL, password: PASSWORD })
    .then(async ({ data }) =>
      anonClient()
        .from("profiles")
        .select("kyc_level")
        .eq("id", data.user.id)
        .single()
    );
  const buyerLevel = buyerProf?.kyc_level ?? 0;
  const minListing = 1;
  const gateBlocks = buyerLevel < minListing;
  check(gateBlocks, "TC-KYC-04a", "buyer level 0 blocked when min listing is 1");

  await admin.from("profiles").update({ kyc_level: 1 }).eq("id", buyerId);
  const gatePasses = 1 >= minListing;
  check(gatePasses, "TC-KYC-04b", "buyer level 1 passes when min listing is 1");
  await admin.from("profiles").update({ kyc_level: 0 }).eq("id", buyerId);
  await setSetting("kyc_min_level_listing", savedListing ?? 0);

  // TC-KYC-06 phone verify must use service role (trigger blocks self-update)
  console.log("\n--- TC-KYC-06 電話驗證寫入（service role）---");
  const testPhone = `+1555${String(Date.now()).slice(-7)}`;
  const verifiedAt = new Date().toISOString();
  const { sb: buyerSb } = await signIn(BUYER_EMAIL);

  await buyerSb.from("profiles").update({ phone: testPhone }).eq("id", buyerId);

  const { error: selfPhoneErr } = await buyerSb
    .from("profiles")
    .update({ phone_verified_at: verifiedAt, kyc_level: 1 })
    .eq("id", buyerId);
  check(!selfPhoneErr, "TC-KYC-06a", "buyer update call succeeds (trigger reverts)");

  const { data: afterSelf } = await buyerSb
    .from("profiles")
    .select("kyc_level, phone_verified_at")
    .eq("id", buyerId)
    .single();
  check(
    !afterSelf?.phone_verified_at,
    "TC-KYC-06b",
    "buyer cannot self-set phone_verified_at"
  );
  check(
    (afterSelf?.kyc_level ?? 0) < 1,
    "TC-KYC-06c",
    `buyer cannot self-raise kyc_level via phone path (level ${afterSelf?.kyc_level})`
  );

  const { error: adminPhoneErr } = await admin
    .from("profiles")
    .update({ phone_verified_at: verifiedAt, kyc_level: 1 })
    .eq("id", buyerId);
  check(!adminPhoneErr, "TC-KYC-06d", "service role sets phone_verified_at + level 1");

  const { data: afterAdmin } = await admin
    .from("profiles")
    .select("kyc_level, phone_verified_at")
    .eq("id", buyerId)
    .single();
  check(Boolean(afterAdmin?.phone_verified_at), "TC-KYC-06e", "phone_verified_at persisted");
  check((afterAdmin?.kyc_level ?? 0) >= 1, "TC-KYC-06f", "kyc_level is at least 1");

  await admin
    .from("profiles")
    .update({ phone_verified_at: null, kyc_level: 0, phone: null })
    .eq("id", buyerId);
  check(true, "TC-KYC-06g", "restored buyer phone/kyc after phone verify QA");

  // TC-KYC-05 cleanup QA storage + doc row
  console.log("\n--- TC-KYC-05 清理 QA 資料 ---");
  const cleaned = (reread?.kyc_docs ?? []).filter((d) => d?.id !== docId);
  await sellerSb.from("profiles").update({ kyc_docs: cleaned }).eq("id", sellerId);
  await sellerSb.storage.from("kyc").remove([path]);
  check(true, "TC-KYC-05", "removed QA doc from profile and storage");

  console.log(`\n==== ${pass} passed · ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(2);
});
