-- Phase 4f: host removal of an accepted participant.
--
-- 1. get_accepted_participants_for_activity — host-only view of accepted rows.
-- 2. host_remove_participant — deletes the accepted request, soft-blocks the
--    removed user via passes, and auto-promotes the next qualified waitlister
--    for auto/auto_criteria activities (manual mode skips auto-promotion).

-- 1. Accepted participants list for the host.
create or replace function get_accepted_participants_for_activity(p_activity_id uuid)
returns table (
  id         uuid,
  user_id    uuid,
  email      text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jr.id,
    jr.user_id,
    au.email::text,
    jr.created_at
  from join_requests jr
  join auth.users au on au.id = jr.user_id
  where jr.activity_id = p_activity_id
    and jr.status = 'accepted'
    and (select host_id from activities where id = p_activity_id) = auth.uid()
  order by jr.created_at asc;
$$;

grant execute on function get_accepted_participants_for_activity(uuid) to authenticated;


-- 2. Remove an accepted participant.
--    - Deletes their join_request (revokes chat/event-info access via RLS).
--    - Inserts a pass so the activity never resurfaces for them and they
--      cannot re-request it.
--    - For auto/auto_criteria: promotes the next qualified waitlister.
--    - For manual: seat reopens for host to approve someone from the waitlist.
create or replace function host_remove_participant(p_request_id uuid)
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

  select * into v_request from join_requests where id = p_request_id;
  if not found then return null; end if;
  if v_request.status != 'accepted' then return null; end if;

  -- Lock activity row to serialise concurrent removals.
  select * into v_activity from activities
  where id = v_request.activity_id for update;
  if not found then return null; end if;

  if v_activity.host_id != auth.uid() then return null; end if;

  -- Revoke access by deleting the accepted request.
  delete from join_requests where id = p_request_id;

  -- Soft-block: removed person can never re-request this activity.
  insert into passes (user_id, activity_id)
  values (v_request.user_id, v_request.activity_id)
  on conflict do nothing;

  -- Auto-promote next qualified waitlister for non-manual activities.
  if v_activity.mode in ('auto', 'auto_criteria') then
    perform promote_next_waitlister(v_activity.id);
  end if;

  return 'removed';
end;
$$;

grant execute on function host_remove_participant(uuid) to authenticated;
