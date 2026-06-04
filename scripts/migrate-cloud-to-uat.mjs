#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Migrate Supabase Cloud → self-hosted UAT (Postgres data + Storage files).
 *
 * Uses Management API (no DB password) + service role Storage API.
 *
 * Usage:
 *   node scripts/migrate-cloud-to-uat.mjs --dry-run
 *   node scripts/migrate-cloud-to-uat.mjs
 *   node scripts/migrate-cloud-to-uat.mjs --skip-storage
 *   node scripts/migrate-cloud-to-uat.mjs --storage-only
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { createClient } from "@supabase/supabase-js";

import { createAdminQuery, loadEnvLocal } from "./lib/supabase-env.mjs";
import { execCommand, uploadBuffer, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TMP = join(ROOT, ".tmp-migrate");
const REMOTE_SQL = "/tmp/graphite-cloud-import.sql";

const flags = {
  dryRun: process.argv.includes("--dry-run"),
  skipStorage: process.argv.includes("--skip-storage"),
  storageOnly: process.argv.includes("--storage-only"),
};

const SCHEMAS = ["public", "auth", "storage"];
const SKIP_TABLES = new Set([
  // Supabase internal / migration tracking on target already applied
  "public._agent_migrations",
  "auth.schema_migrations",
  "auth.migrations",
  "storage.migrations",
  "supabase_migrations.schema_migrations",
]);

function sqlEscape(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function pgArray(val) {
  if (!Array.isArray(val)) return sqlEscape(val);
  if (val.length === 0) return "'{}'";
  const items = val.map((v) => {
    if (v === null) return "NULL";
    return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  });
  return `'${`{${items.join(",")}}`}'`;
}

async function listTables(query) {
  const rows = await query(`
    select table_schema, table_name
    from information_schema.tables
    where table_schema in ('public','auth','storage')
      and table_type = 'BASE TABLE'
    order by table_schema, table_name;
  `);
  return rows
    .map((r) => `${r.table_schema}.${r.table_name}`)
    .filter((t) => !SKIP_TABLES.has(t));
}

async function exportTable(query, qualified) {
  const [schema, table] = qualified.split(".");
  const cols = await query(`
    select column_name, data_type, udt_name, is_generated
    from information_schema.columns
    where table_schema = '${schema}' and table_name = '${table}'
    order by ordinal_position;
  `);
  if (!cols.length) return { qualified, lines: [], count: 0 };

  const writable = cols.filter((c) => c.is_generated !== "ALWAYS");
  const colNames = writable.map((c) => c.column_name);
  const rows = await query(`select * from ${schema}.${table};`);
  if (!rows.length) return { qualified, lines: [], count: 0 };

  const lines = [];
  for (const row of rows) {
    const values = colNames.map((name) => {
      const colMeta = writable.find((c) => c.column_name === name);
      const val = row[name];
      const type = colMeta?.data_type ?? "";
      const udt = colMeta?.udt_name ?? "";
      if (val === null || val === undefined) return "NULL";
      if (type === "json" || type === "jsonb" || udt === "jsonb" || udt === "json") {
        return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
      }
      if (typeof val === "boolean") return val ? "true" : "false";
      if (typeof val === "number" && Number.isFinite(val)) return String(val);
      if (type === "ARRAY" || udt.startsWith("_")) {
        return pgArray(val);
      }
      if (type === "timestamp with time zone" || type === "timestamp without time zone" || type === "date") {
        return `'${String(val).replace(/'/g, "''")}'`;
      }
      if (type === "uuid" || type === "text" || type === "character varying") {
        return `'${String(val).replace(/'/g, "''")}'`;
      }
      if (type === "integer" || type === "bigint" || type === "smallint" || type === "numeric") {
        return String(val);
      }
      return `'${String(val).replace(/'/g, "''")}'`;
    });
    lines.push(
      `INSERT INTO ${schema}.${table} (${colNames.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")}) ON CONFLICT DO NOTHING;`,
    );
  }
  return { qualified, lines, count: rows.length };
}

async function buildSqlDump(query) {
  const tables = await listTables(query);
  console.log(`▸ Cloud tables to export: ${tables.length}`);

  const header = `-- Cloud → UAT import generated ${new Date().toISOString()}
BEGIN;
SET session_replication_role = replica;
`;

  const chunks = [header];
  let totalRows = 0;

  for (const t of tables) {
    process.stdout.write(`  export ${t} ... `);
    const { lines, count } = await exportTable(query, t);
    console.log(count ? `${count} rows` : "empty");
    totalRows += count;
    if (lines.length) {
      chunks.push(`\n-- ${t}\n`);
      chunks.push(lines.join("\n"));
      chunks.push("\n");
    }
  }

  chunks.push(`
SET session_replication_role = DEFAULT;
COMMIT;
`);
  return { sql: chunks.join(""), totalRows, tables: tables.length };
}

async function fetchUatKeys(conn) {
  const envFile = await execCommand(
    conn,
    "grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=' /data/deploy/supabase/upstream/.env",
    { quiet: true },
  );
  let anonKey = "";
  let serviceKey = "";
  for (const line of envFile.split("\n")) {
    if (line.startsWith("ANON_KEY=")) anonKey = line.slice("ANON_KEY=".length).trim();
    if (line.startsWith("SERVICE_ROLE_KEY=")) serviceKey = line.slice("SERVICE_ROLE_KEY=".length).trim();
  }
  const url = `https://${loadEnvLocal().SELF_HOST_SUPABASE_HOST}`;
  return { url, anonKey, serviceKey };
}

function encodeObjectPath(bucket, path) {
  const segments = path.split("/").map((s) => encodeURIComponent(s)).join("/");
  return `${encodeURIComponent(bucket)}/${segments}`;
}

async function uploadViaInternalKong(conn, serviceKey, bucket, path, buf, contentType) {
  const remotePath = `/tmp/migrate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await uploadBuffer(conn, remotePath, buf);
  const objectPath = encodeObjectPath(bucket, path);
  const ct = (contentType || "application/octet-stream").replace(/'/g, "'\\''");
  const key = serviceKey.replace(/'/g, "'\\''");
  const out = await execCommand(
    conn,
    `docker run --rm --network supabase_default -v '${remotePath}:/upload:ro' curlimages/curl:8.5.0 -s -w '\\nHTTP:%{http_code}' \\
      -X POST 'http://supabase-kong:8000/storage/v1/object/${objectPath}' \\
      -H 'apikey: ${key}' \\
      -H 'Authorization: Bearer ${key}' \\
      -H 'Content-Type: ${ct}' \\
      -H 'x-upsert: true' \\
      --data-binary '@/upload'; rm -f '${remotePath}'`,
    { quiet: true },
  );
  const httpMatch = out.match(/HTTP:(\d+)/);
  const status = httpMatch ? Number(httpMatch[1]) : 0;
  if (status >= 200 && status < 300) return null;
  const body = out.replace(/\nHTTP:\d+\s*$/, "").trim();
  return body || `HTTP ${status}`;
}

async function syncStorage(cloudUrl, cloudKey, uatUrl, uatKey, internal = null) {
  const cloud = createClient(cloudUrl, cloudKey);
  const uat = internal ? null : createClient(uatUrl, uatKey);

  const { data: buckets, error: bErr } = await cloud.storage.listBuckets();
  if (bErr) throw new Error(`Cloud listBuckets: ${bErr.message}`);
  console.log(`▸ Storage buckets: ${buckets?.length ?? 0}`);

  let copied = 0;
  let skipped = 0;

  for (const bucket of buckets ?? []) {
    console.log(`  bucket: ${bucket.id}`);
    // Buckets already imported via storage.buckets SQL; skip API create.

    const files = await listAllObjects(cloud, bucket.id);
    console.log(`    objects: ${files.length}`);

    for (const path of files) {
      if (flags.dryRun) {
        skipped++;
        continue;
      }
      const { data: blob, error: dlErr } = await cloud.storage.from(bucket.id).download(path);
      if (dlErr || !blob) {
        console.warn(`    ⚠ download failed ${path}: ${dlErr?.message}`);
        skipped++;
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      let upErr = null;
      if (internal) {
        upErr = await uploadViaInternalKong(
          internal.conn,
          internal.serviceKey,
          bucket.id,
          path,
          buf,
          blob.type,
        );
      } else {
        const { error } = await uat.storage.from(bucket.id).upload(path, buf, {
          upsert: true,
          contentType: blob.type || undefined,
        });
        upErr = error?.message ?? null;
      }
      if (upErr) {
        console.warn(`    ⚠ upload failed ${path}: ${upErr}`);
        skipped++;
        continue;
      }
      copied++;
    }
  }

  return { copied, skipped };
}

async function ensureUatBucket(uat, bucket) {
  const { data: existing } = await uat.storage.getBucket(bucket.id);
  if (existing) return;
  const { error } = await uat.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(`createBucket ${bucket.id}: ${error.message}`);
  }
}

async function listAllObjects(client, bucket, prefix = "") {
  const out = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) out.push(path);
    else if (item.name) {
      const nested = await listAllObjects(client, bucket, path);
      out.push(...nested);
    }
  }
  return out;
}

async function applySqlOnUat(localSqlPath) {
  await withJumpSsh({
    async onTarget(conn) {
      await uploadFile(conn, localSqlPath, REMOTE_SQL);
      console.log("▸ Importing SQL on UAT Postgres...");
      await execCommand(
        conn,
        `cat ${REMOTE_SQL} | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
      );
      await execCommand(conn, `rm -f ${REMOTE_SQL}`);
    },
  });
}

