-- =====================================================================
-- 012_listings_categories_order_party_read.sql
-- Let buyers/sellers read listings + categories tied to their orders even
-- when a listing is paused/sold_out or a category is deactivated.
-- Without this, PostgREST embeds on /orders/[id] can return 0 rows → 404.
-- =====================================================================

drop policy if exists "listings_select_order_parties" on public.listings;
create policy "listings_select_order_parties" on public.listings
  for select using (
    exists (
      select 1
        from public.orders o
       where o.listing_id = listings.id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    or public.current_user_role() in ('admin', 'super_admin')
  );

drop policy if exists "categories_select_order_parties" on public.product_categories;
create policy "categories_select_order_parties" on public.product_categories
  for select using (
    exists (
      select 1
        from public.orders o
        join public.listings l on l.id = o.listing_id
       where l.category_id = product_categories.id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    or public.current_user_role() in ('admin', 'super_admin')
  );
