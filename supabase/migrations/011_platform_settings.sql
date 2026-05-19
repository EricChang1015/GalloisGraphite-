-- =====================================================================
-- 011_platform_settings.sql — Admin-togglable platform settings (SMS, etc.)
-- =====================================================================

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default 'false'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.platform_settings (key, value)
values ('sms_notifications_enabled', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings_admin_select" on public.platform_settings;
create policy "platform_settings_admin_select" on public.platform_settings
  for select using (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "platform_settings_admin_write" on public.platform_settings;
create policy "platform_settings_admin_write" on public.platform_settings
  for all using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
