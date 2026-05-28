-- =====================================================================
-- 029_news_aggregation.sql
--
-- 新聞聚合系統（Admin 手動觸發抓取 + 多語言翻譯）。
--
-- 重點：
--   • news 增加 status workflow（draft → pending → published / rejected）
--   • 增加 URL hash / title hash 做去重（embedding 留待 Phase 2）
--   • 增加 relevance_score / source_name / fetched_at metadata
--   • 新增 news_translations 表，每篇文章 × 每語言 一列
--     - 預留未來擴語言用，slug 在每語言內 unique
--
-- 與現有 schema 相容：
--   • is_published 仍保留並由 trigger 自動跟 status 同步，
--     讓既有的 /news 公開頁與 isPublished 查詢繼續可用。
--   • author_id 可能為 NULL（自動抓取的稿件沒有作者）
-- =====================================================================


-- ---------- enum: news_status ---------------------------------------
do $$ begin
  create type public.news_status as enum (
    'draft',       -- 手動撰寫但尚未發布
    'pending',     -- 自動抓取後 admin 待審
    'approved',    -- admin 已核准（翻譯/發布前的暫態）
    'published',   -- 已上架
    'rejected'     -- 棄用（保留供未來去重）
  );
exception when duplicate_object then null;
end $$;


-- ---------- news：新增 metadata + workflow columns ------------------
alter table public.news
  add column if not exists status            public.news_status,
  add column if not exists source_name       text,
  add column if not exists url_hash          text,
  add column if not exists title_hash        text,
  add column if not exists relevance_score   numeric(3,2),
  add column if not exists fetched_at        timestamptz,
  add column if not exists fetch_batch_id    uuid,
  add column if not exists language          text not null default 'en',
  add column if not exists rejected_reason   text,
  add column if not exists reviewed_by       uuid references public.profiles(id),
  add column if not exists reviewed_at       timestamptz;

-- Back-fill status from is_published (only for rows that have no status yet)
update public.news
   set status = case when is_published then 'published'::public.news_status
                     else 'draft'::public.news_status end
 where status is null;

alter table public.news
  alter column status set default 'draft',
  alter column status set not null;

-- Unique indexes on hashes — partial so legacy NULLs don't conflict.
create unique index if not exists idx_news_url_hash_unique
  on public.news (url_hash)
  where url_hash is not null;

create unique index if not exists idx_news_title_hash_unique
  on public.news (title_hash)
  where title_hash is not null;

create index if not exists idx_news_status      on public.news (status, created_at desc);
create index if not exists idx_news_fetch_batch on public.news (fetch_batch_id);


-- ---------- keep is_published in sync with status -------------------
create or replace function public.news_sync_is_published()
returns trigger
language plpgsql
as $$
begin
  new.is_published := (new.status = 'published');
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_news_sync_is_published on public.news;
create trigger trg_news_sync_is_published
  before insert or update of status on public.news
  for each row execute function public.news_sync_is_published();


-- ---------- news_translations ---------------------------------------
create table if not exists public.news_translations (
  id          uuid primary key default gen_random_uuid(),
  news_id     uuid not null references public.news(id) on delete cascade,
  locale      text not null,
  title       text not null,
  summary     text,
  content_html text,
  slug        text not null,
  translated_at timestamptz not null default now(),
  translator_id uuid references public.profiles(id),
  is_auto     boolean not null default true,
  unique (news_id, locale),
  unique (locale, slug)
);

create index if not exists idx_news_translations_news   on public.news_translations (news_id);
create index if not exists idx_news_translations_locale on public.news_translations (locale);


-- ---------- news_fetch_batches: cost tracking & history --------------
create table if not exists public.news_fetch_batches (
  id              uuid primary key default gen_random_uuid(),
  triggered_by    uuid references public.profiles(id),
  model           text,
  prompt_tokens   integer,
  completion_tokens integer,
  candidate_count integer not null default 0,
  imported_count  integer not null default 0,
  duplicate_count integer not null default 0,
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_news_fetch_batches_created
  on public.news_fetch_batches (created_at desc);


-- ---------- RLS -----------------------------------------------------
alter table public.news_translations  enable row level security;
alter table public.news_fetch_batches enable row level security;

-- Public can read translations for published articles
drop policy if exists "news_translations_public_read" on public.news_translations;
create policy "news_translations_public_read" on public.news_translations
  for select using (
    exists (
      select 1 from public.news n
       where n.id = news_translations.news_id
         and n.status = 'published'
    )
  );

-- Admin writes happen through service role; no other policies needed.
-- (Service role bypasses RLS.)

drop policy if exists "news_fetch_batches_admin_only" on public.news_fetch_batches;
create policy "news_fetch_batches_admin_only" on public.news_fetch_batches
  for select using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.role in ('admin', 'super_admin')
    )
  );

-- =====================================================================
-- 完成。記得重新生成 TS types：
--   npm run db:types
-- =====================================================================
