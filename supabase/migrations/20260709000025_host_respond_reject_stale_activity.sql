-- Refuse host_respond_to_request against a cancelled or already-started
-- activity. Without this guard, a host could approve a leftover pending
-- request into a dead activity — the seat would be granted, chat access
-- unlocked, and the participant put "into" something that isn't happening.
--
-- Applies to both accept and reject: once the activity isn't live, the
-- request row shouldn't be actionable. Returns 'stale' so the client can
-- distinguish this from 'full' / null and reload the screen.

create or replace function host_respond_to_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request        join_requests%rowtype;
  v_activity       activities%rowtype;
  v_accepted_count int;
begin
  if auth.uid() is null then return null; end if;

  select * into v_request from join_requests where id = p_request_id;
  if not found then return null; end if;

  -- Lock activity row to prevent concurrent approvals from racing past capacity.
  select * into v_activity from activities
  where id = v_request.activity_id for update;
  if not found then return null; end if;

  if v_activity.host_id != auth.uid() then return null; end if;

  -- Stale: activity is no longer live.
  if v_activity.status  != 'open'    then return 'stale'; end if;
  if v_activity.start_time <= now()  then return 'stale'; end if;

  if p_accept then
    -- Host seat is counted in max_participants; accepted join_requests are the rest.
    select count(*) into v_accepted_count
    from join_requests
    where activity_id = v_request.activity_id and status = 'accepted';

    if v_accepted_count >= v_activity.max_participants - 1 then
      return 'full';
    end if;

    update join_requests
    set status = 'accepted', updated_at = now()
    where id = p_request_id;
    return 'accepted';
  else
    insert into passes (user_id, activity_id)
    values (v_request.user_id, v_request.activity_id)
    on conflict do nothing;
    delete from join_requests where id = p_request_id;
    return 'rejected';
  end if;
end;
$$;

grant execute on function host_respond_to_request(uuid, boolean) to authenticated;
