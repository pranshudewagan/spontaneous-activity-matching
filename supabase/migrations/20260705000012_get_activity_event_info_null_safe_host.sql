-- If the host has no profile row the host subquery returned null, causing the
-- function to return null and the screen to show "Activity not found."
-- Fix: fetch host profile into variables first; coalesce at json_build_object time
-- so a missing profile always yields a valid host object, never null.

create or replace function get_activity_event_info(p_activity_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_activity   activities%rowtype;
  v_host_name  text;
  v_host_age   int;
  v_host_photo text;
begin
  if auth.uid() is null then return null; end if;

  select * into v_activity from activities where id = p_activity_id;
  if not found then return null; end if;

  if v_activity.host_id != auth.uid() then
    if not exists (
      select 1 from join_requests
      where activity_id = p_activity_id
        and user_id     = auth.uid()
        and status      = 'accepted'
    ) then
      return null;
    end if;
  end if;

  select name, age, photos[1]
  into v_host_name, v_host_age, v_host_photo
  from profiles where id = v_activity.host_id;

  return json_build_object(
    'id',               v_activity.id,
    'title',            v_activity.title,
    'description',      v_activity.description,
    'start_time',       v_activity.start_time,
    'time_flexible',    v_activity.time_flexible,
    'max_participants', v_activity.max_participants,
    'tags',             v_activity.tags,
    'image_url',        v_activity.image_url,
    'mode',             v_activity.mode,
    'is_host',          v_activity.host_id = auth.uid(),
    'host', json_build_object(
      'user_id', v_activity.host_id,
      'name',    coalesce(v_host_name, 'Unknown'),
      'age',     coalesce(v_host_age, 0),
      'photo',   v_host_photo
    ),
    'participants', (
      select coalesce(json_agg(
        json_build_object(
          'request_id', jr.id,
          'user_id',    jr.user_id,
          'name',       coalesce(p.name, 'Unknown'),
          'age',        coalesce(p.age, 0),
          'photo',      p.photos[1]
        ) order by jr.updated_at asc
      ), '[]'::json)
      from join_requests jr
      left join profiles p on p.id = jr.user_id
      where jr.activity_id = p_activity_id
        and jr.status = 'accepted'
    )
  );
end;
$$;

revoke execute on function get_activity_event_info(uuid) from public, anon;
grant  execute on function get_activity_event_info(uuid) to authenticated;
