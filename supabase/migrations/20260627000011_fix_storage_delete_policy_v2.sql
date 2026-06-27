-- Supabase populates either owner (uuid) or owner_id (text) depending on version.
-- Check both so the policy works regardless.
drop policy if exists "uploaders can delete their own activity images" on storage.objects;

create policy "uploaders can delete their own activity images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'activity-images'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
  );
