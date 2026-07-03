-- Phase 5a: event-info function for matched members.
-- Returns activity details + host + accepted participants (name, age, first photo).
-- Only callable by the host or an accepted participant — everyone else gets null.

create function get_activity_event_info(p_activity_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_activity activities%rowtype;
begin
  if auth.uid() is null then return null; end if;

  select * into v_activity from activities where id = p_activity_id;
  if not found then return null; end if;

  -- Access gate: host or accepted participant only
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

  return json_build_object(
    'id',             v_activity.id,
    'title',          v_activity.title,
    'description',    v_activity.description,
    'start_time',     v_activity.start_time,
    'time_flexible',  v_activity.time_flexible,
    'max_participants', v_activity.max_participants,
    'tags',           v_activity.tags,
    'image_url',      v_activity.image_url,
    'mode',           v_activity.mode,
    'is_host',        v_activity.host_id = auth.uid(),
    'host', (
      select json_build_object(
        'user_id', p.id,
        'name',    p.name,
        'age',     p.age,
        'photo',   p.photos[1]
      )
      from profiles p where p.id = v_activity.host_id
    ),
    'participants', (
      select coalesce(json_agg(
        json_build_object(
          'request_id', jr.id,
          'user_id',    jr.user_id,
          'name',       p.name,
          'age',        p.age,
          'photo',      p.photos[1]
        ) order by jr.updated_at asc
      ), '[]'::json)
      from join_requests jr
      join profiles p on p.id = jr.user_id
      where jr.activity_id = p_activity_id
        and jr.status = 'accepted'
    )
  );
end;
$$;

revoke execute on function get_activity_event_info(uuid) from public, anon;
grant  execute on function get_activity_event_info(uuid) to authenticated;
