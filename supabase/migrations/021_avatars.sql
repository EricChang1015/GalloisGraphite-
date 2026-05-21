-- =====================================================================
-- 021_avatars.sql
--
-- Profile avatars:
--   - profiles.avatar_url (Google OAuth meta or uploaded image URL)
--   - public `avatars` storage bucket (self write, public read)
--   - handle_new_user() copies avatar_url from raw_user_meta_data
--   - backfill existing OAuth users from auth.users
--
-- Path convention (AvatarUploader.tsx):
--   <user_id>/avatar.<ext>
--
-- Idempotent.
-- =====================================================================

-- 1. Column --------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;


-- 2. OAuth trigger — include avatar_url ----------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_company_name text;
  v_country text;
  v_avatar_url text;
  v_role user_role;
  v_status user_status;
begin
  v_full_name := coalesce(
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    ''
  );

  v_company_name := coalesce(nullif(meta->>'company_name', ''), '');
  v_country      := coalesce(nullif(meta->>'country', ''), '');
  v_avatar_url   := nullif(meta->>'avatar_url', '');

  begin
    v_role := coalesce(
      nullif(meta->>'role', '')::user_role,
      'buyer'::user_role
    );
  exception when invalid_text_representation then
    v_role := 'buyer'::user_role;
  end;

  v_status := case
    when new.email_confirmed_at is not null then 'active'::user_status
    else 'pending'::user_status
  end;

  insert into public.profiles (
    id, email, full_name, company_name, country, avatar_url, role, status
  )
  values (
    new.id, new.email, v_full_name, v_company_name, v_country, v_avatar_url,
    v_role, v_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


-- 3. Backfill Google / OAuth users already registered --------------------
update public.profiles p
   set avatar_url = nullif(u.raw_user_meta_data->>'avatar_url', ''),
       updated_at = now()
  from auth.users u
 where p.id = u.id
   and p.avatar_url is null
   and nullif(u.raw_user_meta_data->>'avatar_url', '') is not null;


-- 4. Storage bucket ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024, -- 2 MB
  array[
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


-- 5. Storage RLS ---------------------------------------------------------
drop policy if exists "avatars:read public" on storage.objects;
drop policy if exists "avatars:insert self" on storage.objects;
drop policy if exists "avatars:update self" on storage.objects;
drop policy if exists "avatars:delete self" on storage.objects;

-- Public bucket: anyone can read avatar objects (profile photos).
create policy "avatars:read public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars:insert self"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars:update self"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars:delete self"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
