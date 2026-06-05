-- =====================================================================
-- 033_mine_photo_cover_photo_id.sql
--
-- Category cover is selected from an existing gallery photo (no separate upload).
-- =====================================================================

alter table public.mine_photo_categories
  add column if not exists cover_photo_id uuid references public.mine_photos (id) on delete set null;

create index if not exists idx_mine_photo_categories_cover_photo
  on public.mine_photo_categories (cover_photo_id)
  where cover_photo_id is not null;

-- Backfill: first photo per category (lowest sort_order) becomes cover when unset.
update public.mine_photo_categories c
set cover_photo_id = sub.id,
    cover_url = coalesce(c.cover_url, sub.thumb_url)
from (
  select distinct on (p.category_id)
    p.category_id,
    p.id,
    p.thumb_url
  from public.mine_photos p
  order by p.category_id, p.sort_order asc, p.created_at asc
) sub
where c.id = sub.category_id
  and c.cover_photo_id is null;
