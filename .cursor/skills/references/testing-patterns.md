# Testing Patterns Reference (Mada Graphite)

Quick patterns for writing assertions in this repo. Use alongside the [test-driven-development](../test-driven-development/SKILL.md) skill.

This project has **no Jest/Vitest/Playwright** unit suite. Proof comes from:

- `scripts/test-*.mjs` — pure-helper assertions (Node + `node:assert` or hand-rolled `eq()`)
- `scripts/smoke-*.mjs` — server-action + DB integration via Supabase Management API
- `scripts/e2e-*.mjs` — multi-actor full-flow walkthroughs
- Browser MCP walkthrough + `npm run qa:check-dev` — UI runtime
- `docs/TESTING.md` — manual E2E scenarios

## Table of contents

- [Pure-helper test (no DB)](#pure-helper-test-no-db)
- [Smoke test (server action + DB)](#smoke-test-server-action--db)
- [E2E test (multi-actor)](#e2e-test-multi-actor)
- [Browser MCP walkthrough](#browser-mcp-walkthrough)
- [Loading .env.local](#loading-envlocal)
- [Cleanup pattern](#cleanup-pattern)
- [Anti-patterns](#anti-patterns)
- [Reference scripts](#reference-scripts)

## Pure-helper test (no DB)

For functions in `src/lib/**` that are pure (no I/O, no Supabase).

```javascript
#!/usr/bin/env node
import { formatMeshSelection } from "../src/lib/categories/spec.ts";

let pass = 0;
let fail = 0;

function eq(actual, expected, label) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${label}`);
    return;
  }
  fail++;
  console.log(`  ✗ ${label}`);
  console.log(`      expected: ${JSON.stringify(expected)}`);
  console.log(`      actual:   ${JSON.stringify(actual)}`);
}

function deepEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✓ ${label}`); return; }
  fail++;
  console.log(`  ✗ ${label}`);
  console.log(`      expected: ${e}`);
  console.log(`      actual:   ${a}`);
}

console.log("=== formatMeshSelection ===");
eq(formatMeshSelection(undefined), "", "undefined -> empty");
eq(formatMeshSelection("+100"), "+100 Mesh", "single string");
eq(
  formatMeshSelection(["+35", "+50", "+80", "+100"]),
  "+35 to +100 Mesh",
  "range form"
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

Run:

```powershell
node --experimental-strip-types --no-warnings scripts/test-<name>.mjs
```

The `--experimental-strip-types` flag lets Node load `.ts` imports directly.

Register in `package.json`:

```json
"qa:<name>": "node --experimental-strip-types --no-warnings scripts/test-<name>.mjs"
```

## Smoke test (server action + DB)

For flows that cross the server action boundary into Supabase.

### Skeleton

```javascript
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

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

const PROJECT_REF = env.SUPABASE_PROJECT_REF;
const TOKEN = env.SUPABASE_ACCESS_TOKEN;

async function sql(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    console.error(await res.text());
    throw new Error(`SQL failed (${res.status})`);
  }
  return res.json();
}

const cleanup = process.argv.includes("--cleanup");
const testRunId = `smoke_${randomUUID().slice(0, 8)}`;
const seeded = [];

let pass = 0, fail = 0;
function step(ok, label) {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; console.log(`  ✗ ${label}`); }
}

try {
  // 1. Seed
  const [{ id: orderId }] = await sql(`
    insert into orders (...) values (...) returning id
  `);
  seeded.push({ table: "orders", id: orderId });

  // 2. Act — call the same path the server action takes
  await sql(`
    update orders set status = 'contract_signed'
      where id = '${orderId}'
  `);

  // 3. Assert
  const [row] = await sql(`
    select status, timeline from orders where id = '${orderId}'
  `);
  step(row.status === "contract_signed", "status flipped");
  step(
    row.timeline.at(-1)?.event === "contract_signed",
    "timeline appended"
  );

} finally {
  if (cleanup) {
    for (const { table, id } of seeded.reverse()) {
      await sql(`delete from ${table} where id = '${id}'`);
    }
    console.log("  ↻ cleanup done");
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

Run:

```powershell
node scripts/smoke-<feature>.mjs --cleanup
```

Register in `package.json`:

```json
"qa:<feature>": "node scripts/smoke-<feature>.mjs --cleanup"
```

## E2E test (multi-actor)

For flows that involve buyer + seller + admin in sequence (e.g. full trading path). Pattern: log in via Supabase admin client as each user in turn, drive the actions, assert DB state.

Reference: `scripts/e2e-full-trading.mjs`, `scripts/lib/e2e-auth.mjs`.

Run:

```powershell
node scripts/e2e-full-trading.mjs
```

## Browser MCP walkthrough

For UI-side proof, combine smoke + browser MCP. See [browser-testing-with-devtools](../browser-testing-with-devtools/SKILL.md).

```
1. Smoke script proves server action returns { data, error } correctly
2. Browser MCP walks the UI flow:
   - browser_navigate http://localhost:3000/<path>
   - browser_lock { action: "lock" }
   - browser_snapshot
   - interactions
   - browser_console_messages         ← after every nav
3. npm run qa:check-dev               ← exit 0 required
```

## Loading .env.local

Every smoke script reads `.env.local` directly (no dotenv dep):

```javascript
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
```

Common reusable: `scripts/lib/supabase-env.mjs`.

## Cleanup pattern

Always support `--cleanup` to remove seeded rows. Use a try/finally with a `seeded` array:

```javascript
const cleanup = process.argv.includes("--cleanup");
const seeded = [];

try {
  // seed and assert
  seeded.push({ table: "orders", id: orderId });
} finally {
  if (cleanup) {
    for (const { table, id } of seeded.reverse()) {
      await sql(`delete from ${table} where id = '${id}'`);
    }
  }
}
```

Without `--cleanup`, rows stay for manual inspection. `npm run qa:cleanup` (`scripts/cleanup-test-data.mjs`) drops everything tagged as test data.

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `npm test` | No such command exists | Use the specific `npm run qa:<name>` |
| `describe` / `it` / `expect` | No Jest/Vitest installed | Use `node:assert` or hand-rolled `eq()` |
| `jest.mock(...)` of Supabase client | Hides RLS and type issues | Hit real DB via Management API |
| `console.log("OK")` without assertion | Not proof | Use `eq()` / `assert.ok` and `process.exit(1)` on fail |
| Smoke script without `--cleanup` | DB rows accumulate | Always implement cleanup |
| Asserting "method was called" | Couples test to implementation | Assert final DB state instead |
| Re-running an unchanged script "to be sure" | No new information | Re-run only after a real code change |

## Reference scripts

| Pattern | Script |
|---|---|
| Pure helper | `scripts/test-listing-spec-helpers.mjs` |
| Smoke (action + DB) | `scripts/smoke-payment-schedule.mjs` |
| Smoke with multi-step state machine | `scripts/smoke-a7-completion-gate.mjs` |
| Smoke + dispute path | `scripts/smoke-a7-dispute-cancel.mjs` |
| Chat realtime | `scripts/smoke-chat.mjs` |
| KYC flow | `scripts/qa-kyc.mjs`, `scripts/e2e-kyc.mjs` |
| Full multi-actor E2E | `scripts/e2e-full-trading.mjs` |
| RLS verification | `scripts/verify-rls-policies.mjs` |
| Schema verification | `scripts/verify-schema.mjs` |
| Dev server log analysis | `scripts/check-dev-errors.mjs` |
| SSR vs CSR probe | `scripts/probe-ssr.mjs` |

When in doubt, copy the structure of a similar existing script rather than inventing a new style.
