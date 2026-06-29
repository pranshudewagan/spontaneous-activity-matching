-- Phase 4d stub: treat auto_criteria like auto (everyone accepts) until Phase 6
-- adds real profile data to enforce criteria checks against.
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

  -- Bail out if the user already has any request for this activity (idempotent).
  if exists (
    select 1 from join_requests
    where activity_id = p_activity_id and user_id = auth.uid()
  ) then
    select status::text into v_new_status from join_requests
    where activity_id = p_activity_id and user_id = auth.uid();
    return v_new_status::text;
  end if;

  -- Lock the activity row so concurrent requests can't both claim the last seat.
  select * into v_act from activities where id = p_activity_id for update;

  if not found                  then return null; end if;
  if v_act.status != 'open'    then return null; end if;
  if v_act.start_time <= now() then return null; end if;

  select count(*) into v_accepted_count
  from join_requests
  where activity_id = p_activity_id and status = 'accepted';

  -- auto and auto_criteria both auto-accept (criteria enforcement deferred to Phase 6).
  if v_act.mode in ('auto', 'auto_criteria') then
    if v_accepted_count < v_act.max_participants - 1 then
      v_new_status := 'accepted';
    else
      v_new_status := 'waitlisted';
    end if;
  else
    v_new_status := 'interested';
  end if;

  insert into join_requests (activity_id, user_id, status)
  values (p_activity_id, auth.uid(), v_new_status);

  return v_new_status::text;
end;
$$;

grant execute on function request_to_join(uuid) to authenticated;
