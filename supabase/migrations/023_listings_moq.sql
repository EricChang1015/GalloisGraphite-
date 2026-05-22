-- =====================================================================
-- Listings: minimum order quantity (optional).
--
-- Goal
--   Allow sellers to declare a minimum order quantity (MOQ) per listing
--   without collapsing it into the existing `quantity` column. After 023:
--
--     listings.quantity            — total available stock / batch size
--                                    the seller is offering (required, > 0;
--                                    unchanged from 001_init.sql)
--     listings.min_order_quantity  — smallest cut-off a buyer may request
--                                    (nullable; null = no MOQ)
--
-- The `createInquiry` server action enforces the floor by rejecting any
-- `requested_qty < min_order_quantity` with `error.code='BELOW_MOQ'`.
--
-- Idempotent: column add + constraint drop/add use `if (not) exists`.
-- =====================================================================

alter table public.listings
  add column if not exists min_order_quantity numeric(18, 3);

-- Re-create the positivity check so re-running the migration is safe even
-- if a previous run left a partial constraint.
alter table public.listings
  drop constraint if exists listings_min_order_quantity_positive;

alter table public.listings
  add constraint listings_min_order_quantity_positive
  check (min_order_quantity is null or min_order_quantity > 0);

-- No new index — listings are small and we only filter on MOQ inside the
-- createInquiry guard (after we've already pulled the listing row).

comment on column public.listings.min_order_quantity is
  'Optional minimum order quantity (MOQ). NULL means no floor. createInquiry rejects requested_qty below this value with error.code=BELOW_MOQ.';
