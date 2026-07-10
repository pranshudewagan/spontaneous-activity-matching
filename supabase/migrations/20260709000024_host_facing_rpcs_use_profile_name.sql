-- Stop leaking auth.users.email to hosts.
--
-- CLAUDE.md → Entities: "User: public profile = name, age, gender (required)…"
-- Email is not a public field. The two host-facing RPCs returned it because
-- profiles wasn't populated at the time; now that name is required at signup
-- (Phase 1 schema) we can swap to profiles.name and drop the auth.users join.
--
-- Two RPCs, same swap:
--   1. get_join_requests_for_activity      (pending + waitlisted)
--   2. get_accepted_participants_for_activity

drop function if exists get_join_requests_for_activity(uuid);
drop function if exists get_accepted_participants_for_activity(uuid);

create function get_join_requests_for_activity(p_activity_id uuid)
returns table (
  id         uuid,
  user_id    uuid,
  name       text,
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
    coalesce(p.name, 'Unknown') as name,
    jr.status,
    jr.created_at
  from join_requests jr
  left join profiles p on p.id = jr.user_id
  where jr.activity_id = p_activity_id
    and (select host_id from activities where id = p_activity_id) = auth.uid()
    and jr.status in ('interested', 'waitlisted')
  order by
    case jr.status when 'interested' then 0 else 1 end,
    jr.created_at asc;
$$;

grant execute on function get_join_requests_for_activity(uuid) to authenticated;


create function get_accepted_participants_for_activity(p_activity_id uuid)
returns table (
  id         uuid,
  user_id    uuid,
  name       text,
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
    coalesce(p.name, 'Unknown') as name,
    jr.created_at
  from join_requests jr
  left join profiles p on p.id = jr.user_id
  where jr.activity_id = p_activity_id
    and jr.status = 'accepted'
    and (select host_id from activities where id = p_activity_id) = auth.uid()
  order by jr.created_at asc;
$$;

grant execute on function get_accepted_participants_for_activity(uuid) to authenticated;
