-- Phase 5b: group chat.
-- 1. Tighten messages INSERT policy: block new messages > 24 h after activity start.
-- 2. get_chat_messages: paginated message fetch with sender profile info joined.

-- 24-hour write window: rebuild the insert policy to add the time guard.
drop policy if exists "members send activity messages" on messages;

create policy "members send activity messages"
  on messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and is_activity_member(activity_id)
    and (
      select a.start_time + interval '24 hours' > now()
      from activities a
      where a.id = activity_id
    )
  );

-- Paginated message fetch with sender info.
-- Returns newest-first so the client can feed it directly to an inverted FlatList.
-- Access-gated: only host or accepted participant gets rows (others get empty set).
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
  is_own       boolean
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
    m.body,
    m.created_at,
    m.sender_id,
    coalesce(p.name, 'Unknown') as sender_name,
    p.photos[1]                 as sender_photo,
    (m.sender_id = auth.uid())  as is_own
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
