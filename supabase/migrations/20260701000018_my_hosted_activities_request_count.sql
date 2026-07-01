-- Add request_count to my_hosted_activities: total pending (interested + waitlisted)
-- requests the host still needs to act on. Used to show "N requests" on the hosting card.
-- Must DROP first because the return type changes (new request_count column).
drop function if exists my_hosted_activities(double precision, double precision);

create or replace function my_hosted_activities(
  p_lat double precision,
  p_lng double precision
)
returns table (
  id               uuid,
  title            text,
  description      text,
  start_time       timestamptz,
  time_flexible    boolean,
  max_participants int,
  tags             text[],
  mode             accept_mode,
  status           activity_status,
  created_at       timestamptz,
  distance_m       double precision,
  accepted_count   int,
  request_count    int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.title,
    a.description,
    a.start_time,
    a.time_flexible,
    a.max_participants,
    a.tags,
    a.mode,
    a.status,
    a.created_at,
    round(
      st_distance(
        a.location,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      )
    )::double precision as distance_m,
    (
      select count(*)::int
      from join_requests jr
      where jr.activity_id = a.id
        and jr.status = 'accepted'
    ) as accepted_count,
    (
      select count(*)::int
      from join_requests jr
      where jr.activity_id = a.id
        and jr.status in ('interested', 'waitlisted')
    ) as request_count
  from activities a
  where a.host_id = auth.uid()
  order by a.start_time asc;
$$;
