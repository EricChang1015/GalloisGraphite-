-- 017: enum values for party-based DM (split file — used in 018)

alter type public.chat_type add value if not exists 'party';

do $$
begin
  create type public.chat_message_context_type as enum ('listing', 'inquiry', 'order');
exception
  when duplicate_object then null;
end $$;
