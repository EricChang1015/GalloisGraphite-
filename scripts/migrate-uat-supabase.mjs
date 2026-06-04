#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Apply supabase/migrations/*.sql on UAT via docker exec (no Management API).
 *
 * Usage:
 *   node scripts/migrate-uat-supabase.mjs --status
 *   node scripts/migrate-uat-supabase.mjs
 */
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execCommand, uploadFile, withJumpSsh } from "./lib/ssh-jump.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const REMOTE_TMP = "/tmp/graphite-migrations";

async function listMigrations() {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith(".sql")).sort();
  const out = [];
  for (const name of names) {
    const content = await readFile(join(MIGRATIONS_DIR, name), "utf8");
    out.push({ name, content, checksum: createHash("sha256").update(content).digest("hex") });
  }
  return out;
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

async function main() {
  const statusOnly = process.argv.includes("--status");
  const migrations = await listMigrations();

  await withJumpSsh({
    async onTarget(conn) {
      await execCommand(conn, `mkdir -p ${REMOTE_TMP}`);

      const ensureTracking = `
create table if not exists public._agent_migrations (
  name text primary key,
  checksum text not null,
  applied_at timestamptz not null default now(),
  bootstrap boolean not null default false
);
alter table public._agent_migrations enable row level security;
revoke all on table public._agent_migrations from anon, authenticated;
`;
      await execCommand(
        conn,
        `docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'\n${ensureTracking}\nEOSQL`,
      );

      const appliedRaw = await execCommand(
        conn,
        `docker exec -i supabase-db psql -U postgres -d postgres -At -c "select name,checksum from public._agent_migrations order by name;"`,
      );
      const applied = new Map();
      for (const line of appliedRaw.trim().split("\n").filter(Boolean)) {
        const [name, checksum] = line.split("|");
        applied.set(name, checksum);
      }

      if (statusOnly) {
        console.log("Migration status (UAT):");
        for (const m of migrations) {
          const cs = applied.get(m.name);
          if (!cs) console.log(`  ✗ pending  ${m.name}`);
          else if (cs !== m.checksum) console.log(`  ⚠ mismatch ${m.name}`);
          else console.log(`  ✓ applied  ${m.name}`);
        }
        return;
      }

      let count = 0;
      for (const m of migrations) {
        if (applied.get(m.name) === m.checksum) continue;
        console.log(`▸ Applying ${m.name} ...`);
        const localPath = join(MIGRATIONS_DIR, m.name);
        await uploadFile(conn, localPath, `${REMOTE_TMP}/${m.name}`);
        await execCommand(
          conn,
          `cat ${REMOTE_TMP}/${m.name} | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1`,
        );
        await execCommand(
          conn,
          `docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "insert into public._agent_migrations (name, checksum) values ('${sqlEscape(m.name)}', '${sqlEscape(m.checksum)}') on conflict (name) do update set checksum = excluded.checksum, applied_at = now();"`,
        );
        count++;
        console.log(`  OK`);
      }

      console.log(count ? `\n✓ Applied ${count} migration(s).` : "\nNothing to apply.");
    },
  });
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
