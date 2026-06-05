#!/usr/bin/env node
/**
 * Upload partner logos from public/images/partners into Supabase Storage.
 *
 * Usage:
 *   node scripts/import-partners.mjs
 *   node scripts/import-partners.mjs --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS_DIR = join(ROOT, "public", "images", "partners");
const BUCKET = "partners";

const LEGACY_FILES = {
  vesuvius: "vesuvius.svg",
  "amg-graphite-gk": "amg-graphite-gk.png",
  asbury: "asbury.svg",
  "minchem-impex": "minchem-impex.png",
  "sgl-carbon": "sgl-carbon.svg",
  "krosaki-harima": "krosaki-harima.png",
  "rhi-magnesita": "rhi-magnesita.svg",
  gmi: "gmi.png",
  "superior-graphite": "superior-graphite.svg",
  "morgan-advanced-materials": "morgan-advanced-materials.svg",
  cgm: "cgm.jpg",
  "zircar-refractories": "zircar-refractories.png",
  "aug-gundlach": "aug-gundlach.jpg",
  "agc-ppl": "agc-ppl.png",
  unimex: "unimex.png",
};

const MIME = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const dryRun = process.argv.includes("--dry-run");

const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf8")
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

function partnerIconPath(slug, ext) {
  return `${slug}/icon.${ext}`;
}

function publicUrl(path) {
  const base = SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const { data: partners, error } = await admin
    .from("partners")
    .select("id, slug")
    .order("sort_order");
  if (error) throw error;

  let uploaded = 0;
  for (const partner of partners ?? []) {
    const filename = LEGACY_FILES[partner.slug];
    if (!filename) {
      console.warn(`  skip ${partner.slug}: no legacy file mapping`);
      continue;
    }
    const localPath = join(ICONS_DIR, filename);
    if (!existsSync(localPath)) {
      console.warn(`  skip ${partner.slug}: missing ${localPath}`);
      continue;
    }
    const ext = filename.split(".").pop() ?? "bin";
    const mime = MIME[`.${ext}`] ?? "application/octet-stream";
    const storagePath = partnerIconPath(partner.slug, ext);
    const buf = readFileSync(localPath);

    if (dryRun) {
      console.log(`  [dry-run] ${partner.slug} → ${storagePath}`);
      continue;
    }

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: mime, upsert: true });
    if (upErr) throw upErr;

    const icon_url = publicUrl(storagePath);
    const { error: dbErr } = await admin
      .from("partners")
      .update({
        icon_url,
        storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partner.id);
    if (dbErr) throw dbErr;

    console.log(`  ✓ ${partner.slug}`);
    uploaded++;
  }

  console.log(dryRun ? "\nDry run complete." : `\n✓ Uploaded ${uploaded} partner icon(s).`);
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
