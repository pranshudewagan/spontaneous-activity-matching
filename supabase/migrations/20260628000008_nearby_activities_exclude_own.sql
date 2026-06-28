-- Phase 3c: exclude the calling user's own activities from the discovery feed.
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
    and a.host_id != auth.uid()
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
