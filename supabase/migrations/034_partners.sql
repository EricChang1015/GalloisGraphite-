-- =====================================================================
-- 034_partners.sql
--
-- Home page partner logos — admin-managed, icons in `partners` storage bucket.
-- =====================================================================

create table if not exists public.partners (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  href          text not null default '',
  icon_url      text,
  storage_path  text,
  sort_order    int not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_partners_sort
  on public.partners (sort_order, created_at);

alter table public.partners enable row level security;

revoke all on table public.partners from anon, authenticated;
grant select on table public.partners to anon, authenticated;

drop policy if exists "partners:public read published" on public.partners;
create policy "partners:public read published"
  on public.partners for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "partners:admin all" on public.partners;
create policy "partners:admin all"
  on public.partners for all
  to authenticated
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

insert into public.partners (slug, name, href, sort_order)
values
  ('vesuvius', 'Vesuvius', 'https://www.vesuvius.com/en/index.html', 1),
  ('amg-graphite-gk', 'AMG Graphite GK', 'https://www.maaxlubritech.com/amg-graphite-gk/', 2),
  ('asbury', 'Asbury', 'https://www.asbury.com/', 3),
  ('minchem-impex', 'Minchem Impex', 'https://minchem.in/', 4),
  ('sgl-carbon', 'SGL Carbon', 'https://www.sglcarbon.com/', 5),
  ('krosaki-harima', 'Krosaki Harima', 'https://www.krosaki.co.jp/en', 6),
  ('rhi-magnesita', 'RHI Magnesita', 'https://www.rhimagnesita.com/', 7),
  ('gmi', 'GMI', 'https://www.graphitemachininginc.com/', 8),
  ('superior-graphite', 'Superior Graphite', 'https://superiorgraphite.com/', 9),
  ('morgan-advanced-materials', 'Morgan Advanced Materials', 'https://www.morganadvancedmaterials.com/', 10),
  ('cgm', 'CGM', 'https://www.cgmgraphite.com/', 11),
  ('zircar-refractories', 'Zircar Refractories', 'https://zircarrefractories.in/', 12),
  ('aug-gundlach', 'Aug. Gundlach', 'https://www.aug-gundlach.de/', 13),
  ('agc-ppl', 'AGC PPL', '', 14),
  ('unimex', 'UNIMEX', 'https://unimextr.com/', 15)
on conflict (slug) do nothing;

-- Storage bucket ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partners',
  'partners',
  true,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "partners:public read"  on storage.objects;
drop policy if exists "partners:admin insert" on storage.objects;
drop policy if exists "partners:admin update" on storage.objects;
drop policy if exists "partners:admin delete" on storage.objects;

create policy "partners:public read"
  on storage.objects for select
  using (bucket_id = 'partners');

create policy "partners:admin insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'partners'
    and public.current_user_role() in ('admin', 'super_admin')
  );

create policy "partners:admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'partners'
    and public.current_user_role() in ('admin', 'super_admin')
  )
  with check (
    bucket_id = 'partners'
    and public.current_user_role() in ('admin', 'super_admin')
  );

create policy "partners:admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'partners'
    and public.current_user_role() in ('admin', 'super_admin')
  );
