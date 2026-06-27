create policy "hosts delete their own activities"
  on activities for delete
  to authenticated
  using (host_id = auth.uid());
