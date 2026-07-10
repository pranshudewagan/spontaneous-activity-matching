-- Block re-requests when the caller has a `passes` row for the activity.
--
-- `passes` is written from four soft-block paths:
--   1. Client-side left-swipe (should not resurface, but also shouldn't be
--      trivially undoable by calling request_to_join directly).
--   2. host_remove_participant — Phase 4f: "soft-blocks them from re-requesting
--      *that* activity" (CLAUDE.md → Matching → Removal).
--   3. host_respond_to_request rejection — same soft-block.
--   4. participant_leave AFTER the activity's start_time — "leaving after start
--      is final — no rejoin" (CLAUDE.md → Matching → Participants can leave).
--
-- The Discover feed already filters passed activities out of `nearby_activities`,
-- but a direct RPC call bypasses that. This closes the hole at the source.

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

  -- Soft-block: any passes row (self-passed or host-imposed) refuses the join.
  if exists (
    select 1 from passes
    where user_id = auth.uid() and activity_id = p_activity_id
  ) then return null; end if;

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
