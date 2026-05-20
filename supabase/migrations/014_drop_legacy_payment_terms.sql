-- =====================================================================
-- 014_drop_legacy_payment_terms.sql
--
-- Hard cutover: remove the legacy full_prepay / net_after_arrival
-- branching from orders + contracts. Going forward, payment is modelled
-- as multiple installments in `payment_schedules` (see 013).
--
-- Strategy:
--   1. Truncate test orders / contracts / payments / quotations /
--      inquiries / payment_schedules so legacy rows can't break code
--      paths that no longer understand payment_terms.
--   2. Drop the now-unused columns on orders + contracts.
--   3. Leave `payment_terms_type` enum and `order_status`'s
--      `payment_pending` / `paid` / `draft` / `contract_generated`
--      enum values in place — PostgreSQL doesn't support `alter type
--      drop value`. They become dormant: no code path produces them,
--      timeline history is rendered via STATUS_LABEL fallback.
--
-- This file is idempotent and may be re-run.
-- =====================================================================


-- ---------- 1. clear test/transactional data -------------------------
-- Order of deletes follows FK dependencies. Inquiries are kept for
-- now so users can still see their negotiation history; but quotations
-- are wiped because new orders use a different payment-schedule shape
-- and old quotations no longer have parity.

truncate table public.payment_schedules cascade;
truncate table public.payments cascade;
truncate table public.order_documents cascade;
truncate table public.contracts cascade;
truncate table public.orders cascade;
truncate table public.quotations cascade;


-- ---------- 2. drop legacy payment-terms columns ---------------------

alter table public.orders
  drop column if exists payment_terms,
  drop column if exists payment_due_days,
  drop column if exists payment_due_date;

alter table public.contracts
  drop column if exists payment_terms,
  drop column if exists payment_due_days;


-- ---------- 3. document deprecated enum values -----------------------
-- PostgreSQL has no DROP VALUE for enum types. These enum values stay
-- in place but are no longer produced by application code:
--   * order_status.draft               (legacy pre-quotation state)
--   * order_status.contract_generated  (replaced by contract_pending)
--   * order_status.payment_pending     (payment is now off-timeline)
--   * order_status.paid                (payment is now off-timeline)
--   * payment_terms_type               (entire type — no live FK left)
--
-- The state machine in src/lib/order/stateMachine.ts no longer allows
-- transitions into these states. STATUS_LABEL still maps them so
-- historical timeline entries render correctly.
--
-- If a future migration ever needs to remove them, follow the standard
-- "create new enum -> migrate columns -> drop old enum" pattern.


-- =====================================================================
-- Done. Run `npm run db:types` after applying to refresh generated TS.
-- =====================================================================
