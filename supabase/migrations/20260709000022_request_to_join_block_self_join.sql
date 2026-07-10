-- Restore the self-join guard on request_to_join.
--
-- The check was removed by a testing shim (20260628000009_testing_allow_self_join)
-- to make single-account manual testing possible. nearby_activities was restored
-- in 20260707000014, but request_to_join was never re-guarded — a host can still
-- self-join via the RPC. That breaks capacity math because max_participants
-- already counts the host, so a host self-joining consumes a participant seat.

drop function if exists request_to_join(uuid);

create or replace function request_to_join(p_activity_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_act            activities%rowtype;
  v_accepted_count int;
  v_new_status     join_status;
begin
  if auth.uid() is null then return null; end if;

  -- Idempotent: return existing status if already requested.
  if exists (
    select 1 from join_requests
    where activity_id = p_activity_id and user_id = auth.uid()
  ) then
    select status into v_new_status from join_requests
    where activity_id = p_activity_id and user_id = auth.uid();
    return v_new_status::text;
  end if;

  -- Lock activity row to prevent concurrent requests from racing past capacity.
  select * into v_act from activities where id = p_activity_id for update;

  if not found                        then return null; end if;
  if v_act.host_id  = auth.uid()      then return null; end if;
  if v_act.status  != 'open'          then return null; end if;
  if v_act.start_time <= now()        then return null; end if;

  select count(*) into v_accepted_count
  from join_requests
  where activity_id = p_activity_id and status = 'accepted';

  if v_act.mode in ('auto', 'auto_criteria') then
    -- auto_criteria criteria enforcement deferred to Phase 6; treats like auto for now.
    if v_accepted_count < v_act.max_participants - 1 then
      v_new_status := 'accepted';
    else
      v_new_status := 'waitlisted';
    end if;
  else
    -- manual: host decides who gets in, but capacity still gates new swipes.
    if v_accepted_count < v_act.max_participants - 1 then
      v_new_status := 'interested';
    else
      v_new_status := 'waitlisted';
    end if;
  end if;

  insert into join_requests (activity_id, user_id, status)
  values (p_activity_id, auth.uid(), v_new_status);

  return v_new_status::text;
end;
$$;

grant execute on function request_to_join(uuid) to authenticated;
