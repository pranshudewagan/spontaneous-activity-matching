-- Phase 4g: participant leave / request withdrawal.
--
-- participant_leave(p_activity_id):
--   accepted + before start → delete request, promote next waitlister, can re-request.
--   accepted + after start  → delete request, insert pass (final, no rejoin).
--   interested / waitlisted → delete request, no pass (can re-request before start).
-- Returns: 'left' | 'withdrawn' | null (not found / not a member).

create or replace function participant_leave(p_activity_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request  join_requests%rowtype;
  v_activity activities%rowtype;
begin
  if auth.uid() is null then return null; end if;

  select * into v_request
  from join_requests
  where activity_id = p_activity_id and user_id = auth.uid();
  if not found then return null; end if;

  select * into v_activity from activities where id = p_activity_id;
  if not found then return null; end if;

  -- Delete the request — revokes chat/event-info access via RLS immediately.
  delete from join_requests where id = v_request.id;

  if v_request.status = 'accepted' then
    if v_activity.start_time > now() then
      -- Before start: free the seat and promote the next qualified waitlister.
      -- No pass inserted — they can re-request before start.
      perform promote_next_waitlister(p_activity_id);
    else
      -- After start: final. Insert pass so they cannot rejoin.
      insert into passes (user_id, activity_id)
      values (auth.uid(), p_activity_id)
      on conflict do nothing;
    end if;
    return 'left';
  else
    -- Pending or waitlisted withdrawal — no pass, can re-request before start.
    return 'withdrawn';
  end if;
end;
$$;

grant execute on function participant_leave(uuid) to authenticated;
