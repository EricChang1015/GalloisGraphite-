-- =====================================================================
-- 032_mine_photos_grants.sql
--
-- 031 revoked ALL from anon/authenticated but omitted GRANT SELECT.
-- RLS policies cannot take effect without base table privileges.
-- =====================================================================

grant select on table public.mine_photo_categories to anon, authenticated;
grant select on table public.mine_photos to anon, authenticated;
