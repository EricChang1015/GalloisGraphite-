-- =====================================================================
-- 030_agent_migrations_rls.sql
--
-- Fix Supabase linter: rls_disabled_in_public on public._agent_migrations.
-- The migration runner (scripts/apply-migrations.mjs) created this table
-- without RLS; PostgREST exposes public.* to anon/authenticated by default.
--
-- No policies: only postgres / service_role (Management API) may access.
-- App code never reads this table via Supabase client.
-- =====================================================================

alter table public._agent_migrations enable row level security;

revoke all on table public._agent_migrations from anon, authenticated;
