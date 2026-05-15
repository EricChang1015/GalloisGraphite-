-- =====================================================================
-- 009_b2b_progress_tables.sql
--
-- 接續 007_b2b_progress_enums.sql：建立 quotations / order_documents
-- 表，擴充 orders / contracts 欄位，補上 RLS 政策。
--
-- 本檔案 idempotent，可重跑。
-- =====================================================================


-- ---------- 1. quotations 表 ----------------------------------------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references public.inquiries(id) on delete cascade,
  parent_quotation_id uuid references public.quotations(id) on delete set null,
  seller_id uuid not null references public.profiles(id),
  buyer_id uuid not null references public.profiles(id),
  listing_id uuid references public.listings(id) on delete set null,

  -- 報價內容
  unit_price numeric(18,4) not null check (unit_price > 0),
  currency text not null,
  quantity numeric(18,3) not null check (quantity > 0),
  unit text not null default 'MT',
  incoterm text not null,                 -- FOB / CFR / CIF
  origin_port text,
  destination_port text,
  validity_until timestamptz not null,
  specs_confirmed jsonb not null default '{}'::jsonb,
  shipping_window_from date,
  shipping_window_to date,
  notes text,

  -- 狀態
  status quotation_status not null default 'sent',
  countered_by uuid references public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotations_inquiry_status on public.quotations (inquiry_id, status);
create index if not exists idx_quotations_buyer on public.quotations (buyer_id);
create index if not exists idx_quotations_seller on public.quotations (seller_id);


-- ---------- 2. order_documents 表 -----------------------------------
create table if not exists public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type document_type not null,
  file_url text not null,
  file_name text,
  file_size_bytes int,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  admin_note text,
  is_required boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_order_documents_order_type on public.order_documents (order_id, type);


-- ---------- 3. orders 欄位擴充（運輸 + 付款條件） ---------------------
alter table public.orders
  add column if not exists payment_terms       payment_terms_type,
  add column if not exists payment_due_days    int,
  add column if not exists payment_due_date    date,
  add column if not exists vessel_name         text,
  add column if not exists vessel_imo          text,
  add column if not exists container_numbers   text[],
  add column if not exists bl_no               text,
  add column if not exists bl_date             date,
  add column if not exists etd                 date,
  add column if not exists atd                 date,
  add column if not exists ata                 date,
  add column if not exists customs_cleared_at  timestamptz,
  add column if not exists current_quotation_id uuid references public.quotations(id) on delete set null;


-- ---------- 4. contracts 欄位擴充（合約審核回合制） -------------------
alter table public.contracts
  add column if not exists revision_no         int not null default 1,
  add column if not exists buyer_approved_at   timestamptz,
  add column if not exists buyer_rejected_at   timestamptz,
  add column if not exists buyer_reject_reason text,
  add column if not exists payment_terms       payment_terms_type,
  add column if not exists payment_due_days    int;


-- ---------- 5. RLS：quotations --------------------------------------
alter table public.quotations enable row level security;

drop policy if exists "quotations_select_parties" on public.quotations;
create policy "quotations_select_parties" on public.quotations
  for select using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or public.current_user_role() in ('admin','super_admin')
  );

-- 賣家可發 quotation；買家可發 counter quotation
drop policy if exists "quotations_parties_insert" on public.quotations;
create policy "quotations_parties_insert" on public.quotations
  for insert with check (
    (auth.uid() = seller_id and public.current_user_role() in ('seller','admin','super_admin'))
    or (auth.uid() = buyer_id and public.current_user_role() in ('buyer','admin','super_admin'))
  );

-- 任一方可更新自己參與的 quotation 狀態（accept / reject / expire）；admin 全權
drop policy if exists "quotations_parties_update" on public.quotations;
create policy "quotations_parties_update" on public.quotations
  for update using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or public.current_user_role() in ('admin','super_admin')
  ) with check (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or public.current_user_role() in ('admin','super_admin')
  );


-- ---------- 6. RLS：order_documents ---------------------------------
alter table public.order_documents enable row level security;

drop policy if exists "order_documents_select_parties" on public.order_documents;
create policy "order_documents_select_parties" on public.order_documents
  for select using (
    exists (
      select 1 from public.orders o
       where o.id = order_documents.order_id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "order_documents_parties_insert" on public.order_documents;
create policy "order_documents_parties_insert" on public.order_documents
  for insert with check (
    uploaded_by = auth.uid()
    and (
      exists (
        select 1 from public.orders o
         where o.id = order_documents.order_id
           and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
      )
      or public.current_user_role() in ('admin','super_admin')
    )
  );

-- uploader 可在 1 小時內撤回；admin 隨時可改（驗證）
drop policy if exists "order_documents_uploader_or_admin_update" on public.order_documents;
create policy "order_documents_uploader_or_admin_update" on public.order_documents
  for update using (
    (uploaded_by = auth.uid() and uploaded_at > now() - interval '1 hour')
    or public.current_user_role() in ('admin','super_admin')
  ) with check (
    (uploaded_by = auth.uid() and uploaded_at > now() - interval '1 hour')
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "order_documents_uploader_delete" on public.order_documents;
create policy "order_documents_uploader_delete" on public.order_documents
  for delete using (
    (uploaded_by = auth.uid() and uploaded_at > now() - interval '1 hour' and verified_by is null)
    or public.current_user_role() in ('admin','super_admin')
  );


-- =====================================================================
-- 完成。執行後重新生成 TS types：
--
--   npx supabase gen types typescript \
--     --project-id YOUR_PROJECT_REF --schema public > src/types/database.ts
-- =====================================================================
