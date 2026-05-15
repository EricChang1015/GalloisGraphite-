#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/apply-migrations.mjs
 *
 * 透過 Supabase Management API（POST /v1/projects/{ref}/database/query）
 * 自動執行 supabase/migrations/*.sql。
 *
 * 不需要 DB password — 只需 Personal Access Token (`SUPABASE_ACCESS_TOKEN`)。
 *
 * Usage:
 *   node scripts/apply-migrations.mjs                  # 跑未執行的 migration
 *   node scripts/apply-migrations.mjs --status         # 顯示已/未執行清單
 *   node scripts/apply-migrations.mjs --bootstrap      # 把現有全部 mark as applied 但不執行
 *                                                      # （適合 production DB 已手動跑過的情境）
 *   node scripts/apply-migrations.mjs --dry-run        # 列印將執行的 migration 但不實際跑
 *   node scripts/apply-migrations.mjs --force <name>   # 強制重跑指定 migration
 *   node scripts/apply-migrations.mjs --all            # 強制重跑所有 migration（依賴 idempotent）
 *
 * 追蹤表：public._agent_migrations(name text PK, checksum text, applied_at timestamptz)
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const ENV_FILE = join(ROOT, '.env.local');

// ---------------------------------------------------------------------------
// .env.local parser (no dotenv dependency)
// ---------------------------------------------------------------------------
async function loadEnv() {
  let raw;
  try {
    raw = await readFile(ENV_FILE, 'utf8');
  } catch {
    throw new Error(
      `Cannot read ${ENV_FILE}. Copy .env.example and fill in real values.`,
    );
  }
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseProjectRef(supabaseUrl) {
  const m = supabaseUrl.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) {
    throw new Error(
      `Cannot extract project ref from NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
    );
  }
  return m[1];
}

// ---------------------------------------------------------------------------
// Supabase Management API client
// ---------------------------------------------------------------------------
const MGMT_BASE = 'https://api.supabase.com';

async function runSql({ token, projectRef, sql }) {
  const url = `${MGMT_BASE}/v1/projects/${projectRef}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Management API ${res.status} ${res.statusText}\n${text}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// Migration discovery + tracking
// ---------------------------------------------------------------------------
async function listMigrations() {
  const all = await readdir(MIGRATIONS_DIR);
  const sql = all.filter((n) => n.endsWith('.sql')).sort();

  const seenPrefix = new Map();
  for (const name of sql) {
    const prefix = name.split('_')[0];
    if (!/^\d+$/.test(prefix)) continue;
    if (seenPrefix.has(prefix)) {
      throw new Error(
        `Migration prefix conflict: "${prefix}" used by both ` +
          `"${seenPrefix.get(prefix)}" and "${name}". Rename one of them.`,
      );
    }
    seenPrefix.set(prefix, name);
  }

  const out = [];
  for (const name of sql) {
    const content = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    out.push({ name, content, checksum });
  }
  return out;
}

const ENSURE_TRACKING_TABLE_SQL = `
create table if not exists public._agent_migrations (
  name        text primary key,
  checksum    text not null,
  applied_at  timestamptz not null default now(),
  bootstrap   boolean not null default false
);
`;

async function ensureTrackingTable(ctx) {
  await runSql({ ...ctx, sql: ENSURE_TRACKING_TABLE_SQL });
}

async function fetchApplied(ctx) {
  const rows = await runSql({
    ...ctx,
    sql: 'select name, checksum, bootstrap from public._agent_migrations order by name;',
  });
  const map = new Map();
  for (const r of rows) {
    map.set(r.name, { checksum: r.checksum, bootstrap: r.bootstrap });
  }
  return map;
}

function escapeSqlLiteral(s) {
  return s.replace(/'/g, "''");
}

async function recordApplied(ctx, name, checksum, bootstrap = false) {
  const sql = `
    insert into public._agent_migrations (name, checksum, bootstrap)
    values ('${escapeSqlLiteral(name)}', '${escapeSqlLiteral(checksum)}', ${bootstrap})
    on conflict (name) do update
      set checksum   = excluded.checksum,
          applied_at = now(),
          bootstrap  = excluded.bootstrap;
  `;
  await runSql({ ...ctx, sql });
}

// ---------------------------------------------------------------------------
// Pretty output helpers
// ---------------------------------------------------------------------------
function fmt(name, status, extra = '') {
  const pad = name.padEnd(48);
  return `  ${pad}  ${status}${extra ? '  ' + extra : ''}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const flags = {
    status: args.includes('--status'),
    bootstrap: args.includes('--bootstrap'),
    dryRun: args.includes('--dry-run'),
    all: args.includes('--all'),
    force: null,
  };
  const forceIdx = args.indexOf('--force');
  if (forceIdx !== -1 && args[forceIdx + 1]) {
    flags.force = args[forceIdx + 1];
  }

  const env = await loadEnv();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN in .env.local');
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  const projectRef = parseProjectRef(url);
  const ctx = { token, projectRef };

  console.log(`▸ Project: ${projectRef}`);
  console.log(`▸ Migrations dir: ${MIGRATIONS_DIR}`);
  console.log('');

  const migrations = await listMigrations();
  await ensureTrackingTable(ctx);
  const applied = await fetchApplied(ctx);

  if (flags.status) {
    console.log('Migration status:');
    for (const m of migrations) {
      const a = applied.get(m.name);
      if (!a) {
        console.log(fmt(m.name, '✗ pending'));
      } else if (a.checksum !== m.checksum) {
        console.log(
          fmt(
            m.name,
            '⚠ checksum-mismatch',
            a.bootstrap ? '(bootstrap)' : '',
          ),
        );
      } else {
        console.log(fmt(m.name, '✓ applied', a.bootstrap ? '(bootstrap)' : ''));
      }
    }
    return;
  }

  if (flags.bootstrap) {
    console.log('Bootstrap mode: marking all current migrations as applied (no SQL execution).');
    let count = 0;
    for (const m of migrations) {
      if (applied.has(m.name)) {
        console.log(fmt(m.name, '· skipped (already tracked)'));
        continue;
      }
      if (flags.dryRun) {
        console.log(fmt(m.name, '… would mark applied (dry-run)'));
      } else {
        await recordApplied(ctx, m.name, m.checksum, true);
        console.log(fmt(m.name, '✓ marked applied (bootstrap)'));
        count++;
      }
    }
    console.log(`\nDone. ${count} migration(s) marked.`);
    return;
  }

  // Determine which migrations to actually run
  const targets = [];
  if (flags.force) {
    const m = migrations.find((x) => x.name === flags.force);
    if (!m) throw new Error(`--force target not found: ${flags.force}`);
    targets.push({ ...m, reason: 'force' });
  } else if (flags.all) {
    for (const m of migrations) targets.push({ ...m, reason: 'all' });
  } else {
    for (const m of migrations) {
      const a = applied.get(m.name);
      if (!a) {
        targets.push({ ...m, reason: 'new' });
      } else if (a.checksum !== m.checksum) {
        console.warn(
          `⚠ ${m.name} content changed since last apply. ` +
            `Use --force ${m.name} to rerun, or revert the change.`,
        );
      }
    }
  }

  if (targets.length === 0) {
    console.log('Nothing to apply. Database is up to date.');
    console.log('(Tip: run with --status to inspect tracking table.)');
    return;
  }

  console.log(`Planned execution (${targets.length}):`);
  for (const t of targets) console.log(fmt(t.name, `→ ${t.reason}`));
  console.log('');

  if (flags.dryRun) {
    console.log('Dry-run mode: no SQL executed.');
    return;
  }

  for (const m of targets) {
    process.stdout.write(`▸ Running ${m.name} ... `);
    try {
      await runSql({ ...ctx, sql: m.content });
      await recordApplied(ctx, m.name, m.checksum, false);
      console.log('OK');
    } catch (err) {
      console.log('FAILED');
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
  }
  console.log(`\n✓ Applied ${targets.length} migration(s).`);
  console.log('Tip: regenerate TS types with `npm run db:types`.');
}

main().catch((err) => {
  console.error('\n✗ Migration runner crashed:');
  console.error(err.message ?? err);
  process.exit(1);
});
