---
name: graphite-qa
description: Runs Mada Graphite QA tiers for B2B trading flows (orders, payments, contracts, chat, KYC). Use when verifying features, before commit, after UI changes, or when the user asks about testing, smoke tests, or QA. Combines Prove-It testing with project scripts in docs/TESTING.md.
---

# Mada Graphite QA

## Overview

This project does **not** use Jest/Vitest for app logic. Proof comes from:

1. `npm run build` (TypeScript + Next.js compile gate)
2. `scripts/smoke-*.mjs` / `scripts/e2e-*.mjs` (DB + server-action paths)
3. Browser walkthrough + `npm run qa:check-dev` (runtime errors)
4. `docs/TESTING.md` manual E2E scenarios (Tier 2)

Read [docs/TESTING.md](../../../docs/TESTING.md) for full tier definitions and test accounts.

## When to Use

- Implementing or fixing order / payment / contract / chat / KYC behavior
- Any UI change under `src/app/` or `src/components/`
- Before declaring "done" or committing
- Bug reports on B2B trading flows

## QA Tiers (run in order)

### Tier 0 — Preflight (~2 min)

```powershell
npm run qa:preflight
```

Pass: build exit 0, all migrations applied, schema matches `scripts/verify-schema.mjs`.

### Tier 1 — Static

```powershell
npm run lint
npm run build
```

### Tier 2 — Domain smoke (pick by change area)

| Changed area | Command |
|---|---|
| Payment schedules / order completion gate | `npm run qa:payment-schedule` then `npm run qa:a7:gate` |
| Dispute / cancel / admin force | `npm run qa:a7:dispute` |
| Full trading path | `npm run qa:e2e-full` |
| Chat / party threads | `npm run qa:chat` |
| KYC uploads / gates | `npm run qa:kyc` or `npm run qa:kyc:e2e` |
| i18n dashboard strings | `npm run qa:i18n` |
| Listing MOQ / images / delete | `npm run qa:listing-moq`, `qa:listing-images`, `qa:listing-delete` |
| RLS policies | `npm run qa:verify-rls` |
| OAuth config | `npm run qa:oauth` |
| All A7 regression bundle | `npm run qa:a7` |

Pass: script exit 0 and printed assertions green.

### Tier 3 — Browser runtime (UI work)

1. Start dev server on port 3000 only (`npm run dev`). Kill stale processes on 3000 first.
2. Walk affected routes (see `docs/TESTING.md` §3–§4 for order flows).
3. After **every** navigation with browser MCP: call `browser_console_messages`.
4. End with:

```powershell
npm run qa:check-dev
```

Pass: exit 0 (no real ERROR in `.next/dev/logs/next-development.log`).

Hydration / SSR suspicion:

```powershell
node scripts/probe-ssr.mjs http://localhost:3000/<path>
```

Known ignorable client injections: `data-cursor-ref`, `bis_skin_checked`, `cz-shortcut-listen`.

### Tier 4 — Cleanup (optional)

```powershell
npm run qa:cleanup
```

Use when smoke scripts created test rows.

## Prove-It Pattern (this repo)

For bugs in **pure helpers** (no DB), add or extend a script under `scripts/`:

```
Bug report → write failing assertion in smoke script → run → fix → run again → full build
```

Example: `scripts/test-listing-spec-helpers.mjs` (`npm run qa:spec-helpers`).

For **server actions + DB + UI**, extend an existing smoke script or add `scripts/smoke-<feature>.mjs` with `--cleanup` when possible. Follow patterns in `scripts/smoke-payment-schedule.mjs`.

## Cross-cutting change checklist

Changes touching server actions + DB + UI:

- [ ] Tier 0 preflight
- [ ] Relevant Tier 2 smoke script (exit 0)
- [ ] Tier 3 browser + `qa:check-dev` (exit 0)
- [ ] `npm run build` again before commit

## Rationalizations

| Excuse | Reality |
|---|---|
| "Build passed, we're done" | Build does not prove order state transitions or RLS. Run domain smokes. |
| "I'll run qa:check-dev later" | Dev log accumulates; run it before finishing. |
| "The overlay shows no errors" | Next.js badge resets on navigation. Log file is source of truth. |
| "Migration file exists" | Run `npm run db:migrate:status` and `verify-schema.mjs`. |

## Verification

Before "done":

- [ ] Correct tier commands run with exit 0
- [ ] Command output cited in the response (not "should work")
- [ ] New cross-cutting behavior has smoke script or extended existing one
- [ ] `npm run build` exit 0