async function main() {
  const env = loadEnvLocal();
  const cloudUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const cloudKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cloudUrl || !cloudKey || !env.SUPABASE_ACCESS_TOKEN) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ACCESS_TOKEN");
  }

  console.log("▸ Cloud → UAT migration");
  console.log(`  Cloud: ${cloudUrl}`);
  console.log(`  UAT:   https://${env.SELF_HOST_SUPABASE_HOST}`);

  if (flags.storageOnly) {
    console.log("▸ Storage-only sync (via internal Kong on UAT server)");
    let stats;
    await withJumpSsh({
      async onTarget(conn) {
        const uatKeys = await fetchUatKeys(conn);
        stats = await syncStorage(cloudUrl, cloudKey, uatKeys.url, uatKeys.serviceKey, {
          conn,
          serviceKey: uatKeys.serviceKey,
        });
      },
    });
    console.log(`▸ Storage: copied=${stats.copied} skipped=${stats.skipped}`);
    console.log("\n✓ Storage sync complete.");
    return;
  }

  const query = createAdminQuery(env);
  const { sql, totalRows, tables } = await buildSqlDump(query);
  console.log(`\n▸ Exported ${totalRows} rows from ${tables} tables`);

  if (flags.dryRun) {
    console.log("Dry-run: skipping import + storage.");
    return;
  }

  await mkdir(TMP, { recursive: true });
  const sqlPath = join(TMP, "cloud-import.sql");
  await writeFile(sqlPath, sql, "utf8");
  console.log(`▸ SQL dump: ${sqlPath} (${(sql.length / 1024).toFixed(1)} KB)`);

  await applySqlOnUat(sqlPath);

  if (!flags.skipStorage) {
    console.log("\n▸ Syncing Storage files...");
    let stats;
    await withJumpSsh({
      async onTarget(conn) {
        uatKeys = await fetchUatKeys(conn);
        stats = await syncStorage(cloudUrl, cloudKey, uatKeys.url, uatKeys.serviceKey, {
          conn,
          serviceKey: uatKeys.serviceKey,
        });
      },
    });
    console.log(`▸ Storage: copied=${stats.copied} skipped=${stats.skipped}`);
  }

  console.log("\n✓ Migration complete.");
  console.log("Next: update Vercel env to point at UAT Supabase URL + keys (npm run deploy:uat:status).");
}

main().catch((e) => {
  console.error("\n✗ Migration failed:", e.message ?? e);
  process.exit(1);
});
