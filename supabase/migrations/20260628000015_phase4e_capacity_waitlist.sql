-- Phase 4e: capacity hard-limit, waitlist auto-promotion, host-override capacity check.
--
-- Changes:
--   1. criteria_fail column: distinguishes capacity-overflow waitlisters (auto-promotable)
--      from criteria-fail waitlisters (host-only override, added in Phase 6).
--   2. promote_next_waitlister: promotes the oldest capacity-overflow waitlister
--      when a seat frees. Called from Phase 4f (removal) and 4g (participant leave).
--   3. host_respond_to_request: adds FOR UPDATE lock + capacity check on approve so
--      two simultaneous host approvals can't exceed max_participants.

-- 1. Tag criteria-fail waitlisters so they are skipped during auto-promotion.
--    Default false: all existing waitlisted rows are capacity-overflow (correct).
alter table join_requests
  add column if not exists criteria_fail boolean not null default false;

-- 2. Promote the next qualified waitlister when a seat frees.
--    Uses SKIP LOCKED so two concurrent calls never double-promote the same person.
--    Returns the promoted user_id, or null if nobody to promote.
create or replace function promote_next_waitlister(p_activity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  with next_in_line as (
    select id
    from join_requests
    where activity_id  = p_activity_id
      and status       = 'waitlisted'
      and criteria_fail = false
    order by created_at asc
    limit 1
    for update skip locked
  )
  update join_requests
  set status = 'accepted', updated_at = now()
  from next_in_line
  where join_requests.id = next_in_line.id
  returning join_requests.user_id into v_user_id;

  return v_user_id;
end;
$$;

-- Not exposed to authenticated — only called from other SECURITY DEFINER functions.

-- 3. Rebuild host_respond_to_request with capacity enforcement on approve.
--    Locks the activity row (FOR UPDATE) so two simultaneous host approvals
--    can't both slip past the capacity check.
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
