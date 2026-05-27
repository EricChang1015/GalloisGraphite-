-- =====================================================================
-- 028_profile_locale.sql
--
-- 新增 profiles.locale 欄位以記錄使用者的 UI 語言偏好。
--
-- 解析順序（執行於 src/i18n/get-locale.ts）：
--   cookie `mg-locale`  > profiles.locale > Accept-Language > 'en'
--
-- 第一階段支援 'en' 與 'zh-CN'（簡體中文）。未來新增 zh-TW / ja / fr / de
-- 時：先 DROP 既有 check，再 ADD 包含新值的 check。
--
-- 範圍限制：合約 (contract) 與系統 email/SMS 通知不論 locale 為何皆維持
-- 英文輸出（業務決策，參 docs/I18N_PLAN.md）。本欄位僅影響登入後 UI。
--
-- 本檔案 idempotent，可重跑。
-- =====================================================================

alter table public.profiles
  add column if not exists locale text not null default 'en';

-- 重建 check 以便未來新增語系時可以直接複用此 idempotent 區塊。
do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conname = 'profiles_locale_check'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_locale_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('en', 'zh-CN'));

comment on column public.profiles.locale is
  'UI language preference. Resolution order: mg-locale cookie > profiles.locale > Accept-Language header > en. Contract HTML and email/SMS notifications always render English regardless of this value.';
