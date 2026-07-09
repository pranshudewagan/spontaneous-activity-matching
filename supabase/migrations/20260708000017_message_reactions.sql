-- Message reactions (iMessage-style: one emoji per user per message).
-- Adding a new emoji replaces the user's existing reaction on that message.
-- Tapping the same emoji again toggles it off.

create table message_reactions (
  message_id  uuid        not null references messages    (id) on delete cascade,
  user_id     uuid        not null references profiles    (id) on delete cascade,
  activity_id uuid        not null references activities  (id) on delete cascade,
  emoji       text        not null check (length(emoji) between 1 and 32),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Realtime filter uses activity_id, same pattern as messages.
create index message_reactions_activity_idx on message_reactions (activity_id);
create index message_reactions_message_idx  on message_reactions (message_id);

alter table message_reactions enable row level security;

create policy "members read reactions"
  on message_reactions for select
  to authenticated
  using (is_activity_member(activity_id));

-- Writes are locked to the RPC below; direct client writes are forbidden.
-- (RLS with no matching policy = deny, so we simply omit insert/update/delete policies.)

alter publication supabase_realtime add table message_reactions;

-- Toggle-or-replace: if the caller already reacted with p_emoji, remove it;
-- otherwise upsert (replacing whatever prior reaction they had on this msg).
create function set_message_reaction(p_message_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid := auth.uid();
  v_activity_id uuid;
  v_existing    text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_emoji is null or length(trim(p_emoji)) = 0 then
    raise exception 'emoji required';
  end if;

  if length(p_emoji) > 32 then
    raise exception 'emoji too long';
  end if;

  select activity_id
  into   v_activity_id
  from   messages
  where  id = p_message_id and deleted_at is null;

  if not found then
    raise exception 'message not found';
  end if;

  if not is_activity_member(v_activity_id) then
    raise exception 'not a chat member';
  end if;

  select emoji
  into   v_existing
  from   message_reactions
  where  message_id = p_message_id and user_id = v_user_id;

  if v_existing = p_emoji then
    delete from message_reactions
    where message_id = p_message_id and user_id = v_user_id;
  else
    insert into message_reactions (message_id, user_id, activity_id, emoji)
    values (p_message_id, v_user_id, v_activity_id, p_emoji)
    on conflict (message_id, user_id) do update
      set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;

revoke execute on function set_message_reaction(uuid, text) from public, anon;
grant  execute on function set_message_reaction(uuid, text) to authenticated;

-- Redefine get_chat_messages to include an aggregated reactions jsonb per row:
--   [{ "emoji": "❤️", "count": 3, "reacted": true }, ...]
-- Ordered by earliest-reaction time so the pill order is stable per message.
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
          emoji,
          count(*)                          as cnt,
          bool_or(user_id = auth.uid())     as reacted,
          min(created_at)                   as first_at
        from message_reactions
        where message_id = m.id
        group by emoji
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
