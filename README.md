# Mada Graphite Platform

B2B graphite trading platform connecting global buyers with Madagascar
sellers. Built on Next.js 16 (App Router) + Supabase + Tailwind v4 + shadcn/ui.

## Quick start

1. Copy environment file:

   ```powershell
   Copy-Item .env.example .env.local
   # Fill in your Supabase / Anthropic / Resend keys
   ```

2. Install dependencies (already done if cloned with `node_modules/`):

   ```powershell
   npm install
   ```

3. Provision the Supabase project:
   - Create a project at https://supabase.com
   - Open SQL Editor → paste the contents of
     [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql)
   - Run

4. Run the dev server:

   ```powershell
   npm run dev
   ```

5. Open http://localhost:3000

## Documentation

- [`.cursorrules`](./.cursorrules) — coding rules for AI agents (start here)
- [`AGENTS.md`](./AGENTS.md) — quick reference for any AI tool
- [`docs/PRD.md`](./docs/PRD.md) — product requirements
- [`docs/SCHEMA.md`](./docs/SCHEMA.md) — database schema
- [`docs/CONTRACT_TEMPLATE.md`](./docs/CONTRACT_TEMPLATE.md) — sales contract template
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — 2-day MVP delivery plan
- [`docs/LEGACY_CONTENT.md`](./docs/LEGACY_CONTENT.md) — content from old static site
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
  middleware.ts         Route guards
supabase/
  migrations/           Versioned SQL
docs/                   PRD / schema / templates / roadmap / requirements
```

## Status

🏗️ MVP scaffold (Day 0) is complete:

- [x] Next.js 16 + Tailwind v4 + shadcn/ui base-nova
- [x] All core dependencies installed
- [x] `.cursorrules` + `.cursor/rules/*.mdc`
- [x] PRD / SCHEMA / CONTRACT_TEMPLATE / ROADMAP / LEGACY_CONTENT
- [x] Initial SQL migration with full schema, enums, RLS, seed data
- [x] Supabase client/server/admin/middleware skeletons
- [x] Server Action stubs with zod schemas
- [x] Route group skeletons for public / auth / app / admin
- [x] Theme tokens for graphite dark + gold accent

Next: follow [`docs/ROADMAP.md`](./docs/ROADMAP.md).
