-- =====================================================================
-- 007_oauth_profile_handling.sql
--
-- 讓 handle_new_user() 同時支援：
--   1. 既有 email/password 註冊（meta 內含 full_name / company_name /
--      country / role）— 行為不變，status 仍進 'pending' 等 email 驗證。
--   2. Google OAuth（meta 內只有 name / avatar_url，沒有 company_name /
--      country / role）— role 預設 'buyer'、缺漏欄位留空、由於 Google
--      已驗證 email，auth.users.email_confirmed_at 在 INSERT 當下即非
--      null，因此 profile 直接落 'active'，不需要等 email_confirmed
--      trigger。
--
-- 一般用戶（瀏覽 / 用 AI Chat）不需要 company_name / country。
-- 後續 commercial actions（inquiry / listing / payment）會在 server
-- action 入口檢查欄位是否補齊（屬下一輪工作，見 ROADMAP §A6）。
--
-- 此 migration idempotent，可重跑。
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_company_name text;
  v_country text;
  v_role user_role;
  v_status user_status;
begin
  v_full_name := coalesce(
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    ''
  );

  v_company_name := coalesce(nullif(meta->>'company_name', ''), '');
  v_country      := coalesce(nullif(meta->>'country', ''), '');

  begin
    v_role := coalesce(
      nullif(meta->>'role', '')::user_role,
      'buyer'::user_role
    );
  exception when invalid_text_representation then
    v_role := 'buyer'::user_role;
  end;

  -- OAuth 提供方（Google 等）會直接帶確認時間進來；email 註冊則為 null。
  v_status := case
    when new.email_confirmed_at is not null then 'active'::user_status
    else 'pending'::user_status
  end;

  insert into public.profiles (id, email, full_name, company_name, country, role, status)
  values (new.id, new.email, v_full_name, v_company_name, v_country, v_role, v_status)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- handle_user_email_confirmed 不需動：
--   - email signup 流程：INSERT 時 email_confirmed_at 為 null → status='pending'
--     → 使用者點驗證信 → UPDATE 把 email_confirmed_at 設好 → trigger 啟動
--       把 status 改為 'active'。
--   - OAuth 流程：INSERT 時 email_confirmed_at 已非 null → status 一開始就
--     是 'active'，handle_user_email_confirmed 不會再被觸發（無 UPDATE）。
