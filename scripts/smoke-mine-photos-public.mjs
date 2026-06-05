#!/usr/bin/env node
/**
 * Assert anon can read published mine_photo_categories + mine_photos (032 grants).
 */

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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const catsRes = await fetch(
  `${url}/rest/v1/mine_photo_categories?is_published=eq.true&select=slug`,
  { headers }
);
const cats = await catsRes.json();
if (!catsRes.ok || !Array.isArray(cats) || cats.length === 0) {
  console.error("✗ anon cannot read mine_photo_categories:", cats);
  process.exit(1);
}

const photosRes = await fetch(
  `${url}/rest/v1/mine_photos?is_published=eq.true&select=id&limit=1`,
  { headers }
);
const photos = await photosRes.json();
if (!photosRes.ok || !Array.isArray(photos) || photos.length === 0) {
  console.error("✗ anon cannot read mine_photos:", photos);
  process.exit(1);
}

console.log(`✓ ${cats.length} categories, photos readable via anon`);
process.exit(0);
