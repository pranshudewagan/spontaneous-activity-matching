-- Tighten edit_message: only allow edits within 15 minutes of the message's
-- creation. The 24-hour chat window still applies (below), and delete is
-- unaffected — a stale mistake can still be removed, just not silently rewritten.

create or replace function edit_message(p_message_id uuid, p_new_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id   uuid;
  v_activity_id uuid;
  v_created_at  timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select sender_id, activity_id, created_at
  into   v_sender_id, v_activity_id, v_created_at
  from   messages
  where  id = p_message_id and deleted_at is null;

  if not found then
    raise exception 'message not found';
  end if;

  if v_sender_id <> auth.uid() then
    raise exception 'not your message';
  end if;

  if v_created_at + interval '15 minutes' < now() then
    raise exception 'edit window closed';
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
