-- =====================================================================
-- Mada Graphite — Update news table to support slug, content_html,
-- cover_image_url fields expected by the admin UI and public news page.
-- =====================================================================

-- Add slug column (unique, used as URL key)
alter table public.news
  add column if not exists slug text;

-- Add content_html column (rich HTML content, replaces plain text content)
alter table public.news
  add column if not exists content_html text;

-- Add cover_image_url (renames semantics of image_url; keep both for compat)
alter table public.news
  add column if not exists cover_image_url text;

-- Add created_at (for ordering)
alter table public.news
  add column if not exists created_at timestamptz not null default now();

-- Back-fill slug from title for any existing rows (slugify: lowercase, replace spaces)
update public.news
set slug = lower(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

-- Back-fill content_html from content for existing rows
update public.news
set content_html = content
where content_html is null and content is not null;

-- Back-fill cover_image_url from image_url for existing rows
update public.news
set cover_image_url = image_url
where cover_image_url is null and image_url is not null;

-- Now make slug not null + unique
alter table public.news
  alter column slug set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'news_slug_key'
  ) then
    alter table public.news add constraint news_slug_key unique (slug);
  end if;
end $$;

-- Index for slug lookups
create index if not exists idx_news_slug on public.news (slug);
create index if not exists idx_news_published on public.news (is_published, published_at desc);
