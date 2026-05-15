#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/gen-types.mjs
 *
 * 從 .env.local 讀取 SUPABASE_ACCESS_TOKEN 與 NEXT_PUBLIC_SUPABASE_URL，
 * 然後執行：
 *   npx supabase gen types typescript --project-id <ref> --schema public
 *     > src/types/database.ts
 *
 * 不需要全域安裝 supabase CLI；npx 會自動使用最近版本。
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function loadEnv() {
  const raw = await readFile(join(ROOT, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function parseProjectRef(url) {
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) throw new Error(`Cannot parse project ref from ${url}`);
  return m[1];
}

const env = await loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN in .env.local');
if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
const ref = parseProjectRef(url);

const outPath = join(ROOT, 'src', 'types', 'database.ts');
console.log(`▸ Generating TS types for project ${ref}`);
console.log(`▸ Output: ${outPath}`);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['supabase', 'gen', 'types', 'typescript', '--project-id', ref, '--schema', 'public'],
  {
    cwd: ROOT,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

const out = createWriteStream(outPath);
child.stdout.pipe(out);
child.on('exit', (code) => {
  if (code === 0) {
    console.log('✓ TS types generated.');
  } else {
    console.error(`✗ supabase gen types exited with code ${code}`);
    process.exit(code ?? 1);
  }
});
