-- Add distance_m to my_joined_activities for the detail modal.
drop function if exists my_joined_activities();
drop function if exists my_joined_activities(double precision, double precision);

create or replace function my_joined_activities(
  p_lat double precision default 0,
  p_lng double precision default 0
)
returns table (
  id               uuid,
  title            text,
  description      text,
  start_time       timestamptz,
  time_flexible    boolean,
  max_participants int,
  accepted_count   int,
  tags             text[],
  image_url        text,
  mode             accept_mode,
  distance_m       double precision,
  join_status      join_status,
  joined_at        timestamptz
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
    (
      select count(*)::int
      from join_requests jr2
      where jr2.activity_id = a.id
        and jr2.status = 'accepted'
    ) as accepted_count,
    a.tags,
    a.image_url,
    a.mode,
    round(
      st_distance(
        a.location,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
      )
    )::double precision as distance_m,
    jr.status     as join_status,
    jr.created_at as joined_at
  from join_requests jr
  join activities a on a.id = jr.activity_id
  where jr.user_id = auth.uid()
    and jr.status not in ('rejected', 'removed', 'left')
  order by a.start_time asc;
$$;

grant execute on function my_joined_activities(double precision, double precision) to authenticated;
