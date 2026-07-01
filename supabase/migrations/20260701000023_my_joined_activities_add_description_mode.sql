-- Add description and mode to my_joined_activities for the detail modal.
drop function if exists my_joined_activities();

create or replace function my_joined_activities()
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
    jr.status    as join_status,
    jr.created_at as joined_at
  from join_requests jr
  join activities a on a.id = jr.activity_id
  where jr.user_id = auth.uid()
    and jr.status not in ('rejected', 'removed', 'left')
  order by a.start_time asc;
$$;

grant execute on function my_joined_activities() to authenticated;
