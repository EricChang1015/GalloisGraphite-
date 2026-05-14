-- =====================================================================
-- 006_b2b_progress_enums.sql
--
-- 純 enum 變更，必須與 007_b2b_progress_tables.sql 分開 commit。
-- 原因：PostgreSQL `alter type ... add value` 可以放在 transaction 內，
-- 但同一 transaction 內無法立即使用新值，否則會 error
-- "unsafe use of new value of enum type"。
-- Supabase CLI / supabase-js 會把每個 migration 檔案包成單一 transaction，
-- 所以新增 enum 值與「使用該值（建表 / alter column default）」必須拆成兩個檔案。
--
-- 本檔案 idempotent，可重跑。
-- =====================================================================


-- ---------- 新增 enum 型別 -------------------------------------------
do $$ begin
  create type quotation_status as enum (
    'sent','countered','accepted','rejected','expired','superseded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_terms_type as enum (
    'full_prepay','net_after_arrival'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum (
    'contract_signed_buyer','contract_signed_seller',
    'proforma_invoice','commercial_invoice','packing_list',
    'bill_of_lading','coa_sgs','cert_of_origin','insurance_policy',
    'customs_declaration','payment_proof','inspection_report','other'
  );
exception when duplicate_object then null; end $$;


-- ---------- order_status 擴充 + rename --------------------------------
-- 注意：rename value 必須在 add value 之前（因為 add value 用 'after / before'
-- 參考既有值定位；rename 後位置不變）。

-- 1. rename signed → contract_signed
do $$ begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'order_status' and e.enumlabel = 'signed'
  )
  and not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'order_status' and e.enumlabel = 'contract_signed'
  )
  then
    alter type order_status rename value 'signed' to 'contract_signed';
  end if;
end $$;

-- 2. rename delivered → customs_cleared
do $$ begin
  if exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'order_status' and e.enumlabel = 'delivered'
  )
  and not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'order_status' and e.enumlabel = 'customs_cleared'
  )
  then
    alter type order_status rename value 'delivered' to 'customs_cleared';
  end if;
end $$;

-- 3. add new values（以 if not exists 確保 idempotent）
alter type order_status add value if not exists 'quotation_pending' before 'draft';
alter type order_status add value if not exists 'quoted' after 'draft';
alter type order_status add value if not exists 'negotiating' after 'quoted';
alter type order_status add value if not exists 'contract_pending' after 'negotiating';
alter type order_status add value if not exists 'in_production' after 'paid';
alter type order_status add value if not exists 'ready_to_ship' after 'in_production';
alter type order_status add value if not exists 'in_transit' after 'shipped';
alter type order_status add value if not exists 'arrived' after 'in_transit';


-- ---------- inquiry_status 擴充 -------------------------------------
alter type inquiry_status add value if not exists 'quoted' after 'pending';
alter type inquiry_status add value if not exists 'negotiating' after 'quoted';
alter type inquiry_status add value if not exists 'expired' after 'rejected';


-- =====================================================================
-- 完成。請接著執行 007_b2b_progress_tables.sql
-- =====================================================================
