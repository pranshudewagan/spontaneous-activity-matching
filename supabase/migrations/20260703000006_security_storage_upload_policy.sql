-- Security fix #9: restrict activity-images storage uploads.
--
-- Before: any authenticated user could upload to any path, any file type, any size.
-- After:
--   1. Path scoping — uploads must go under {user_id}/* so users can't
--      overwrite each other's images.
--   2. Bucket limits — 5 MB max file size, image MIME types only.
--      (The app already hardcodes image/jpeg; this blocks anything else at the
--      storage layer regardless of what the client sends.)

-- 1. Tighten INSERT policy: enforce {user_id}/* path prefix
drop policy if exists "authenticated users can upload activity images" on storage.objects;

create policy "authenticated users can upload activity images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'activity-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Set bucket-level file size limit (5 MB) and allowed MIME types
update storage.buckets
set
  file_size_limit    = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'activity-images';
