-- request_to_join: called by the client on right-swipe.
-- Inserts a join_request with status 'interested'.
-- ON CONFLICT DO NOTHING handles double-tap / retry idempotently.
create or replace function request_to_join(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into join_requests (activity_id, user_id, status)
  values (p_activity_id, auth.uid(), 'interested')
  on conflict (activity_id, user_id) do nothing;
end;
$$;

grant execute on function request_to_join(uuid) to authenticated;
