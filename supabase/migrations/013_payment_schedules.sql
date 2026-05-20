-- =====================================================================
-- 013_payment_schedules.sql
--
-- Decouple payment from order timeline by introducing multi-installment
-- payment schedules. Each schedule row represents one installment that
-- becomes "due" when a specific milestone is reached (auto for coarse
-- order-status transitions, manual for fine-grained events such as
-- before_production / bl_received / goods_picked_up, time-based for
-- bl_date_plus_N entries).
--
-- This migration only CREATES new types / table / columns. Removal of
-- the legacy payment_terms columns happens in 014.
--
-- All enums in this file are brand-new (`create type` not `alter type
-- add value`), so they can be used safely inside the same migration
-- transaction.
--
-- This file is idempotent and may be re-run.
-- =====================================================================


-- ---------- 1. ENUMS -------------------------------------------------

do $$ begin
  create type payment_category as enum (
    'prepayment',
    'regular_payment',
    'postpayment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_milestone as enum (
    -- common prepayment milestones
    'contract_signed',
    'before_production',
    'before_shipment',
    'before_loading',

    -- regular payment milestones (incoterm-specific)
    'loaded_onto_vessel',
    'bl_received',
    'shipping_docs_received',
    'bl_plus_insurance_received',

    -- common postpayment milestones
    'arrived_at_port',
    'goods_picked_up',
    'accepted_by_buyer',
    'bl_date_plus_30',
    'bl_date_plus_60',
    'bl_date_plus_90'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_schedule_status as enum (
    'scheduled',      -- not yet triggered
    'due',            -- milestone reached, awaiting buyer payment
    'awaiting_review',-- buyer submitted, admin reviewing
    'paid',           -- admin verified
    'overdue',        -- past due_date, still unpaid
    'waived'          -- cancelled / written off
  );
exception when duplicate_object then null; end $$;


-- ---------- 2. payment_schedules table -------------------------------

create table if not exists public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  -- Ordering within an order; lets UI render in a stable sequence
  sequence int not null default 0,

  category payment_category not null,
  milestone payment_milestone not null,

  -- Percentage of total order amount (sum across order must equal 100)
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),

  -- Snapshot of computed amount (= percentage * order.total_amount / 100)
  -- and currency, captured when the schedule is created so subsequent
  -- order edits don't shift historical figures.
  amount numeric(18,4) not null check (amount >= 0),
  currency text not null,

  -- For bl_date_plus_N milestones: number of days offset. Null otherwise.
  bl_offset_days int check (bl_offset_days is null or bl_offset_days >= 0),

  -- Computed when the milestone is reached (set by server action / cron)
  due_date date,

  status payment_schedule_status not null default 'scheduled',

  -- Once verified, link back to the payments row that settled this
  -- installment. Nullable because schedules start unpaid.
  paid_payment_id uuid references public.payments(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_schedules_order on public.payment_schedules (order_id, sequence);
create index if not exists idx_payment_schedules_status on public.payment_schedules (status);
create index if not exists idx_payment_schedules_due_date on public.payment_schedules (due_date)
  where due_date is not null;


-- ---------- 3. payments.schedule_id ----------------------------------

alter table public.payments
  add column if not exists schedule_id uuid references public.payment_schedules(id) on delete set null;

create index if not exists idx_payments_schedule on public.payments (schedule_id)
  where schedule_id is not null;


-- ---------- 4. orders: incoterm snapshot + milestone timestamps ------

alter table public.orders
  add column if not exists incoterm text,                          -- FOB / CFR / CIF, set when contract is drafted
  add column if not exists before_production_at         timestamptz,
  add column if not exists before_shipment_at           timestamptz,
  add column if not exists before_loading_at            timestamptz,
  add column if not exists loaded_at                    timestamptz,
  add column if not exists bl_received_at               timestamptz,
  add column if not exists shipping_docs_received_at    timestamptz,
  add column if not exists bl_plus_insurance_received_at timestamptz,
  add column if not exists picked_up_at                 timestamptz,
  add column if not exists accepted_at                  timestamptz;


-- ---------- 5. updated_at trigger for payment_schedules --------------

create or replace function public.trg_payment_schedules_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payment_schedules_updated_at on public.payment_schedules;
create trigger trg_payment_schedules_updated_at
  before update on public.payment_schedules
  for each row execute function public.trg_payment_schedules_touch_updated_at();


-- ---------- 6. RLS: payment_schedules --------------------------------

alter table public.payment_schedules enable row level security;

drop policy if exists "payment_schedules_select_parties" on public.payment_schedules;
create policy "payment_schedules_select_parties" on public.payment_schedules
  for select using (
    exists (
      select 1 from public.orders o
       where o.id = payment_schedules.order_id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    or public.current_user_role() in ('admin','super_admin')
  );

-- Inserts / updates / deletes go through server actions using the
-- service-role admin client, so no public insert/update/delete policy
-- is granted. Adding an admin-only update fallback so admins can
-- override status manually through SQL if needed.
drop policy if exists "payment_schedules_admin_update" on public.payment_schedules;
create policy "payment_schedules_admin_update" on public.payment_schedules
  for update using (
    public.current_user_role() in ('admin','super_admin')
  ) with check (
    public.current_user_role() in ('admin','super_admin')
  );


-- =====================================================================
-- Done. After applying, regenerate TS types:
--   npm run db:types
-- Continue with 014_drop_legacy_payment_terms.sql for the cutover.
-- =====================================================================
