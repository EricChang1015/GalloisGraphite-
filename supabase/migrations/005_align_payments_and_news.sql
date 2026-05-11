-- =====================================================================
-- 005_align_payments_and_news.sql
--
-- 對齊代碼／TS types 與 001_init.sql 的不一致：
--
--   payments：
--     - 將 payer_id rename 為 buyer_id（代碼一律使用 buyer_id）
--     - 新增 admin_note / reviewed_by / reviewed_at 欄位
--     - verified_by / verified_at 保留以避免破壞既有資料；新代碼一律寫 reviewed_*
--     - 重建 RLS policy 與索引以使用 buyer_id
--
--   news：
--     - 新增 author_id（upsertNews server action 寫入此欄位）
--
--   orders：
--     - 新增 updated_at + trigger（server action 寫入 updated_at）
--
-- 本檔案 idempotent，可以安全重跑。
-- =====================================================================


-- ---------- payments：rename payer_id → buyer_id ---------------------
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'payments'
       and column_name  = 'payer_id'
  )
  and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'payments'
       and column_name  = 'buyer_id'
  )
  then
    alter table public.payments rename column payer_id to buyer_id;
  end if;
end $$;

-- 若兩個欄位都存在（部分環境曾手動 add column），把 payer_id 的資料 backfill 到 buyer_id 再 drop
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'payments' and column_name = 'payer_id'
  )
  and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'payments' and column_name = 'buyer_id'
  )
  then
    update public.payments set buyer_id = payer_id where buyer_id is null and payer_id is not null;
    alter table public.payments drop column payer_id;
  end if;
end $$;

-- 確保 buyer_id 為 not null
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'payments'
       and column_name  = 'buyer_id' and is_nullable = 'YES'
  ) then
    alter table public.payments alter column buyer_id set not null;
  end if;
end $$;


-- ---------- payments：新增 admin_note / reviewed_by / reviewed_at ----
alter table public.payments
  add column if not exists admin_note  text,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz;

-- 若舊環境有 verified_by / verified_at 資料，把它複製到 reviewed_*
do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'payments' and column_name = 'verified_by'
  ) then
    update public.payments
       set reviewed_by = coalesce(reviewed_by, verified_by),
           reviewed_at = coalesce(reviewed_at, verified_at)
     where verified_by is not null or verified_at is not null;
  end if;
end $$;


-- ---------- payments：重建 RLS policy（改用 buyer_id） ---------------
drop policy if exists "payments_buyer_insert" on public.payments;
create policy "payments_buyer_insert" on public.payments
  for insert with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = order_id and o.buyer_id = auth.uid()
    )
  );

-- payments_select_parties 與 payments_admin_update 不依賴 payer_id，無需重建。


-- ---------- news：新增 author_id -------------------------------------
alter table public.news
  add column if not exists author_id uuid references public.profiles(id);

create index if not exists idx_news_author on public.news (author_id);


-- ---------- orders：新增 updated_at + trigger -----------------------
alter table public.orders
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_touch_updated_at on public.orders;
create trigger trg_orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- 順手把同樣需要的 contracts 也加上（contracts 沒有 updated_at 欄位）
alter table public.contracts
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_contracts_touch_updated_at on public.contracts;
create trigger trg_contracts_touch_updated_at
  before update on public.contracts
  for each row execute function public.touch_updated_at();


-- =====================================================================
-- 完成。執行後記得重新生成 TS types：
--
--   npx supabase gen types typescript \
--     --project-id YOUR_PROJECT_REF --schema public > src/types/database.ts
-- =====================================================================
