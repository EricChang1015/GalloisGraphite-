-- =====================================================================
-- 006_ai_chat_logs.sql
--
-- Persist every AI assistant turn (user prompt + assistant response) for
-- audit, abuse review, and prompt-tuning purposes.
--
--   - Client generates a 10-byte random session_id (20 hex chars) and keeps
--     it in localStorage; it is forwarded to /api/chat via the
--     `x-mada-session` header.
--   - Server reads sessionId, IP, geo (Vercel headers) and User-Agent, then
--     writes one row per role using the service-role admin client.
--   - Only admin / super_admin can read.
--   - No update / delete policies; treat the table as append-only audit
--     trail. Use a scheduled SQL job to TTL-delete rows older than N days.
--
-- Idempotent — safe to rerun.
-- =====================================================================

create table if not exists public.ai_chat_logs (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null,
  user_id       uuid references public.profiles(id) on delete set null,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  ip            inet,
  country       text,
  region        text,
  city          text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ai_chat_logs_session
  on public.ai_chat_logs (session_id, created_at);
create index if not exists idx_ai_chat_logs_user
  on public.ai_chat_logs (user_id, created_at desc);
create index if not exists idx_ai_chat_logs_created
  on public.ai_chat_logs (created_at desc);

alter table public.ai_chat_logs enable row level security;

-- Reads: admin / super_admin only.
drop policy if exists "ai_chat_logs_admin_select" on public.ai_chat_logs;
create policy "ai_chat_logs_admin_select" on public.ai_chat_logs
  for select using (
    public.current_user_role() in ('admin', 'super_admin')
  );

-- No insert/update/delete policies — server writes via service_role,
-- bypassing RLS by design. Anonymous and authenticated clients have no
-- direct access to this table.

-- =====================================================================
-- Run after applying:
--   npx supabase gen types typescript \
--     --project-id YOUR_PROJECT_REF --schema public > src/types/database.ts
-- =====================================================================
