---
name: using-agent-skills
description: Discovers and routes to Mada Graphite agent skills in .cursor/skills/. Use when starting a session, picking a workflow, or asking which skill applies. Maps tasks to graphite-qa, incremental-implementation, source-driven-development, browser-testing-with-devtools, test-driven-development, debugging-and-error-recovery, code-review-and-quality, and security-and-hardening.
---

# Using Agent Skills (Mada Graphite)

## What this is

`.cursor/skills/` holds a curated subset of [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), heavily adapted for this Next.js 16 + Supabase B2B trading platform. Skills are **workflows** the agent follows step by step — not reference docs.

The full catalog is in [README.md](../README.md).

## Skill router

Match the task to a skill. Multiple skills can apply in sequence.

```
Task arrives
    │
    ├── Verifying / testing / pre-commit ──────→ graphite-qa
    ├── Multi-file feature / refactor ─────────→ incremental-implementation
    │     └── Needs Next.js 16 / Tailwind v4 docs? → source-driven-development
    ├── UI change in browser ──────────────────→ browser-testing-with-devtools
    ├── Writing scripts/test-*.mjs or smoke-*.mjs → test-driven-development
    ├── Build / runtime / hydration error ─────→ debugging-and-error-recovery
    ├── Pre-merge review (yours or another agent's) → code-review-and-quality
    │     └── Auth / RLS / payments / uploads? → security-and-hardening
    ├── Self-host Supabase VM / UAT deploy / data/deploy ─→ self-hosted-supabase-ops
    └── Git, migrations, i18n, server actions, shadcn, supabase
          → see `.cursor/rules/*.mdc` (always-on rules, not skills)
```

## Always-on project rules (read these first)

These take precedence over anything in skills:

- [`.cursorrules`](../../../.cursorrules) — overall conventions (tech stack, domain model, don'ts)
- [`.cursor/rules/main.mdc`](../../rules/main.mdc) — pointer + Next.js 16 reminders
- [`.cursor/rules/verify-before-commit.mdc`](../../rules/verify-before-commit.mdc) — evidence rules
- [`.cursor/rules/git.mdc`](../../rules/git.mdc) — conventional commits + build gate
- [`.cursor/rules/migrations.mdc`](../../rules/migrations.mdc) — schema change protocol
- [`.cursor/rules/server-actions.mdc`](../../rules/server-actions.mdc) — `{ data, error }` pattern
- [`.cursor/rules/supabase.mdc`](../../rules/supabase.mdc) — SSR client separation
- [`.cursor/rules/ui-shadcn.mdc`](../../rules/ui-shadcn.mdc) — base-nova + base-ui
- [`.cursor/rules/i18n.mdc`](../../rules/i18n.mdc) — next-intl + cookie locale

## Core operating behaviors

Apply these across every skill — they are non-negotiable.

### 1. Surface assumptions

Before any non-trivial implementation, state assumptions explicitly:

```
ASSUMPTIONS:
1. [requirement assumption]
2. [architecture assumption]
3. [scope assumption]
→ Correct me now or I'll proceed with these.
```

### 2. Manage confusion actively

When you spot a conflict (spec vs. existing code, two docs disagree, ambiguous scope):

1. STOP. Do not guess.
2. Name the specific confusion.
3. Present the tradeoff or ask the clarifying question.
4. Wait for resolution.

### 3. Push back when warranted

You are not a yes-machine. If an approach has clear problems, name them, quantify the downside, propose an alternative. Accept override gracefully when the human has full context.

### 4. Enforce simplicity

Before finishing, ask:

- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Did I touch files outside the task scope?

If you wrote 1000 lines and 100 would do, that is failure.

### 5. Scope discipline

Touch only what the task requires. Do NOT:

- "Clean up" adjacent code
- Refactor imports in files you are not modifying
- Remove comments you do not fully understand
- Add features not in the spec

If you notice something worth fixing outside scope, mention it — do not fix it.

### 6. Verify, do not assume

A task is not complete until verification passes. Evidence required:

- `npm run build` exit 0 (always)
- `npm run qa:check-dev` exit 0 (UI work)
- Matching `npm run qa:*` exit 0 (domain work — see `graphite-qa`)
- Command output cited in the response, not "should work"

## Skill rules

1. **Check for an applicable skill before starting.** Skills prevent common mistakes.
2. **Skills are workflows, not suggestions.** Follow steps in order. Do not skip verification.
3. **Multiple skills can apply.** A typical feature: `source-driven-development` → `incremental-implementation` → `test-driven-development` → `browser-testing-with-devtools` → `code-review-and-quality` → `graphite-qa`.
4. **When the task touches `src/actions/*`, `supabase/migrations/`, or auth/payments — also load `security-and-hardening`.**

## Quick reference

| Phase | Skill | One-line |
|-------|-------|----------|
| Verify | [graphite-qa](../graphite-qa/SKILL.md) | Project QA tiers + `npm run qa:*` mapping |
| Build | [incremental-implementation](../incremental-implementation/SKILL.md) | Migration → action → UI → smoke vertical slices |
| Build | [source-driven-development](../source-driven-development/SKILL.md) | Verify against Next.js 16 / Tailwind v4 docs |
| Verify | [browser-testing-with-devtools](../browser-testing-with-devtools/SKILL.md) | cursor-ide-browser MCP + qa:check-dev |
| Verify | [test-driven-development](../test-driven-development/SKILL.md) | Prove-It via `scripts/smoke-*.mjs` |
| Verify | [debugging-and-error-recovery](../debugging-and-error-recovery/SKILL.md) | Stop-the-line + layer triage |
| Review | [code-review-and-quality](../code-review-and-quality/SKILL.md) | Five-axis pre-merge review |
| Review | [security-and-hardening](../security-and-hardening/SKILL.md) | RLS, zod, Server Actions, payments |
| Ops | [self-hosted-supabase-ops](../self-hosted-supabase-ops/SKILL.md) | SSH jump → UAT VM; `npm run deploy:uat:*` |

## Failure modes to avoid

1. Making wrong assumptions without checking
2. Plowing ahead when lost instead of asking
3. Not surfacing inconsistencies
4. Being sycophantic ("Of course!") to bad ideas
5. Overcomplicating code
6. Modifying code orthogonal to the task
7. Removing things you do not fully understand
8. Skipping verification because "it looks right"
9. Citing the dev overlay badge as evidence (it resets on navigation)
10. Claiming "build passed" as proof of correctness for DB/RLS/UI changes
