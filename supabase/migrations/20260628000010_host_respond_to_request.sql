-- Phase 4c: host can see pending/waitlisted requests and approve or reject them.
--
-- get_join_requests_for_activity — SECURITY DEFINER so it can read auth.users.email;
--   only returns results when the caller is the host.
-- host_respond_to_request — approve (→ accepted) or reject (delete request + insert
--   pass so the activity never resurfaces in the requester's discovery feed).

create or replace function get_join_requests_for_activity(p_activity_id uuid)
returns table (
  id         uuid,
  user_id    uuid,
  email      text,
  status     join_status,
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
    jr.status,
    jr.created_at
  from join_requests jr
  join auth.users au on au.id = jr.user_id
  where jr.activity_id = p_activity_id
    and (select host_id from activities where id = p_activity_id) = auth.uid()
    and jr.status in ('interested', 'waitlisted')
  order by
    case jr.status when 'interested' then 0 else 1 end,
    jr.created_at asc;
$$;

grant execute on function get_join_requests_for_activity(uuid) to authenticated;


create or replace function host_respond_to_request(p_request_id uuid, p_accept boolean)
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

  select * into v_activity from activities where id = v_request.activity_id;
  if not found then return null; end if;

  -- Only the host may respond.
  if v_activity.host_id != auth.uid() then return null; end if;

  if p_accept then
    update join_requests
    set status = 'accepted', updated_at = now()
    where id = p_request_id;
    return 'accepted';
  else
    -- Insert a pass for the rejected user so the activity never resurfaces.
    insert into passes (user_id, activity_id)
    values (v_request.user_id, v_request.activity_id)
    on conflict do nothing;
    delete from join_requests where id = p_request_id;
    return 'rejected';
  end if;
end;
$$;

grant execute on function host_respond_to_request(uuid, boolean) to authenticated;
