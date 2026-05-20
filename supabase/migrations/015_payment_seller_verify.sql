-- =====================================================================
-- 015_payment_seller_verify.sql
--
-- Payment 審核責任移轉:
--   - 過去 (001 + 005): payments 只有 admin 可 update (verify/reject)
--   - 改動後: payment 由 seller 主審, admin 仍保留覆審/介入能力
--
-- 變更:
--   1. 取代 "payments_admin_update" -> "payments_seller_or_admin_update"
--      seller (透過 orders.seller_id) 與 admin/super_admin 都能 update
--   2. 索引: 加 payments(buyer_id, status) 與 payments(order_id, status)
--      (admin/seller 都會 by status='pending' filter,加速 sidebar badge 查詢)
--
-- 本檔案 idempotent。
-- =====================================================================

-- ---------- 重建 payments update policy -----------------------------
drop policy if exists "payments_admin_update" on public.payments;
drop policy if exists "payments_seller_or_admin_update" on public.payments;

create policy "payments_seller_or_admin_update" on public.payments
  for update using (
    public.current_user_role() in ('admin', 'super_admin')
    or exists (
      select 1 from public.orders o
       where o.id = payments.order_id
         and o.seller_id = auth.uid()
    )
  ) with check (
    public.current_user_role() in ('admin', 'super_admin')
    or exists (
      select 1 from public.orders o
       where o.id = payments.order_id
         and o.seller_id = auth.uid()
    )
  );


-- ---------- 索引: 加速 pending payment 查詢 --------------------------
create index if not exists idx_payments_status_pending
  on public.payments (status)
  where status = 'pending';

create index if not exists idx_payments_order_status
  on public.payments (order_id, status);
