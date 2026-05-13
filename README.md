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

3. Provision the Supabase project:
   - Create a project at <https://supabase.com>
   - Open SQL Editor → run each migration in
     [`supabase/migrations/`](./supabase/migrations/) **in order** (`001` → `007`)
   - Follow [`002_seed_first_admin.sql`](./supabase/migrations/002_seed_first_admin.sql)
     to promote the first user to `super_admin`
   - Regenerate TS types:
     `npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts`

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
- [`docs/SCHEMA.md`](./docs/SCHEMA.md) — database schema rationale (post-006 migration)
- [`docs/AI_PROMPT.md`](./docs/AI_PROMPT.md) — **AI assistant prompt & FAQ maintenance guide** (start here when changing AI behaviour)
- [`docs/CONTRACT_TEMPLATE.md`](./docs/CONTRACT_TEMPLATE.md) — sales contract template
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — remaining MVP gaps + Phase 2 plan
- [`docs/LEGACY_CONTENT.md`](./docs/LEGACY_CONTENT.md) — content from old static site
- [`docs/COPY_DRAFTS.md`](./docs/COPY_DRAFTS.md) — marketing copy drafts
- [`docs/Requirements.md`](./docs/Requirements.md) — original requirement memo

## Project layout

```
src/
  app/
    (public)/           Marketing pages: /, /about, /products, /news, /chat
    (auth)/             /login /register /verify
    (app)/              Authenticated app: dashboard / market / listings / inquiries / orders / messages
    admin/              /admin/* — role-gated
    api/chat/           Streaming AI endpoint
  actions/              Server Actions (auth, listing, inquiry, order, payment, admin)
  components/
    ui/                 shadcn/ui (auto-generated, base-nova style)
    layout/             Navbar / Footer / Sidebar
    chat/ listing/ order/ admin/   (TBD per Day 1/2 prompts)
  lib/
    supabase/           client / server / admin / middleware
    ai/                 prompt + knowledge for the assistant
    contract/           HTML renderer
    email/              Resend wrapper
  types/                Database types (regenerate with supabase gen types)
  proxy.ts              Route guards (Next.js 16 renamed middleware.ts → proxy.ts)
  app/auth/callback/    OAuth code-exchange route handler
supabase/
  migrations/           Versioned SQL (001 → 007, run in order)
docs/                   ARCHITECTURE / PRD / SCHEMA / ROADMAP / CONTRACT_TEMPLATE / LEGACY_CONTENT
```

## Status

🚀 Day 1–2 MVP core features delivered and deployed to
<https://galloisgraphite.vercel.app/>.

Implemented:

- [x] Next.js 16 (App Router, `proxy.ts`) + Tailwind v4 + shadcn/ui base-nova
- [x] Supabase Auth + Postgres + RLS (migrations 001 → 007)
- [x] Schema alignment migration `005_align_payments_and_news.sql` (payments
      `buyer_id` / `admin_note` / `reviewed_*`, `news.author_id`,
      `orders.updated_at` trigger)
- [x] AI chat audit log `006_ai_chat_logs.sql` (session_id / IP / geo /
      User-Agent + admin-only RLS)
- [x] Public marketing pages (Home / About / Products / News / Geopolitics /
      Sustainability) + AI Chat (POE-backed)
- [x] Floating AI assistant on every page (public + app), FAQ-aware prompt,
      multi-session browser history, and server-side audit logging
      (see [`docs/AI_PROMPT.md`](./docs/AI_PROMPT.md))
- [x] Auth flow with **email/password + Google OAuth** (register / login /
      email verify); OAuth users land directly as `status='active'` with
      `role='buyer'` (see `007_oauth_profile_handling.sql`)
- [x] Seller listings (create / pause / resume)
- [x] Buyer market + inquiry → order conversion
- [x] Order state machine (draft → completed) with timeline append
- [x] Contract HTML rendering + manual payment review by admin
- [x] Admin Console (users / categories / orders / payments / news)
- [x] Audit log for all admin mutations + Resend email notifications
- [x] Three themes (light / dark / editorial)

Remaining for full MVP launch — see [`docs/ROADMAP.md`](./docs/ROADMAP.md) §A:

- [ ] A2 — In-app IM (`OrderChat`, auto room creation, `/messages` list)
- [ ] A3 — Contract signed-scan upload UI
- [ ] A4 — Storage buckets + policies migration
- [ ] A5 — Disputed / Cancelled trigger UI
- [ ] A6 — KYC document upload
- [ ] A7 — Production smoke test end-to-end
