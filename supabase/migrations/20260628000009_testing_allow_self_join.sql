-- TESTING ONLY: remove host guards so a user can join their own activities.
-- Revert before shipping (restore host_id != auth.uid() in both functions).

drop function if exists nearby_activities(double precision, double precision, double precision);

create function nearby_activities(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m double precision
)
returns table (
  id               uuid,
  host_id          uuid,
  title            text,
  description      text,
  start_time       timestamptz,
  time_flexible    boolean,
  max_participants int,
  tags             text[],
  mode             accept_mode,
  status           activity_status,
  distance_m       double precision,
  image_url        text,
  accepted_count   int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.host_id,
    a.title,
    a.description,
    a.start_time,
    a.time_flexible,
    a.max_participants,
    a.tags,
    a.mode,
    a.status,
    round(
      st_distance(
        a.location,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      )
    )::double precision as distance_m,
    a.image_url,
    (
      select count(*)::int
      from join_requests jr
      where jr.activity_id = a.id
        and jr.status = 'accepted'
    ) as accepted_count
  from activities a
  where a.status = 'open'
    and a.start_time > now()
    and st_dwithin(
          a.location,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_m
        )
    and not exists (
          select 1 from join_requests jr
          where jr.activity_id = a.id
            and jr.user_id = auth.uid()
        )
  order by
    case
      when a.start_time < (now() + interval '1 day')  then 0
      when a.start_time < (now() + interval '2 days') then 1
      else 2
    end asc,
    a.start_time asc,
    round(
      st_distance(
        a.location,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      )
    ) asc,
    (
      select count(*)::float / nullif(a.max_participants, 0)
      from join_requests jr2
      where jr2.activity_id = a.id
        and jr2.status = 'accepted'
    ) desc nulls last;
$$;


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

  if not found                 then return null; end if;
  if v_act.status != 'open'   then return null; end if;
  if v_act.start_time <= now() then return null; end if;

  -- Count currently accepted participants.
  select count(*) into v_accepted_count
  from join_requests
  where activity_id = p_activity_id and status = 'accepted';

  -- Determine status based on accept mode + capacity.
  if v_act.mode = 'auto' then
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
