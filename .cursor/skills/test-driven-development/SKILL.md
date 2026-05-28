---
name: test-driven-development
description: Writes proof for new behavior using node:assert + scripts/test-*.mjs and scripts/smoke-*.mjs. Use when implementing logic, fixing bugs, or changing behavior. This project has no Jest/Vitest — proof comes from build + smoke scripts + browser walkthrough.
---

# Test-Driven Development (Mada Graphite)

## Overview

This project does **not** ship a Jest/Vitest unit test runner. Proof is layered:

| Level | Where | Example |
|---|---|---|
| Compile | `npm run build` | TypeScript + Next.js compile gate |
| Pure-helper | `scripts/test-*.mjs` with `node:assert` or hand-rolled `eq()` | `scripts/test-listing-spec-helpers.mjs` |
| Integration | `scripts/smoke-*.mjs` — server actions + DB via Management API | `scripts/smoke-payment-schedule.mjs` |
| E2E | `scripts/e2e-*.mjs` — full multi-actor flow | `scripts/e2e-full-trading.mjs` |
| UI | Browser MCP walkthrough + `npm run qa:check-dev` | See [browser-testing-with-devtools](../browser-testing-with-devtools/SKILL.md) |

Treat the matching `npm run qa:*` script as the test suite for that domain.

## When to use

- Implementing any new logic in `src/lib/**`, `src/actions/**`, or any data transform
- Fixing any bug (the Prove-It pattern)
- Modifying an existing flow that already has a smoke script — extend it
- Adding edge case handling

**When NOT to use:** static content, documentation, pure styling tweaks with no logic.

## The Prove-It pattern (bug fixes)

When a bug is reported, **do not start by fixing it.** Start by adding an assertion that fails.

```
Bug report arrives
       │
       ▼
Add assertion to the relevant scripts/smoke-*.mjs or scripts/test-*.mjs
       │
       ▼
Run script → it FAILS (bug confirmed)
       │
       ▼
Fix the underlying code (action / migration / helper)
       │
       ▼
Re-run script → it PASSES
       │
       ▼
npm run build (exit 0)
```

If the buggy code is **purely a helper** (no DB), drop a case into `scripts/test-*.mjs`. If it crosses **server action → DB → response**, extend or add `scripts/smoke-<feature>.mjs`.

## Pure-helper test (no DB)

Pattern from `scripts/test-listing-spec-helpers.mjs`:

```javascript
#!/usr/bin/env node
import { formatMeshSelection } from "../src/lib/categories/spec.ts";

let pass = 0;
let fail = 0;
const failures = [];

function eq(actual, expected, label) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${label}`);
    return;
  }
  fail++;
  failures.push({ label, expected, actual });
  console.log(`  ✗ ${label}`);
}

console.log("=== formatMeshSelection ===");
eq(formatMeshSelection(undefined), "", "undefined -> empty");
eq(formatMeshSelection("+100"), "+100 Mesh", "single string");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
```

Run with `node --experimental-strip-types --no-warnings scripts/test-<name>.mjs` (the `--experimental-strip-types` flag lets Node read the `.ts` import directly).

Register it in `package.json`:

```json
"qa:<name>": "node --experimental-strip-types --no-warnings scripts/test-<name>.mjs"
```

## Smoke test (server action + DB)

Pattern from `scripts/smoke-payment-schedule.mjs`:

1. Read `.env.local` for Supabase Management API credentials
2. Seed the DB by directly running SQL via the Management API
3. Call the actual server action (or its underlying logic) the same way the UI would
4. Assert the resulting DB state
5. Print pass/fail per step
6. Honor `--cleanup` flag to remove the test rows

Run via `node scripts/smoke-<feature>.mjs --cleanup`.

Register in `package.json`:

```json
"qa:<feature>": "node scripts/smoke-<feature>.mjs --cleanup"
```

## Choosing the right level

```
Is the code a pure function with no I/O?
  → scripts/test-*.mjs with eq() / node:assert

