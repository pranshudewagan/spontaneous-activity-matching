-- Fix: the reactions subquery inside get_chat_messages referenced `created_at`
-- unqualified, which is ambiguous with the RETURN TABLE column of the same name
-- (PL/pgSQL exposes them as variables). Alias message_reactions and qualify.

drop function get_chat_messages(uuid, timestamptz, int);

create function get_chat_messages(
  p_activity_id uuid,
  p_before      timestamptz default now(),
  p_limit       int         default 30
)
returns table (
  id           uuid,
  body         text,
  created_at   timestamptz,
  sender_id    uuid,
  sender_name  text,
  sender_photo text,
  is_own       boolean,
  edited_at    timestamptz,
  deleted_at   timestamptz,
  reactions    jsonb
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then return; end if;
  if not is_activity_member(p_activity_id) then return; end if;

  return query
  select
    m.id,
    case when m.deleted_at is not null then null else m.body end as body,
    m.created_at,
    m.sender_id,
    coalesce(p.name, 'Unknown') as sender_name,
    p.photos[1]                 as sender_photo,
    (m.sender_id = auth.uid())  as is_own,
    m.edited_at,
    m.deleted_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'emoji',   r.emoji,
          'count',   r.cnt,
          'reacted', r.reacted
        )
        order by r.first_at
      )
      from (
        select
          mr.emoji,
          count(*)                          as cnt,
          bool_or(mr.user_id = auth.uid())  as reacted,
          min(mr.created_at)                as first_at
        from message_reactions mr
        where mr.message_id = m.id
        group by mr.emoji
      ) r
    ), '[]'::jsonb) as reactions
  from messages m
  left join profiles p on p.id = m.sender_id
  where m.activity_id = p_activity_id
    and m.created_at < p_before
  order by m.created_at desc
  limit p_limit;
end;
$$;

revoke execute on function get_chat_messages(uuid, timestamptz, int) from public, anon;
grant  execute on function get_chat_messages(uuid, timestamptz, int) to authenticated;
