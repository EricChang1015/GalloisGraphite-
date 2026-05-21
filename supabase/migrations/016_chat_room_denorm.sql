-- =====================================================================
-- 016_chat_room_denorm.sql
--
-- Denormalize last message metadata on chat_rooms for cheap room lists,
-- enforce one order room per order, and backfill existing orders/messages.
-- =====================================================================

alter table public.chat_rooms
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_preview text;

create unique index if not exists idx_chat_rooms_order_unique
  on public.chat_rooms (order_id)
  where type = 'order' and order_id is not null;

-- Backfill chat rooms for orders that do not have one yet.
do $$
declare
  r record;
  new_room_id uuid;
begin
  for r in
    select o.id, o.buyer_id, o.seller_id
      from public.orders o
     where not exists (
       select 1
         from public.chat_rooms cr
        where cr.order_id = o.id
          and cr.type = 'order'
     )
  loop
    insert into public.chat_rooms (type, order_id)
    values ('order', r.id)
    returning id into new_room_id;

    insert into public.chat_members (room_id, user_id)
    values (new_room_id, r.buyer_id), (new_room_id, r.seller_id)
    on conflict do nothing;
  end loop;
end $$;

-- Backfill last_message_* from existing messages.
update public.chat_rooms cr
   set last_message_at = sub.last_at,
       last_message_preview = left(sub.preview, 120)
  from (
    select distinct on (m.room_id)
           m.room_id,
           m.created_at as last_at,
           coalesce(nullif(trim(m.content), ''), '[Attachment]') as preview
      from public.messages m
     order by m.room_id, m.created_at desc
  ) sub
 where cr.id = sub.room_id
   and cr.last_message_at is null;
