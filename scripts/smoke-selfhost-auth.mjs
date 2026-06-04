#!/usr/bin/env node
/* eslint-disable no-console */
/** Quick auth + trading path checks against current .env.local Supabase. */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/supabase-env.mjs";

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const ACCOUNTS = [
  { role: "buyer", email: "eric.chang.1015+buyer@gmail.com" },
  { role: "seller", email: "eric.chang.1015+seller@gmail.com" },
  { role: "admin", email: env.ADMIN_EMAIL || "eric.chang.1015+admin@gmail.com" },
];
const PASS = "a1234567";

let failed = 0;
function ok(label, pass, detail = "") {
  console.log(`${pass ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failed++;
}

console.log(`▸ Auth tests on ${url}\n`);

for (const { role, email } of ACCOUNTS) {
  const client = createClient(url, anon);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASS,
  });
  ok(`${role} signIn`, !error && !!data.session, error?.message ?? data.user?.id?.slice(0, 8));
  await client.auth.signOut();
}

const admin = createClient(url, service);
const { data: orders } = await admin.from("orders").select("id").limit(1);
ok("orders table readable", Array.isArray(orders));

const { data: listings } = await admin.from("listings").select("id").limit(1);
ok("listings table readable", Array.isArray(listings));

console.log(failed ? `\n✗ ${failed} failed` : "\n✓ Auth smoke passed");
process.exit(failed ? 1 : 0);
