# Cursor Agent Skills (Mada Graphite)

Curated and adapted from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (MIT). Upstream provides 23 lifecycle skills; this folder keeps only those that meaningfully apply to this Next.js 16 + Supabase B2B trading platform — rewritten to use this project's commands, scripts, and conventions.

> **Read order on session start:**
>
> 1. `.cursorrules` — project conventions (always-on)
> 2. `.cursor/rules/main.mdc` — Next.js 16 + dev runtime policy (always-on)
> 3. `.cursor/rules/verify-before-commit.mdc` — evidence rules (always-on)
> 4. This README + the skill that matches the current task

## Skill catalog

| Skill | Source | Use when |
|---|---|---|
| [using-agent-skills](./using-agent-skills/SKILL.md) | Rewritten | Starting a session — routes tasks to the right skill |
| [graphite-qa](./graphite-qa/SKILL.md) | **Project-specific** | Verifying anything; maps `docs/TESTING.md` tiers → `npm run qa:*` |
| [incremental-implementation](./incremental-implementation/SKILL.md) | Upstream + Graphite overrides | Multi-file feature / refactor; vertical slices |
| [source-driven-development](./source-driven-development/SKILL.md) | Upstream + Graphite overrides | Next.js 16 / Tailwind v4 / shadcn base-nova patterns |
| [browser-testing-with-devtools](./browser-testing-with-devtools/SKILL.md) | Rewritten for cursor-ide-browser MCP | Any change under `src/app/**` or `src/components/**` |
| [test-driven-development](./test-driven-development/SKILL.md) | Rewritten for `scripts/test-*.mjs` + smoke scripts | Writing logic or fixing bugs (Prove-It pattern) |
| [debugging-and-error-recovery](./debugging-and-error-recovery/SKILL.md) | Rewritten for Next.js + Supabase stack | Build / hydration / RLS / migration errors |
| [code-review-and-quality](./code-review-and-quality/SKILL.md) | Upstream + Graphite overrides | Before merging any change |
| [security-and-hardening](./security-and-hardening/SKILL.md) | Rewritten for Supabase Auth + RLS + Server Actions | Auth / RLS / payments / uploads / KYC |

## References

- [references/testing-patterns.md](./references/testing-patterns.md) — Graphite-specific assertion patterns (no Jest)
- [references/security-checklist.md](./references/security-checklist.md) — Generic + Supabase-mapped checklist
- [references/accessibility-checklist.md](./references/accessibility-checklist.md) — WCAG 2.1 AA quick reference

## Not included (covered elsewhere)

| Upstream skill | Why skipped |
|---|---|
| `git-workflow-and-versioning` | `.cursor/rules/git.mdc` — Conventional Commits + build gate |
| `spec-driven-development`, `planning-and-task-breakdown`, `interview-me`, `idea-refine` | `.cursorrules` "When asked to implement" + `docs/PRD.md` + `docs/ROADMAP.md` |
| `frontend-ui-engineering` | `.cursor/rules/ui-shadcn.mdc` + design tokens in `.cursorrules` |
| `api-and-interface-design` | `.cursor/rules/server-actions.mdc` (`{ data, error }` pattern) |
| `deprecation-and-migration` | `.cursor/rules/migrations.mdc` (Supabase migration protocol) |
| `ci-cd-and-automation`, `shipping-and-launch` | Vercel auto-deploy; no custom CI pipeline |
| `performance-optimization` | Add only when a measurable perf gap is reported |
| `doubt-driven-development`, `context-engineering`, `code-simplification`, `documentation-and-adrs` | Useful in theory; project size does not yet justify the overhead |

## Usage

In Cursor Agent chat, reference a skill explicitly when you want to guarantee the workflow:

```
Follow graphite-qa to verify my payment_schedules change before commit.
```

```
Use code-review-and-quality to review the diff I just produced —
focus on the security axis.
```

```
Apply incremental-implementation. Slice 1 only: migration + RLS.
Stop after the slice and wait for me to confirm.
```

Cursor will also surface skills automatically when the user's request matches a skill's `description` frontmatter.

## What changed from upstream

Each rewritten skill has been adjusted to:

- Replace `npm test` / Jest / Vitest references with `npm run qa:*` and `scripts/{test,smoke,e2e}-*.mjs`
- Replace generic Express / Prisma / helmet examples with Server Actions + Supabase + zod + RLS examples
- Replace Chrome DevTools MCP with cursor-ide-browser MCP + `qa:check-dev`
- Point at this project's `.cursor/rules/*.mdc` for git, migrations, server actions, supabase, ui-shadcn, i18n
- Drop references to skills not present in this folder

If a skill ever cites a missing skill or a non-existent command, that's a bug — please fix it directly.

## Updating from upstream

```powershell
git clone --depth 1 https://github.com/addyosmani/agent-skills.git $env:TEMP\agent-skills
# For each skill kept in this folder, compare upstream changes diff-style.
# Re-apply the Graphite override sections at the top of each SKILL.md.
# Re-check every example for non-existent commands before committing.
```
