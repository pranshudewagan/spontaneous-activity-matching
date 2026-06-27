-- Previous policy used storage.foldername() expecting userid/filename.jpg paths,
-- but files are stored at root level (filename.jpg). Use the owner column instead,
-- which Supabase sets to auth.uid() automatically on upload.
drop policy if exists "uploaders can delete their own activity images" on storage.objects;

create policy "uploaders can delete their own activity images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'activity-images' and owner = auth.uid());
