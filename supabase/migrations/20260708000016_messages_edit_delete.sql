-- Add edit/delete support to messages.
-- deleted_at: soft-delete tombstone. body is preserved in DB but hidden by the RPC.
-- edited_at:  set when a sender edits their own message.

alter table messages
  add column edited_at  timestamptz,
  add column deleted_at timestamptz;

-- Replace get_chat_messages to expose the new fields.
-- Deleted messages return body = null so clients never receive the original text.
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
  deleted_at   timestamptz
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
    m.deleted_at
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

-- edit_message: sender only, within the 24-hour chat window, not already deleted.
create function edit_message(p_message_id uuid, p_new_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id   uuid;
  v_activity_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select sender_id, activity_id
  into   v_sender_id, v_activity_id
  from   messages
  where  id = p_message_id and deleted_at is null;

  if not found then
    raise exception 'message not found';
  end if;

  if v_sender_id <> auth.uid() then
    raise exception 'not your message';
  end if;

  if not exists (
    select 1 from activities
    where  id = v_activity_id
    and    start_time + interval '24 hours' > now()
  ) then
    raise exception 'chat is closed';
  end if;

  if p_new_body is null or length(trim(p_new_body)) = 0 then
    raise exception 'body cannot be empty';
  end if;

  update messages
  set    body = trim(p_new_body), edited_at = now()
  where  id = p_message_id;
end;
$$;

revoke execute on function edit_message(uuid, text) from public, anon;
grant  execute on function edit_message(uuid, text) to authenticated;

-- delete_message: sender only, within the 24-hour chat window.
create function delete_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id   uuid;
  v_activity_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select sender_id, activity_id
  into   v_sender_id, v_activity_id
  from   messages
  where  id = p_message_id and deleted_at is null;

  if not found then
    raise exception 'message not found';
  end if;

  if v_sender_id <> auth.uid() then
    raise exception 'not your message';
  end if;

  if not exists (
    select 1 from activities
    where  id = v_activity_id
    and    start_time + interval '24 hours' > now()
  ) then
    raise exception 'chat is closed';
  end if;

  update messages
  set    deleted_at = now()
  where  id = p_message_id;
end;
$$;

revoke execute on function delete_message(uuid) from public, anon;
grant  execute on function delete_message(uuid) to authenticated;
