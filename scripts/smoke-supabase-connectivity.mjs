#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Smoke test Supabase API connectivity using .env.local (self-host or cloud).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/supabase-env.mjs";

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE in .env.local");
  process.exit(1);
}

console.log(`▸ Target: ${url}\n`);

const anonClient = createClient(url, anon);
const adminClient = createClient(url, service);

let failed = 0;
function ok(label, pass, detail = "") {
  console.log(`${pass ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failed++;
}

// Auth health (anon)
const authRes = await fetch(`${url}/auth/v1/health`, {
  headers: { apikey: anon },
});
ok("Auth /health", authRes.ok, `HTTP ${authRes.status}`);

// REST + RLS (anon read public categories)
const { data: cats, error: catErr } = await anonClient
  .from("product_categories")
  .select("id")
  .limit(1);
ok("REST product_categories (anon)", !catErr, catErr?.message ?? `rows=${cats?.length ?? 0}`);

// Admin read profiles count
const { count, error: profErr } = await adminClient
  .from("profiles")
  .select("*", { count: "exact", head: true });
ok("REST profiles (service_role)", !profErr, profErr?.message ?? `count=${count ?? 0}`);

// Storage list buckets (service role)
const { data: buckets, error: bucketErr } = await adminClient.storage.listBuckets();
ok(
  "Storage listBuckets",
  !bucketErr && Array.isArray(buckets),
  bucketErr?.message ?? `buckets=${buckets?.map((b) => b.name).join(",")}`,
);

// Realtime reachability (HTTP upgrade endpoint)
const rtRes = await fetch(`${url}/realtime/v1/`, { headers: { apikey: anon } });
ok("Realtime endpoint", rtRes.status < 500, `HTTP ${rtRes.status}`);

// Management API (cloud-only) — expect skip/fail on self-host
const ref = new URL(url).hostname.split(".")[0];
const mgmtOk =
  url.includes(".supabase.co") &&
  env.SUPABASE_ACCESS_TOKEN &&
  (await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "select 1 as ok" }),
  }).then((r) => r.ok));
if (url.includes(".supabase.co")) {
  ok("Management API (cloud)", mgmtOk);
} else {
  console.log("· Management API — skipped (self-host; use deploy:uat:migrate:status)");
}

console.log(failed ? `\n✗ ${failed} check(s) failed` : "\n✓ All connectivity checks passed");
process.exit(failed ? 1 : 0);
