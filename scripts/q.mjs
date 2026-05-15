#!/usr/bin/env node
// Ad-hoc query helper against Supabase Management API.
// Usage: node scripts/q.mjs "select count(*) from public.orders"
import "dotenv/config";
import { readFileSync } from "node:fs";

// Load .env.local manually (the project pulls from there)
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

const token = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !url) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];
const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error('Usage: node scripts/q.mjs "<sql>"');
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
  }
);
const body = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}\n${body}`);
  process.exit(1);
}
try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body);
}
