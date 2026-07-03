-- Security fix #10: add FOR UPDATE lock to participant_leave.
-- Every other capacity-touching function locks the activity row first;
-- without it a concurrent host approval + leave can race to max+1.

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

  -- Lock the activity row first, matching every other capacity path.
  select * into v_activity from activities where id = p_activity_id for update;
  if not found then return null; end if;

  select * into v_request
  from join_requests
  where activity_id = p_activity_id and user_id = auth.uid();
  if not found then return null; end if;

  delete from join_requests where id = v_request.id;

  if v_request.status = 'accepted' then
    if v_activity.start_time > now() then
      perform promote_next_waitlister(p_activity_id);
    else
      insert into passes (user_id, activity_id)
      values (auth.uid(), p_activity_id)
      on conflict do nothing;
    end if;
    return 'left';
  else
    return 'withdrawn';
  end if;
end;
$$;
