-- =====================================================================
-- Mada Graphite Platform — Initial schema
--   * 在 Supabase SQL Editor 直接貼上整段執行
--   * 後續變更請新增 002_xxx.sql、003_xxx.sql ...
-- =====================================================================

-- ---------- ENUM TYPES ------------------------------------------------
do $$ begin
  create type user_role as enum ('buyer', 'seller', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('pending', 'active', 'frozen');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('active', 'paused', 'sold_out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inquiry_status as enum ('pending', 'accepted', 'rejected', 'converted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'draft',
    'contract_generated',
    'signed',
    'payment_pending',
    'paid',
    'shipped',
    'delivered',
    'completed',
    'disputed',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum (
    'usdt_trc20',
    'usdt_erc20',
    'usdi',
    'mup',
    'bank_transfer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chat_type as enum ('order', 'support', 'ai');
exception when duplicate_object then null; end $$;


-- ---------- profiles --------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  company_name text,
  country text,
  phone text,
  role user_role not null default 'buyer',
  status user_status not null default 'pending',
  kyc_level int not null default 0,
  kyc_docs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 自動同步 auth.users 變化(註冊時建 profile)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company_name, country, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'company_name', ''),
    coalesce(new.raw_user_meta_data->>'country', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 確認郵箱後 status -> active
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and (old.email_confirmed_at is null) then
    update public.profiles
       set status = 'active', updated_at = now()
     where id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update on auth.users
  for each row execute function public.handle_user_email_confirmed();


-- ---------- product_categories ----------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  spec_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);


-- ---------- listings --------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.product_categories(id),
  title text not null,
  specs jsonb not null default '{}'::jsonb,
  quantity numeric(18, 3) not null check (quantity > 0),
  unit text not null default 'MT',
  origin_location text not null,
  available_from date,
  available_to date,
  unit_price numeric(18, 4) not null check (unit_price > 0),
  currency text not null default 'USDT',
  incoterm text not null default 'CFR',
  description text,
  images jsonb not null default '[]'::jsonb,
  status listing_status not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_listings_category_status on public.listings (category_id, status);
create index if not exists idx_listings_seller on public.listings (seller_id);


-- ---------- inquiries -------------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  category_id uuid not null references public.product_categories(id),
  requested_qty numeric(18, 3) not null check (requested_qty > 0),
  target_price numeric(18, 4),
  destination text,
  message text,
  status inquiry_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_inquiries_buyer on public.inquiries (buyer_id);
create index if not exists idx_inquiries_seller on public.inquiries (seller_id);


-- ---------- orders ----------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null
    default ('ORD-' || to_char(now(),'YYMMDD') || '-' || substr(md5(random()::text), 1, 6)),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  listing_id uuid not null references public.listings(id),
  inquiry_id uuid references public.inquiries(id) on delete set null,
  quantity numeric(18, 3) not null check (quantity > 0),
  unit_price numeric(18, 4) not null check (unit_price > 0),
  total_amount numeric(18, 4) not null check (total_amount > 0),
  currency text not null,
  destination text,
  shipment_from text,
  shipment_eta date,
  status order_status not null default 'draft',
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_buyer_status on public.orders (buyer_id, status);
create index if not exists idx_orders_seller_status on public.orders (seller_id, status);


-- ---------- contracts -------------------------------------------------
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  contract_no text not null,
  content_html text,
  pdf_url text,
  buyer_signed_url text,
  seller_signed_url text,
  buyer_signed_at timestamptz,
  seller_signed_at timestamptz,
  created_at timestamptz not null default now()
);


-- ---------- payments --------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payer_id uuid not null references public.profiles(id),
  method payment_method not null,
  amount numeric(18, 4) not null check (amount > 0),
  currency text not null,
  tx_hash text,
  proof_url text,
  note text,
  status payment_status not null default 'pending',
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments (order_id, status);


-- ---------- chat ------------------------------------------------------
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  type chat_type not null,
  order_id uuid references public.orders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  room_id uuid references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (room_id, user_id),
  joined_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_room_time on public.messages (room_id, created_at desc);


-- ---------- news ------------------------------------------------------
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text,
  source_url text,
  image_url text,
  published_at timestamptz default now(),
  is_published boolean not null default false
);


-- ---------- audit_logs ------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.product_categories enable row level security;
alter table public.listings enable row level security;
alter table public.inquiries enable row level security;
alter table public.orders enable row level security;
alter table public.contracts enable row level security;
alter table public.payments enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.news enable row level security;
alter table public.audit_logs enable row level security;

-- helper: 取得當前 user role
create or replace function public.current_user_role()
returns user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- profiles RLS ---------------------------------------------
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));


-- ---------- product_categories RLS -----------------------------------
drop policy if exists "categories_select_active" on public.product_categories;
create policy "categories_select_active" on public.product_categories
  for select using (is_active = true or public.current_user_role() in ('admin','super_admin'));

drop policy if exists "categories_admin_all" on public.product_categories;
create policy "categories_admin_all" on public.product_categories
  for all using (public.current_user_role() in ('admin','super_admin'))
  with check (public.current_user_role() in ('admin','super_admin'));


