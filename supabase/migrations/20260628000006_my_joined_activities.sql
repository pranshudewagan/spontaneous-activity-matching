-- Returns the calling user's active join requests (interested / waitlisted / accepted)
-- with the associated activity details. Excludes rejected / removed / left.
create or replace function my_joined_activities()
returns table (
  id               uuid,
  title            text,
  start_time       timestamptz,
  time_flexible    boolean,
  max_participants int,
  accepted_count   int,
  tags             text[],
  image_url        text,
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
    jr.status  as join_status,
    jr.created_at as joined_at
  from join_requests jr
  join activities a on a.id = jr.activity_id
  where jr.user_id   = auth.uid()
    and jr.status not in ('rejected', 'removed', 'left')
  order by a.start_time asc;
$$;

grant execute on function my_joined_activities() to authenticated;
