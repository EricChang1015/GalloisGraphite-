#!/usr/bin/env node
/**
 * Import mining-site photos from madagraphite.com into Supabase.
 *
 * Fetches full-size images from the legacy photojson API (not thumbnails),
 * resizes to fit 1920×1080 with low-pass blur, uploads to `mine-photos`
 * bucket, and inserts rows into mine_photo_categories / mine_photos.
 *
 * Usage:
 *   node scripts/import-legacy-mine-photos.mjs
 *   node scripts/import-legacy-mine-photos.mjs --dry-run
 *   node scripts/import-legacy-mine-photos.mjs --cid=1
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  resizeMinePhoto,
  resizeMinePhotoCover,
} from "./lib/mine-photo-resize.mjs";

const LEGACY_BASE = "http://madagraphite.com";
const BUCKET = "mine-photos";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cidFilter = args.find((a) => a.startsWith("--cid="))?.split("=")[1];

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
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function publicUrl(path) {
  return `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function upload(path, body, contentType) {
  if (dryRun) {
    console.log(`  [dry-run] upload ${path} (${body.length} bytes)`);
    return;
  }
  const { error } = await admin.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function main() {
  const { data: categories, error: catErr } = await admin
    .from("mine_photo_categories")
    .select("id, legacy_cid, slug, title_en")
    .order("sort_order");

  if (catErr) throw new Error(catErr.message);
  if (!categories?.length) {
    console.error("No categories — run migration 031 first.");
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;

  for (const cat of categories) {
    const cid = cat.legacy_cid;
    if (!cid) continue;
    if (cidFilter && String(cid) !== cidFilter) continue;

    console.log(`\n=== cid=${cid} ${cat.slug} (${cat.title_en}) ===`);

    // Category cover from legacy header image
    const headerUrl = `${LEGACY_BASE}/content/assets/images/mining/header/${cid}.jpg`;
    try {
      const headerBuf = await fetchBuffer(headerUrl);
      const coverBuf = await resizeMinePhotoCover(headerBuf);
      const coverPath = `${cat.slug}/cover.jpg`;
      await upload(coverPath, coverBuf, "image/jpeg");
      if (!dryRun) {
        await admin
          .from("mine_photo_categories")
          .update({ cover_url: publicUrl(coverPath) })
          .eq("id", cat.id);
      }
      console.log(`  cover ← ${headerUrl}`);
    } catch (e) {
      console.warn(`  cover failed: ${e.message}`);
    }

    const jsonUrl = `${LEGACY_BASE}/index.php/home/index/photojson.html?cid=${cid}&startId=1`;
    const json = await (await fetch(jsonUrl)).json();
    const items = json.data ?? [];

    const { data: existing } = await admin
      .from("mine_photos")
      .select("id, sort_order")
      .eq("category_id", cat.id);

    const existingCount = existing?.length ?? 0;
    if (existingCount >= items.length && !cidFilter) {
      console.log(`  skip — already has ${existingCount} photos`);
      skipped += existingCount;
      continue;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sortOrder = i + 1;
      const already = existing?.find((r) => r.sort_order === sortOrder);
      if (already) {
        skipped++;
        continue;
      }

      const bigPath = item.src.startsWith("/") ? item.src : `/${item.src}`;
      const fullSrc = `${LEGACY_BASE}${bigPath}`;
      console.log(`  [${sortOrder}/${items.length}] ${fullSrc}`);

      const raw = await fetchBuffer(fullSrc);
      const { fullBuffer, thumbBuffer } = await resizeMinePhoto(raw);
      const photoId = randomUUID();
      const fullPath = `${cat.slug}/${photoId}/full.jpg`;
      const thumbPath = `${cat.slug}/${photoId}/thumb.webp`;

      await upload(fullPath, fullBuffer, "image/jpeg");
      await upload(thumbPath, thumbBuffer, "image/webp");

      if (!dryRun) {
        const { error: insErr } = await admin.from("mine_photos").insert({
          id: photoId,
          category_id: cat.id,
          thumb_url: publicUrl(thumbPath),
          full_url: publicUrl(fullPath),
          storage_path_thumb: thumbPath,
          storage_path_full: fullPath,
          alt_en: "",
          alt_zh_cn: "",
          sort_order: sortOrder,
          is_published: true,
        });
        if (insErr) throw new Error(insErr.message);
      }
      imported++;
    }
  }

  console.log(`\nDone. imported=${imported} skipped=${skipped}${dryRun ? " (dry-run)" : ""}`);
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
