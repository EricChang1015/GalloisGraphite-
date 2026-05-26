-- 025_listings_delete_policy.sql
-- Fix: listings had RLS enabled but no DELETE policy. The misnamed
-- "listings_owner_update_delete" policy only covered UPDATE, so sellers
-- saw "Listing deleted." while PostgREST silently deleted 0 rows.

drop policy if exists "listings_owner_delete" on public.listings;
create policy "listings_owner_delete" on public.listings
  for delete using (
    seller_id = auth.uid()
    or public.current_user_role() in ('admin', 'super_admin')
  );
