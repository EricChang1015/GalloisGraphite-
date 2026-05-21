-- =====================================================================
-- 018_party_chat.sql
-- One thread per user pair (party_user_low < party_user_high).
-- Merges legacy type=order rooms into party rooms.
-- =====================================================================

alter table public.chat_rooms
  add column if not exists party_user_low uuid references public.profiles(id) on delete cascade,
  add column if not exists party_user_high uuid references public.profiles(id) on delete cascade;

alter table public.messages
  add column if not exists context_type public.chat_message_context_type,
  add column if not exists context_id uuid;

drop index if exists public.idx_chat_rooms_order_unique;

create unique index if not exists idx_chat_rooms_party_pair
  on public.chat_rooms (party_user_low, party_user_high)
  where type = 'party'
    and party_user_low is not null
    and party_user_high is not null;

-- Merge order-linked rooms into party rooms
do $$
declare
  r record;
  v_low uuid;
  v_high uuid;
  v_party uuid;
begin
  for r in
    select cr.id as room_id, o.buyer_id, o.seller_id
      from public.chat_rooms cr
      join public.orders o on o.id = cr.order_id
     where cr.type = 'order'
       and o.buyer_id is not null
       and o.seller_id is not null
  loop
    if r.buyer_id::text < r.seller_id::text then
      v_low := r.buyer_id;
      v_high := r.seller_id;
    else
      v_low := r.seller_id;
      v_high := r.buyer_id;
    end if;

    select id into v_party
      from public.chat_rooms
     where type = 'party'
       and party_user_low = v_low
       and party_user_high = v_high
     limit 1;

    if v_party is null then
      insert into public.chat_rooms (type, party_user_low, party_user_high)
      values ('party', v_low, v_high)
      returning id into v_party;

      insert into public.chat_members (room_id, user_id)
      values (v_party, v_low), (v_party, v_high)
      on conflict do nothing;
    end if;

    update public.messages set room_id = v_party where room_id = r.room_id;

    delete from public.chat_members where room_id = r.room_id;
    delete from public.chat_rooms where id = r.room_id;
  end loop;
end $$;

-- Storage: party/{room_id}/... attachments for DM without an order
drop policy if exists "order-documents:party read members" on storage.objects;
drop policy if exists "order-documents:party insert members" on storage.objects;

create policy "order-documents:party read members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and (storage.foldername(name))[1] = 'party'
    and exists (
      select 1
        from public.chat_members m
       where m.room_id::text = (storage.foldername(name))[2]
         and m.user_id = auth.uid()
    )
  );

create policy "order-documents:party insert members"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-documents'
    and (storage.foldername(name))[1] = 'party'
    and exists (
      select 1
        from public.chat_members m
       where m.room_id::text = (storage.foldername(name))[2]
         and m.user_id = auth.uid()
    )
  );
