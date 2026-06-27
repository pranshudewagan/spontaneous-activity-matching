-- Add image_url column to activities
alter table activities add column image_url text;

-- Storage bucket for activity images
insert into storage.buckets (id, name, public)
values ('activity-images', 'activity-images', true)
on conflict (id) do nothing;

-- Anyone authenticated can upload to their own folder (host_id prefix enforced in app)
create policy "authenticated users can upload activity images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'activity-images');

-- Anyone can view activity images (public bucket)
create policy "activity images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'activity-images');

-- Only the uploader can delete their own images
create policy "uploaders can delete their own activity images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'activity-images' and auth.uid()::text = (storage.foldername(name))[1]);
