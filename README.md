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
   # Fill in your Supabase / AI API / Resend keys
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
- [`docs/SCHEMA.md`](./docs/SCHEMA.md) — database schema rationale (post-010 migration)
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
    email/              Resend wrapper
    order/              13-stage state machine
    validations/        zod schemas
  types/                Database types (regenerate with `npm run db:types`)
  proxy.ts              Route guards (Next.js 16 renamed middleware.ts → proxy.ts)
scripts/
  apply-migrations.mjs  Auto-apply Supabase migrations via Management API
  gen-types.mjs         Regenerate src/types/database.ts
  seed-test-order.mjs   Seed a `contract_pending` order between test buyer/seller
  q.mjs                 One-shot Supabase query helper (for smoke tests)
supabase/
  migrations/           Versioned SQL (001 → 010, run via `npm run db:migrate`)
docs/                   ARCHITECTURE / PRD / SCHEMA / ROADMAP / TESTING /
                        AI_PROMPT / CONTRACT_TEMPLATE / LEGACY_CONTENT /
                        COPY_DRAFTS / Requirements
```

## Status

🚀 Day 1–2 MVP core features delivered and deployed to
<https://galloisgraphite.vercel.app/>. Full-prepay end-to-end happy path
verified through Completed on 2026-05-15 (see [`docs/TESTING.md`](./docs/TESTING.md)).

Implemented:

- [x] Next.js 16 (App Router, `proxy.ts`) + Tailwind v4 + shadcn/ui base-nova
- [x] Supabase Auth + Postgres + RLS (migrations 001 → 010)
- [x] Auto-apply migration runner via Supabase Management API
      (`npm run db:migrate`) — see
      [`.cursor/rules/migrations.mdc`](./.cursor/rules/migrations.mdc)
- [x] Schema alignment migration `005_align_payments_and_news.sql` (payments
      `buyer_id` / `admin_note` / `reviewed_*`, `news.author_id`,
      `orders.updated_at` trigger)
- [x] AI chat audit log `006_ai_chat_logs.sql` (session_id / IP / geo /
      User-Agent + admin-only RLS)
- [x] **B2B 13-stage trade workflow** with `quotations` negotiation,
      `order_documents` hub, contract revision tracking, dual payment
      branches (`full_prepay` / `net_after_arrival`), and vessel /
      B/L tracking (`007_b2b_progress_enums.sql` +
      `009_b2b_progress_tables.sql` + `src/lib/order/stateMachine.ts`)
- [x] **`order-documents` Supabase Storage bucket** + RLS for signed
      contract scans, payment proofs, invoices, B/L and customs docs
      (`010_storage_order_documents.sql`)
- [x] Public marketing pages (Home / About / Products / News / Geopolitics /
      Sustainability) + AI Chat (POE-backed)
- [x] Floating AI assistant on every page (public + app), FAQ-aware prompt,
      multi-session browser history, and server-side audit logging
      (see [`docs/AI_PROMPT.md`](./docs/AI_PROMPT.md))
- [x] **Auth flow**: email/password (with verify) + Google OAuth + forgot /
      reset password (Google users can attach an email/password identity
      via the recovery flow → dual login on one account)
      — see `008_oauth_profile_handling.sql` and
      `src/actions/auth.ts` (`requestPasswordReset` / `updatePassword`)
- [x] Seller listings (create / pause / resume)
- [x] Buyer market + inquiry → quotation negotiation → order conversion
- [x] **Order state machine** (13 stages, dual payment branches) with
      contract draft / approve / re-draft, signed-scan upload, payment
      proof upload, shipment (B/L + vessel + container), arrival,
      customs cleared, completed; plus disputed / cancelled / admin
      force-transition
- [x] **Contract rendering**: HTML preview inlines both signed scans
      (image or PDF), "Download signed contract" injects them into the
      printable PDF output
- [x] **Payment**: tx_hash for crypto, `proof_url` upload for
      bank_transfer / USDI / MUP; admin verify auto-advances order per
      payment branch
- [x] Admin Console (users / categories / orders / payments / news +
      `/admin/orders/[id]` force-transition controls)
- [x] Audit log for all admin mutations + Resend email notifications
- [x] Three themes (light / dark / editorial)

Remaining for full MVP launch — see [`docs/ROADMAP.md`](./docs/ROADMAP.md) §A
and [`docs/TESTING.md`](./docs/TESTING.md) §5:

- [ ] A2 — In-app IM (`OrderChat`, auto room creation, `/messages` list)
- [ ] A4 — Remaining storage buckets (`avatars` / `kyc` / `listings` / `chat`)
- [ ] A6 — KYC document upload (commercial profile gate + `/settings`
      page already shipped: server actions return
      `error.code='PROFILE_INCOMPLETE'` and the UI surfaces an
      "Open Settings" toast action)
- [ ] A7 — `net_after_arrival` end-to-end happy path walkthrough +
      `disputed` / `cancelled` / admin force-transition smoke test
