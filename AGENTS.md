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
- `docs/SCHEMA.md` — database schema rationale (post-010 migration)
- `docs/AI_PROMPT.md` — AI assistant prompt & FAQ maintenance guide
- `docs/ROADMAP.md` — remaining MVP gaps + Phase 2 plan
- `docs/TESTING.md` — **QA process** + test accounts + B2B E2E walkthrough (payment_schedules)
- `docs/CONTRACT_TEMPLATE.md` — graphite sales contract template
- `docs/LEGACY_CONTENT.md` — content migrated from old static madagraphite.com
- `docs/COPY_DRAFTS.md` — marketing copy drafts
- `supabase/migrations/` — SQL migrations (currently 001 → 021)
- `.cursor/rules/migrations.mdc` — **migration authoring rules** (read before writing SQL)
- `.env.example` — required environment variables

## Top rules (TL;DR)

1. Server Components by default, `"use client"` only when interactivity is needed.
2. Mutations use Server Actions in `src/actions/*`, not API routes.
3. Forms use `react-hook-form` + `zod`, rendered with shadcn `Form`.
4. DB access uses `@supabase/ssr` clients in `src/lib/supabase/`.
5. Tailwind v4 + shadcn (style: `base-nova`, base library: `@base-ui/react`).
6. No blockchain / wallet SDKs — payments are manually verified by admins.
7. Never expose `SUPABASE_SERVICE_ROLE_KEY` outside server-only modules.
8. **Schema changes** must go through `supabase/migrations/NNN_*.sql` and be
   applied with `npm run db:migrate` (Supabase Management API, no DB password).
   Never instruct the user to copy/paste SQL into the Dashboard. See
   [`.cursor/rules/migrations.mdc`](./.cursor/rules/migrations.mdc).
9. **Build gate**: `npm run build` must exit 0 before every `git commit`. See
   [`.cursor/rules/git.mdc`](./.cursor/rules/git.mdc).
10. **Dev server lifecycle**: stop the dev server when you're done with it.
    If port 3000 is already in use, *stop / kill the existing process* before
    starting a new one — do **not** fall back to another port. Stale 3001/3002
    instances leak DB sockets and confuse smoke tests. On Windows:
    `Get-NetTCPConnection -LocalPort 3000 | Select OwningProcess` then
    `Stop-Process -Id <pid> -Force`.
