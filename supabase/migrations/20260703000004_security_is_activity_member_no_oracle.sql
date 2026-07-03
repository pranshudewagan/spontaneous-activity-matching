-- Security fix #7: is_activity_member(uuid, uuid) is a membership oracle —
-- any authenticated user can call it with arbitrary IDs to map who attends what.
-- Fix: replace with a one-arg version that always checks auth.uid() internally.
-- Callers can only discover their own membership, never probe others.

-- Drop the policies that depend on the old signature first
drop policy if exists "members read activity messages"  on messages;
drop policy if exists "members send activity messages"  on messages;

-- Drop the two-arg function
drop function if exists is_activity_member(uuid, uuid);

-- New one-arg version: activity_id only, caller identity comes from auth.uid()
create function is_activity_member(p_activity uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from activities a where a.id = p_activity and a.host_id = auth.uid()
  ) or exists (
    select 1 from join_requests jr
    where jr.activity_id = p_activity
      and jr.user_id = auth.uid()
      and jr.status = 'accepted'
  );
$$;

-- Recreate the message policies using the new signature
create policy "members read activity messages"
  on messages for select
  to authenticated
  using (is_activity_member(activity_id));

create policy "members send activity messages"
  on messages for insert
  to authenticated
  with check (sender_id = auth.uid() and is_activity_member(activity_id));
