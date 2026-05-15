-- =====================================================================
-- 010_storage_order_documents.sql
--
-- Create the `order-documents` storage bucket + RLS so that signed
-- contract scans, B/L PDFs, COA, packing lists, customs declarations
-- and other order attachments can actually be uploaded.
--
-- Path convention (enforced by code in
-- src/components/order/SignedScanUploader.tsx and
-- src/components/order/OrderDocumentUploader.tsx):
--   <order_id>/<doctype>/<uuid>.<ext>
--
-- All policies are namespaced by the leading <order_id> path segment
-- so we can join back to `public.orders` and re-use the buyer / seller
-- / admin authorisation rules.
--
-- This file is idempotent.
-- =====================================================================


-- 1. Bucket --------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-documents',
  'order-documents',
  false,
  20 * 1024 * 1024, -- 20 MB per file
  array[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- 2. RLS -----------------------------------------------------------------
-- Storage RLS is `enabled by default` on storage.objects; just add the
-- bucket-scoped policies.

-- Drop policies if they already exist so this migration is rerunnable.
drop policy if exists "order-documents:read parties" on storage.objects;
drop policy if exists "order-documents:insert parties" on storage.objects;
drop policy if exists "order-documents:update parties" on storage.objects;
drop policy if exists "order-documents:delete admin" on storage.objects;


-- Helper expression used in each policy: derive the order_id from the
-- first path segment and check the caller is buyer, seller, or admin.
-- storage.foldername(name) returns text[] of path parts.

create policy "order-documents:read parties"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-documents'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (
          o.buyer_id = auth.uid()
          or o.seller_id = auth.uid()
          or public.current_user_role() in ('admin', 'super_admin')
        )
    )
  );

create policy "order-documents:insert parties"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'order-documents'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (
          o.buyer_id = auth.uid()
          or o.seller_id = auth.uid()
          or public.current_user_role() in ('admin', 'super_admin')
        )
    )
  );

-- Allow parties to overwrite their own files (rare, but useful for
-- replacing a corrupted scan before any approval happens).
create policy "order-documents:update parties"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'order-documents'
    and exists (
      select 1
      from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and (
          o.buyer_id = auth.uid()
          or o.seller_id = auth.uid()
          or public.current_user_role() in ('admin', 'super_admin')
        )
    )
  );

-- Only admins can hard-delete (parties keep the audit trail).
create policy "order-documents:delete admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'order-documents'
    and public.current_user_role() in ('admin', 'super_admin')
  );
