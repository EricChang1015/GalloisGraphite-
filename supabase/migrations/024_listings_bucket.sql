-- =====================================================================
-- 024_listings_bucket.sql
--
-- Public storage bucket for listing photos. Sellers upload product
-- images through `<ListingImageUploader />` and the resulting public
-- URLs are persisted into `listings.images` (jsonb array, already
-- defined in 001_init.sql).
--
-- Path convention (enforced by the server actions in
-- src/actions/listing-images.ts):
--
--     listings/{seller_user_id}/{uuid}.{ext}
--
-- The first path segment is the owner's `auth.uid()` so we can scope
-- write / delete permissions cheaply with `storage.foldername(name)`.
--
-- Bucket sizing:
--   * Per-file cap 2 MiB. Client-side compressTo720pWebp() ships images
--     well under that (720 px / quality 0.82 WebP).
--   * MIME whitelist: jpeg / png / webp (we still accept raw uploads
--     when the browser can't compress, so jpeg + png stay allowed).
--
-- Idempotent (`on conflict do update`, `drop policy if exists`).
-- =====================================================================


-- 1. Bucket --------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listings',
  'listings',
  true,
  2 * 1024 * 1024, -- 2 MiB per object (post-compression)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- 2. RLS -----------------------------------------------------------------
-- storage.objects is RLS-enabled by default.

drop policy if exists "listings:public read"     on storage.objects;
drop policy if exists "listings:owner insert"    on storage.objects;
drop policy if exists "listings:owner update"    on storage.objects;
drop policy if exists "listings:owner delete"    on storage.objects;


-- Anyone (even logged-out buyers) can fetch a public URL — the whole
-- point of a public bucket. The URL doesn't leak any other listing's
-- contents because object names include a UUID.
create policy "listings:public read"
  on storage.objects for select
  using (bucket_id = 'listings');


-- Only the path owner (the seller) may write. We don't enforce the
-- seller role here — RLS on the `listings` table itself does that when
-- the seller actually creates a listing referencing the URL. Path-owner
-- check matches the convention `listings/{user_id}/...`.
create policy "listings:owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- Updates (e.g. overwrite with a re-compressed version) — owner only.
create policy "listings:owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- Deletes — owner or admin / super_admin.
create policy "listings:owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listings'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_user_role() in ('admin', 'super_admin')
    )
  );
