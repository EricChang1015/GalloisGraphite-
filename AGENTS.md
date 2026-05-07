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

- `docs/PRD.md` — product requirements
- `docs/SCHEMA.md` — database schema rationale
- `docs/CONTRACT_TEMPLATE.md` — graphite sales contract template
- `docs/ROADMAP.md` — 2-day MVP delivery plan
- `docs/LEGACY_CONTENT.md` — content migrated from old static madagraphite.com
- `supabase/migrations/` — SQL migrations (run in Supabase SQL editor)
- `.env.example` — required environment variables

## Top rules (TL;DR)

1. Server Components by default, `"use client"` only when interactivity is needed.
2. Mutations use Server Actions in `src/actions/*`, not API routes.
3. Forms use `react-hook-form` + `zod`, rendered with shadcn `Form`.
4. DB access uses `@supabase/ssr` clients in `src/lib/supabase/`.
5. Tailwind v4 + shadcn (style: `base-nova`, base library: `@base-ui/react`).
6. No blockchain / wallet SDKs — payments are manually verified by admins.
7. Never expose `SUPABASE_SERVICE_ROLE_KEY` outside server-only modules.
