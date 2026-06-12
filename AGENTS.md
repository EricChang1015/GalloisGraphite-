<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mada Graphite Platform

This repository is the AI/Trading platform for Graphite Energy Inc.

For the full coding rules, architectural decisions, domain model, and UI/UX
guidelines, **read [`.cursorrules`](./.cursorrules)**. That is the single
source of truth for all AI agents (Cursor / Claude / GPT / Codex).

Quick reference:

- `docs/ARCHITECTURE.md` — **current implemented architecture** (start here)
- `docs/PRD.md` — product requirements (with implementation status)
- `docs/SCHEMA.md` — database schema rationale (post-028 migration)
- `docs/AI_PROMPT.md` — AI assistant prompt & FAQ maintenance guide
- `docs/ROADMAP.md` — remaining MVP gaps + Phase 2 plan
- `docs/DEPLOY_SELFHOST.md` — **Phase 1 自建 Supabase（UAT）** 部署、Compose profiles、migrations
- `docs/TESTING.md` — **QA process** + test accounts + B2B E2E walkthrough (payment_schedules)
- `docs/CONTRACT_TEMPLATE.md` — graphite sales contract template
- `docs/LEGACY_CONTENT.md` — content migrated from old static madagraphite.com
- `docs/COPY_DRAFTS.md` — marketing copy drafts
- `supabase/migrations/` — SQL migrations (currently 001 → 028)
- `.cursor/rules/migrations.mdc` — **migration authoring rules** (read before writing SQL)
- `.cursor/skills/` — **agent workflow skills** (see `.cursor/skills/README.md` for the catalog)
- `.env.example` — required environment variables

## Agent skills (workflows for specific tasks)

Once you've internalised the rules above, pick the matching skill before starting work. See `.cursor/skills/README.md` for the full catalog. Quick router:

| Task | Skill |
|---|---|
| Verifying / pre-commit | `.cursor/skills/graphite-qa/SKILL.md` |
| Multi-file feature | `.cursor/skills/incremental-implementation/SKILL.md` |
| Next.js 16 / Tailwind v4 patterns | `.cursor/skills/source-driven-development/SKILL.md` |
| UI change in browser | `.cursor/skills/browser-testing-with-devtools/SKILL.md` |
| Bug fix / Prove-It | `.cursor/skills/test-driven-development/SKILL.md` |
| Build / hydration / RLS errors | `.cursor/skills/debugging-and-error-recovery/SKILL.md` |
| Pre-merge review | `.cursor/skills/code-review-and-quality/SKILL.md` |
| Auth / RLS / payments / uploads | `.cursor/skills/security-and-hardening/SKILL.md` |
| Self-host Supabase VM / UAT / `data/deploy` | `.cursor/skills/self-hosted-supabase-ops/SKILL.md` |

Skills cite the matching `npm run qa:*` commands; do not invent new test commands.

## Top rules (TL;DR)

1. Server Components by default, `"use client"` only when interactivity is needed.
2. Mutations use Server Actions in `src/actions/*`, not API routes.
3. Forms use `react-hook-form` + `zod`, rendered with shadcn `Form`.
4. DB access uses `@supabase/ssr` clients in `src/lib/supabase/`.
5. Tailwind v4 + shadcn (style: `base-nova`, base library: `@base-ui/react`).
6. No blockchain / wallet SDKs — payments are manually verified by **sellers** (admin can override); see migration 015.
7. Never expose `SUPABASE_SERVICE_ROLE_KEY` outside server-only modules.
8. **Schema changes** must go through `supabase/migrations/NNN_*.sql` and be
   applied with `npm run db:migrate` (Supabase Management API, no DB password).
   Never instruct the user to copy/paste SQL into the Dashboard. See
   [`.cursor/rules/migrations.mdc`](./.cursor/rules/migrations.mdc).
9. **Build gate**: `npm run build` must exit 0 before every `git commit`. See
   [`.cursor/rules/git.mdc`](./.cursor/rules/git.mdc).
10. **Dev server lifecycle**: stop the dev server when you're done with it.
    If port 3000 is already in use, run `npm run stop` (or `npm run stop:all`
    for stale 3001/3002) before starting a new one — do **not** fall back to
    another port. Stale instances leak DB sockets and confuse smoke tests.
    Works in Git Bash (MINGW64), cmd, and PowerShell via `netstat` + `taskkill`.
11. **Dev overlay errors are not evidence**: the floating Next.js error badge resets
    on navigation and is invisible to agents. After UI work with `npm run dev`,
    run `npm run qa:check-dev` (reads `.next/dev/logs/next-development.log`, writes
    `dev-errors.latest.txt`). Exit code must be 0 before claiming "done". With
    browser MCP, also call `browser_console_messages` after each navigation.

## Cursor Cloud specific instructions

### Environment

- **Node.js 22** and **npm 10** are pre-installed; no version manager needed.
- All required secrets (Supabase, POE, SMTP, etc.) are injected as environment
  variables. However, `npm run dev` (Next.js Turbopack) reads from `.env.local`,
  not the parent shell env. Before starting the dev server, generate `.env.local`:
  ```bash
  printenv | grep -E '^(NEXT_PUBLIC_|SUPABASE_|POE_|SMTP_|EMAIL_FROM_|SMS_|ADMIN_EMAIL|CRON_SECRET|PLATFORM_|PHONE_OTP_)' | grep -v 'CLOUD_AGENT' > .env.local
  ```
- The update script (`npm install`) handles dependency refresh on startup.

### Running the dev server

```bash
npm run dev          # starts on port 3000 (Turbopack)
```

First compilation takes ~6 s; subsequent page navigations compile on-demand.
If port 3000 is occupied, find the PID (`lsof -ti :3000`) and kill it — never
use an alternate port.

### Key commands

| Purpose | Command |
|---------|---------|
| Lint | `npm run lint` |
| Build (mandatory before commit) | `npm run build` |
| Dev server | `npm run dev` |
| Migration status | `npm run db:migrate:status` |
| Regenerate DB types | `npm run db:types` |
| QA preflight (build + schema) | `npm run qa:preflight` |
| Dev log errors | `npm run qa:check-dev` |

### Caveats

- **Lint has pre-existing warnings/errors** in `docs/oldSite/` (legacy JS files)
  and a few React hooks purity warnings in `src/hooks/`. These are not blockers
  for commits — only `npm run build` exit 0 is the hard gate.
- **No local database** — all data goes through Supabase Cloud. Smoke tests
  (`scripts/smoke-*.mjs`, `scripts/qa-*.mjs`) hit the remote Supabase project
  directly using `SUPABASE_SERVICE_ROLE_KEY`.
- **Test accounts** (see `docs/TESTING.md` §1): admin/seller/buyer all use
  password `a1234567` with Gmail aliases `eric.chang.1015+{admin,seller,buyer}@gmail.com`.
- **`.env.local` is gitignored** — do not commit it. Regenerate it each session.
