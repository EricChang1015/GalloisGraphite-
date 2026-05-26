-- =====================================================================
-- 027_quotations_created_by.sql
--
-- 修正報價回合制中「誰提出這份 quotation」的歸屬。
--
-- 背景：
--   `countered_by` 之前被當成「誰回覆了這份 quotation」（responder），
--   但 UI 與 server-side 校驗誤把它當成「誰建立這份 quotation」（creator），
--   導致：
--     1. 「Round #N · by seller/buyer」標籤在 buyer 反提時誤顯示成 seller
--     2. 提案人自己看得到 Accept / Counter / Decline 按鈕，可以接受／拒絕
--        自己提出的報價
--   詳見 docs/ARCHITECTURE.md §quotation 流程修正紀錄。
--
-- 解決：新增 `created_by`（明確記錄提案人）並 backfill 既有資料：
--   - 沒有 parent → 第一份報價總是賣家提出，creator = seller_id
--   - 有 parent → 反提者 = parent.countered_by（賣家或買家皆可），
--                 fallback 至 seller_id 以避免遺漏
--
-- 本檔案 idempotent，可重跑。
-- =====================================================================

alter table public.quotations
  add column if not exists created_by uuid references public.profiles(id);

-- ---- Backfill: 推算每筆既有 quotation 的提案人 -----------------------
update public.quotations q
   set created_by = coalesce(
         q.created_by,
         case
           when q.parent_quotation_id is null then q.seller_id
           else (
             select p.countered_by
               from public.quotations p
              where p.id = q.parent_quotation_id
           )
         end,
         q.seller_id
       )
 where q.created_by is null;

-- ---- 把欄位設成 not null，防止未來忘了帶 ------------------------------
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'quotations'
       and column_name = 'created_by'
       and is_nullable = 'YES'
  ) then
    alter table public.quotations alter column created_by set not null;
  end if;
end $$;

create index if not exists idx_quotations_created_by
  on public.quotations (created_by);

comment on column public.quotations.created_by is
  'Profile id of whoever proposed this quotation. For the initial offer this is always the seller; for counter-offers this is the party who countered the parent quotation.';
