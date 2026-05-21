-- =====================================================================
-- 019_kyc_storage_and_settings.sql
-- KYC document bucket, platform min-level gates, prevent self kyc_level bump
-- =====================================================================

insert into public.platform_settings (key, value)
values
  ('kyc_min_level_inquiry', '0'::jsonb),
  ('kyc_min_level_listing', '0'::jsonb)
on conflict (key) do nothing;

-- Private bucket: {user_id}/{doc_type}/{uuid}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc',
  'kyc',
  false,
  5 * 1024 * 1024,
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kyc:read owner or admin" on storage.objects;
drop policy if exists "kyc:insert owner" on storage.objects;
drop policy if exists "kyc:delete owner or admin" on storage.objects;

create policy "kyc:read owner or admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'kyc'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'super_admin')
    )
  );

create policy "kyc:insert owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'kyc'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc:delete owner or admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'kyc'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'super_admin')
    )
  );

-- Users may update their own profile row but cannot self-promote kyc_level.
create or replace function public.profiles_guard_kyc_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.kyc_level is distinct from old.kyc_level then
    if public.current_user_role() not in ('admin', 'super_admin') then
      new.kyc_level := old.kyc_level;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_kyc_level on public.profiles;
create trigger trg_profiles_guard_kyc_level
  before update on public.profiles
  for each row
  execute function public.profiles_guard_kyc_level();
