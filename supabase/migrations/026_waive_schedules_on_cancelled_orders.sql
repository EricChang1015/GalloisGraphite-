-- 026_waive_schedules_on_cancelled_orders.sql
-- Backfill: cancelled orders should not keep due/overdue installments or
-- pending payment reviews that ping buyers/sellers as "action needed".

update public.payment_schedules ps
   set status = 'waived',
       updated_at = now()
  from public.orders o
 where ps.order_id = o.id
   and o.status = 'cancelled'
   and ps.status not in ('paid', 'waived');

update public.payments p
   set status = 'rejected',
       admin_note = coalesce(p.admin_note, 'Auto-rejected: order cancelled.')
  from public.orders o
 where p.order_id = o.id
   and o.status = 'cancelled'
   and p.status = 'pending';
