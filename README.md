# Mada Graphite Platform

B2B graphite trading platform connecting global buyers with Madagascar
sellers. Built on Next.js 16 (App Router) + Supabase + Tailwind v4 + shadcn/ui.

## Links

- **Production (Vercel)**: <https://galloisgraphite.vercel.app/>
- **Legacy static site**: <http://madagraphite.com/> (the original brochure
  site this platform is replacing; preserved for content reference under
  [`docs/oldSite/`](./docs/oldSite/) and summarised in
  [`docs/LEGACY_CONTENT.md`](./docs/LEGACY_CONTENT.md))

## Quick start

1. Copy environment file:

   ```powershell
   Copy-Item .env.example .env.local
   # Fill in your Supabase / AI API / AWS SES SMTP keys
   ```

2. Install dependencies (already done if cloned with `node_modules/`):

   ```powershell
   npm install
   ```

3. Provision the Supabase project (the runner uses
   [Supabase Management API](https://api.supabase.com) — no DB password
   needed):
   - Create a project at <https://supabase.com>
   - Get a Personal Access Token at
     <https://supabase.com/dashboard/account/tokens> and put it in
     `.env.local` as `SUPABASE_ACCESS_TOKEN=sbp_xxx`
   - Make sure `NEXT_PUBLIC_SUPABASE_URL` is also set in `.env.local`
   - For a **fresh DB** — run all migrations:

     ```powershell
     npm run db:migrate
     ```

   - For an **existing DB** that was already migrated outside the runner
     (e.g. via Supabase Dashboard SQL Editor) — register the current files
     as applied without re-executing them:

     ```powershell
     npm run db:migrate:bootstrap
     ```

   - Inspect tracking state any time with:

     ```powershell
     npm run db:migrate:status
     ```

   - Follow [`002_seed_first_admin.sql`](./supabase/migrations/002_seed_first_admin.sql)
     to promote the first user to `super_admin`
   - Regenerate TS types after schema changes:

     ```powershell
     npm run db:types
     ```

4. Run the dev server:

   ```powershell
   npm run dev
   ```

5. Open http://localhost:3000

## Documentation

- [`.cursorrules`](./.cursorrules) — coding rules for AI agents (start here)
- [`AGENTS.md`](./AGENTS.md) — quick reference for any AI tool
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — **current implemented architecture**
- [`docs/PRD.md`](./docs/PRD.md) — product requirements (with implementation status)
- [`docs/SCHEMA.md`](./docs/SCHEMA.md) — database schema rationale (post-027 migration)
- [`docs/AI_PROMPT.md`](./docs/AI_PROMPT.md) — **AI assistant prompt & FAQ maintenance guide** (start here when changing AI behaviour)
- [`docs/CONTRACT_TEMPLATE.md`](./docs/CONTRACT_TEMPLATE.md) — sales contract template
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — remaining MVP gaps + Phase 2 plan
- [`docs/TESTING.md`](./docs/TESTING.md) — test accounts + end-to-end walkthrough scripts
- [`docs/LEGACY_CONTENT.md`](./docs/LEGACY_CONTENT.md) — content from old static site
- [`docs/COPY_DRAFTS.md`](./docs/COPY_DRAFTS.md) — marketing copy drafts
- [`docs/Requirements.md`](./docs/Requirements.md) — original requirement memo

## Project layout

```
src/
  app/
    (public)/           Marketing pages: /, /about, /products, /news, /chat,
                        /geopolitics, /sustainability
    (auth)/             /login /register /verify /forgot-password /reset-password
    (app)/              Authenticated app: dashboard / market / listings /
                        inquiries / orders / messages
    admin/              /admin/* — role-gated
    api/chat/           Streaming AI endpoint
    auth/callback/      OAuth code-exchange route handler
  actions/              Server Actions (admin, auth, document, inquiry,
                        listing, order, payment, quotation)
  components/
    ui/                 shadcn/ui (auto-generated, base-nova style)
    layout/             Navbar / Footer / Sidebar
    home/ auth/ listing/ order/ admin/ chat/ theme/
  lib/
    supabase/           client / server / admin / middleware
    ai/                 prompt + knowledge + market context for the assistant
    contract/           HTML renderer
    email/              AWS SES SMTP wrapper (nodemailer)
    order/              12-stage state machine + payment_schedules
    validations/        zod schemas
  types/                Database types (regenerate with `npm run db:types`)
  proxy.ts              Route guards (Next.js 16 renamed middleware.ts → proxy.ts)
scripts/
  apply-migrations.mjs  Auto-apply Supabase migrations via Management API
  gen-types.mjs         Regenerate src/types/database.ts
  seed-test-order.mjs   Seed a `contract_pending` order between test buyer/seller
  q.mjs                 One-shot Supabase query helper (for smoke tests)
supabase/
  migrations/           Versioned SQL (001 → 027, run via `npm run db:migrate`)
docs/                   ARCHITECTURE / PRD / SCHEMA / ROADMAP / TESTING /
                        AI_PROMPT / CONTRACT_TEMPLATE / LEGACY_CONTENT /
                        COPY_DRAFTS / Requirements
```

## Status

🚀 MVP core features delivered and deployed to
<https://galloisgraphite.vercel.app/>. Full-prepay and installment (30/70)
end-to-end paths verified (see [`docs/TESTING.md`](./docs/TESTING.md)).

**Documentation hierarchy** (avoid stale copies):

| File | Role |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | **Implementation truth** — routes, actions, state machine |
| [`docs/SCHEMA.md`](./docs/SCHEMA.md) | DB schema after migrations 001–027 |
| [`docs/PRD.md`](./docs/PRD.md) | Product requirements + ✅/🟡 status |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Remaining MVP gaps + Phase 2 |

Implemented (high level):

- [x] Next.js 16 (`proxy.ts`) + Tailwind v4 + shadcn base-nova
- [x] Supabase Auth + Postgres + RLS (**migrations 001 → 027**)
- [x] B2B trade: quotation negotiation → 12-stage order + **`payment_schedules`** (seller-primary payment review)
- [x] Storage: `order-documents`, `avatars`, `kyc`, `listings` (+ client 720p WebP compress)
- [x] Party DM (`/messages`) + Realtime; KYC 4-level + `/settings/kyc`
- [x] Listing edit/delete, MOQ, structured flake-graphite categories
- [x] AWS SES SMTP notifications + optional SMS; AI chat with audit logs
- [x] E2E smoke: `npm run qa:a7`, `qa:chat`, `qa:kyc`, etc.

**Remaining for full MVP** — see [`docs/ROADMAP.md`](./docs/ROADMAP.md) §A Definition of Done:

- [ ] A2 — Order-detail embedded chat (optional); **`chat` Storage bucket** + message attachments
- [ ] (Phase 2) AI logged-in tools, i18n, PDF renderer, Sentry, etc.
