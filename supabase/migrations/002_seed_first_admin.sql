-- =====================================================================
-- 002_seed_first_admin.sql
--
-- 如何建立第一個 Super Admin：
--
-- 方法 1 (推薦): 在 Supabase Dashboard 執行此 SQL
--   1. 先到 /register 正常註冊帳號並確認 Email
--   2. 到 Supabase Dashboard → SQL Editor，把下面 UPDATE 的 email 換成你的帳號並執行
--
-- 方法 2: Authentication → Users 找到 user id → Table Editor → profiles → 編輯 role 欄位
-- =====================================================================

-- 把 YOUR_ADMIN_EMAIL 換成你的帳號 email，執行後即可用 /login 以 admin 身份登入
UPDATE public.profiles
   SET role   = 'super_admin',
       status = 'active',
       updated_at = now()
 WHERE email = 'YOUR_ADMIN_EMAIL@example.com';

-- 確認是否成功
SELECT id, email, role, status FROM public.profiles WHERE role IN ('admin', 'super_admin');