-- ---------- listings RLS ---------------------------------------------
drop policy if exists "listings_select_active_or_owner" on public.listings;
create policy "listings_select_active_or_owner" on public.listings
  for select using (
    status = 'active'
    or seller_id = auth.uid()
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "listings_seller_insert" on public.listings;
create policy "listings_seller_insert" on public.listings
  for insert with check (
    seller_id = auth.uid()
    and public.current_user_role() in ('seller','admin','super_admin')
  );

drop policy if exists "listings_owner_update_delete" on public.listings;
create policy "listings_owner_update_delete" on public.listings
  for update using (
    seller_id = auth.uid()
    or public.current_user_role() in ('admin','super_admin')
  ) with check (
    seller_id = auth.uid()
    or public.current_user_role() in ('admin','super_admin')
  );


-- ---------- inquiries RLS --------------------------------------------
drop policy if exists "inquiries_select_parties" on public.inquiries;
create policy "inquiries_select_parties" on public.inquiries
  for select using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "inquiries_buyer_insert" on public.inquiries;
create policy "inquiries_buyer_insert" on public.inquiries
  for insert with check (auth.uid() = buyer_id);

drop policy if exists "inquiries_parties_update" on public.inquiries;
create policy "inquiries_parties_update" on public.inquiries
  for update using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or public.current_user_role() in ('admin','super_admin')
  );


-- ---------- orders RLS -----------------------------------------------
drop policy if exists "orders_select_parties" on public.orders;
create policy "orders_select_parties" on public.orders
  for select using (
    auth.uid() = buyer_id
    or auth.uid() = seller_id
    or public.current_user_role() in ('admin','super_admin')
  );

-- 訂單建立透過 server action(service role)處理,這裡僅給 admin 直接寫入權限
drop policy if exists "orders_admin_write" on public.orders;
create policy "orders_admin_write" on public.orders
  for all using (public.current_user_role() in ('admin','super_admin'))
  with check (public.current_user_role() in ('admin','super_admin'));


-- ---------- contracts RLS --------------------------------------------
drop policy if exists "contracts_select_parties" on public.contracts;
create policy "contracts_select_parties" on public.contracts
  for select using (
    exists (
      select 1 from public.orders o
       where o.id = contracts.order_id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    or public.current_user_role() in ('admin','super_admin')
  );


-- ---------- payments RLS ---------------------------------------------
drop policy if exists "payments_select_parties" on public.payments;
create policy "payments_select_parties" on public.payments
  for select using (
    exists (
      select 1 from public.orders o
       where o.id = payments.order_id
         and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
    )
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "payments_buyer_insert" on public.payments;
create policy "payments_buyer_insert" on public.payments
  for insert with check (
    payer_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = order_id and o.buyer_id = auth.uid()
    )
  );

drop policy if exists "payments_admin_update" on public.payments;
create policy "payments_admin_update" on public.payments
  for update using (public.current_user_role() in ('admin','super_admin'))
  with check (public.current_user_role() in ('admin','super_admin'));


-- ---------- chat RLS -------------------------------------------------
drop policy if exists "chat_rooms_select_members" on public.chat_rooms;
create policy "chat_rooms_select_members" on public.chat_rooms
  for select using (
    exists (
      select 1 from public.chat_members m
       where m.room_id = chat_rooms.id and m.user_id = auth.uid()
    )
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "chat_members_select_self" on public.chat_members;
create policy "chat_members_select_self" on public.chat_members
  for select using (user_id = auth.uid() or public.current_user_role() in ('admin','super_admin'));

drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members" on public.messages
  for select using (
    exists (
      select 1 from public.chat_members m
       where m.room_id = messages.room_id and m.user_id = auth.uid()
    )
    or public.current_user_role() in ('admin','super_admin')
  );

drop policy if exists "messages_insert_members" on public.messages;
create policy "messages_insert_members" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_members m
       where m.room_id = messages.room_id and m.user_id = auth.uid()
    )
  );


-- ---------- news RLS --------------------------------------------------
drop policy if exists "news_select_published" on public.news;
create policy "news_select_published" on public.news
  for select using (is_published = true or public.current_user_role() in ('admin','super_admin'));

drop policy if exists "news_admin_all" on public.news;
create policy "news_admin_all" on public.news
  for all using (public.current_user_role() in ('admin','super_admin'))
  with check (public.current_user_role() in ('admin','super_admin'));


-- ---------- audit_logs RLS -------------------------------------------
drop policy if exists "audit_admin_select" on public.audit_logs;
create policy "audit_admin_select" on public.audit_logs
  for select using (public.current_user_role() in ('admin','super_admin'));


-- =====================================================================
-- REALTIME — 開放 messages 表訂閱
-- =====================================================================
alter publication supabase_realtime add table public.messages;


-- =====================================================================
-- SEED 資料(預設品類 + 對應舊站規格)
-- =====================================================================
insert into public.product_categories (name, description, spec_schema)
values
  (
    'MADA1 Flake Graphite',
    'High-grade natural flake graphite for spherical graphite (Li-ion battery anode), expandable graphite, and high purity graphite.',
    jsonb_build_object(
      'fixed_carbon', '94-99%',
      'mesh_options', jsonb_build_array('+35','+50','+80','+100','+150','-100'),
      'moisture', '0.5% max',
      'origin', 'Madagascar'
    )
  ),
  (
    'MADA2 Flake Graphite',
    'Industrial-grade flake graphite for refractories, metallurgy, crucibles, sealing materials, etc.',
    jsonb_build_object(
      'fixed_carbon', '80-94%',
      'mesh_options', jsonb_build_array('+35','+50','+80','+100','+150','-100'),
      'moisture', '0.5% max',
      'origin', 'Madagascar'
    )
  ),
  (
    'Expandable Graphite',
    'Intumescent flake graphite for fire-proofing, gaskets and graphite foil.',
    jsonb_build_object(
      'expansion_volume_ml_g', '>= 250',
      'fixed_carbon', '>= 96%',
      'particle_size_mesh', '+50 / +80'
    )
  )
on conflict do nothing;
