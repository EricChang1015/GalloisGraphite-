-- =====================================================================
-- 020_kyc_phone_and_levels.sql
-- KYC levels 0–3, phone verification, OTP challenges, legacy level remap
-- =====================================================================

alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

comment on column public.profiles.phone_verified_at is
  'Set when user completes SMS OTP on profiles.phone (KYC level 1 path).';

-- Legacy: level 1 meant "documents on file" — remap to 0; admins approve to level 2.
update public.profiles
   set kyc_level = 0
 where kyc_level = 1;

alter table public.profiles
  drop constraint if exists profiles_kyc_level_range;

alter table public.profiles
  add constraint profiles_kyc_level_range
  check (kyc_level >= 0 and kyc_level <= 3);

create table if not exists public.phone_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_otp_challenges_user
  on public.phone_otp_challenges (user_id, created_at desc);

alter table public.phone_otp_challenges enable row level security;

-- No policies: only service role (Server Actions) may read/write OTP rows.

-- Users cannot self-set phone_verified_at (same rule family as kyc_level).
create or replace function public.profiles_guard_kyc_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if public.current_user_role() not in ('admin', 'super_admin') then
      if new.kyc_level is distinct from old.kyc_level then
        new.kyc_level := old.kyc_level;
      end if;
      if new.phone_verified_at is distinct from old.phone_verified_at then
        new.phone_verified_at := old.phone_verified_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;