Does the code cross a boundary (DB, RLS, server action, Supabase Storage)?
  → scripts/smoke-*.mjs hitting the Management API

Is it a full user journey across multiple actors?
  → scripts/e2e-*.mjs (see scripts/e2e-full-trading.mjs)

Is the proof visual / interactive in a browser?
  → cursor-ide-browser MCP walkthrough + npm run qa:check-dev
  → See browser-testing-with-devtools
```

## Writing good assertions

### Assert outcome, not call sequence

```javascript
// Good: assert the DB ended in the right state
const { data: schedule } = await sb
  .from("payment_schedules")
  .select("status")
  .eq("id", scheduleId)
  .single();
eq(schedule.status, "paid", "schedule moves to paid after verify");

// Bad: assert that a specific SQL string was run
```

### Self-contained over DRY

In smoke scripts, repeat the input shape per test rather than hiding it in shared helpers — when the script fails six months later, the failing block should be readable in isolation.

### Cover the edge cases listed in the bug

If the bug ticket says "fails when title has emoji", add an assertion with an emoji title. If it says "race condition with two payments", add a concurrent submission case.

### Cleanup matters

Always implement `--cleanup` for smoke scripts that mutate rows. Production DB tests leave rows that break subsequent runs.

## Anti-patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `npm test` invocation | No such command — there is no test runner | Use the explicit `npm run qa:<name>` |
| Jest/Vitest `describe`/`it`/`expect` | Project has no Jest/Vitest | Use `node:assert` or `eq()` helper |
| Mocking Supabase client | Hides RLS / type issues | Hit the real DB via Management API |
| `console.log("OK")` without asserting | Not proof | Use `eq()` / `assert()` and exit non-zero on fail |
| Smoke script with no `--cleanup` | DB rows accumulate | Always support cleanup |
| Test that passes on first run with no code change | May not be testing what you think | For bugs: confirm it fails BEFORE the fix |

## Browser-based behavior

For UI-side behavior (form validation, route guards, toast on error), combine smoke scripts with browser verification:

1. Smoke script proves server action returns `{ data, error }` correctly
2. Browser MCP walks the UI flow and confirms toast / redirect / state update
3. `npm run qa:check-dev` confirms no runtime errors

See [browser-testing-with-devtools](../browser-testing-with-devtools/SKILL.md).

## Rationalizations

| Rationalization | Reality |
|---|---|
| "I tested it manually" | Manual testing does not persist. Tomorrow's change can break it silently. |
| "It's too simple to test" | Simple code becomes complicated. The script documents expected behavior. |
| "Smoke scripts are slow" | They hit real DB once. Slower than a unit test, faster than re-debugging a regression. |
| "I'll add the script after merging" | You won't. And review without proof is rubber-stamping. |
| "Build passed, that's proof" | Build does not exercise RLS, state machines, or runtime hydration. |
| "Let me re-run the same command to be sure" | Re-running an unchanged script on unchanged code adds zero confidence. Re-run only after a real edit. |

## Red flags

- Logic change with no `scripts/test-*.mjs` or `scripts/smoke-*.mjs` touched
- Bug fix with no failing reproduction before the fix
- Test that passes immediately on first write (may not be exercising the bug)
- `console.log` without an `eq()` / `assert` to back it up
- Smoke script that leaves DB rows behind

## Verification

After implementing or fixing:

- [ ] Pure-helper changes have a matching `scripts/test-*.mjs` assertion
- [ ] Cross-cutting changes (action + DB + UI) have a matching `scripts/smoke-*.mjs`
- [ ] Bug fixes include an assertion that failed BEFORE the fix
- [ ] `npm run build` exit 0
- [ ] The relevant `npm run qa:<domain>` exit 0 (cite the output)
- [ ] If UI is involved: `npm run qa:check-dev` exit 0
