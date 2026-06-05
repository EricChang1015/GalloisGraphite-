-- =====================================================================
-- 031_mine_photos.sql
--
-- CMS tables + public storage bucket for mining-site photo galleries.
-- Categories and photos are admin-managed; public read via RLS.
--
-- Storage path convention (enforced by server actions):
--   mine-photos/{category_slug}/{photo_id}/full.jpg
--   mine-photos/{category_slug}/{photo_id}/thumb.webp
-- =====================================================================

-- 1. Tables --------------------------------------------------------------

create table if not exists public.mine_photo_categories (
  id            uuid primary key default gen_random_uuid(),
  legacy_cid    int unique,
  slug          text not null unique,
  title_en      text not null,
  title_zh_cn   text not null default '',
  cover_url     text,
  sort_order    int not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_mine_photo_categories_sort
  on public.mine_photo_categories (sort_order, created_at);

create table if not exists public.mine_photos (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null references public.mine_photo_categories (id) on delete cascade,
  thumb_url           text not null,
  full_url            text not null,
  storage_path_thumb  text not null,
  storage_path_full   text not null,
  alt_en              text not null default '',
  alt_zh_cn           text not null default '',
  sort_order          int not null default 0,
  is_published        boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_mine_photos_category_sort
  on public.mine_photos (category_id, sort_order, created_at);

-- Seed the six legacy categories (photos imported separately).
insert into public.mine_photo_categories (legacy_cid, slug, title_en, title_zh_cn, sort_order)
values
  (1, 'general-view',       'General View of the Mine',                              '矿山全景',           1),
  (2, 'processing-plant',   'Processing Plant',                                      '加工厂',             2),
  (3, 'warehouse-lab',      'Final Products Warehouse + Laboratory (Quality Control)', '成品仓库 + 实验室', 3),
  (4, 'team-culture',       'Our Team + Corporate Cultural Activities',              '团队与文化活动',     4),
  (5, 'social-responsibility', 'Social Responsibilities',                          '社会责任',           5),
  (6, 'local-customs',      'Local Customs and Practices',                           '当地风俗与实践',     6)
on conflict (slug) do update set
  legacy_cid   = excluded.legacy_cid,
  title_en     = excluded.title_en,
  title_zh_cn  = excluded.title_zh_cn,
  sort_order   = excluded.sort_order;

-- 2. RLS -----------------------------------------------------------------

alter table public.mine_photo_categories enable row level security;
alter table public.mine_photos enable row level security;

revoke all on table public.mine_photo_categories from anon, authenticated;
revoke all on table public.mine_photos from anon, authenticated;

drop policy if exists "mine_photo_categories:public read published" on public.mine_photo_categories;
create policy "mine_photo_categories:public read published"
  on public.mine_photo_categories for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "mine_photo_categories:admin all" on public.mine_photo_categories;
create policy "mine_photo_categories:admin all"
  on public.mine_photo_categories for all
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "mine_photos:public read published" on public.mine_photos;
create policy "mine_photos:public read published"
  on public.mine_photos for select
  to anon, authenticated
  using (
    is_published = true
    and exists (
      select 1 from public.mine_photo_categories c
       where c.id = category_id and c.is_published = true
    )
  );

drop policy if exists "mine_photos:admin all" on public.mine_photos;
create policy "mine_photos:admin all"
  on public.mine_photos for all
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

-- 3. Storage bucket ------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mine-photos',
  'mine-photos',
  true,
  5 * 1024 * 1024, -- 5 MiB per object (1920×1080 JPEG + thumb WebP)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mine-photos:public read"  on storage.objects;
drop policy if exists "mine-photos:admin insert" on storage.objects;
drop policy if exists "mine-photos:admin update" on storage.objects;
drop policy if exists "mine-photos:admin delete" on storage.objects;

create policy "mine-photos:public read"
  on storage.objects for select
  using (bucket_id = 'mine-photos');

create policy "mine-photos:admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'mine-photos'
    and public.current_user_role() in ('admin', 'super_admin')
  );

create policy "mine-photos:admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'mine-photos'
    and public.current_user_role() in ('admin', 'super_admin')
  )
  with check (
    bucket_id = 'mine-photos'
    and public.current_user_role() in ('admin', 'super_admin')
  );

create policy "mine-photos:admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'mine-photos'
    and public.current_user_role() in ('admin', 'super_admin')
  );
