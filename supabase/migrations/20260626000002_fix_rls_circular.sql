-- ============================================================================
-- Fix circular RLS recursion between activities and join_requests.
--
-- The problem: activities RLS "participants read activities they joined" queries
-- join_requests. That triggers join_requests RLS "hosts read requests for their
-- activities" which queries activities — infinite recursion.
--
-- The fix: replace every cross-table subquery inside RLS policies with
-- SECURITY DEFINER helpers. SECURITY DEFINER functions run as their owner
-- (postgres) and bypass RLS for their internal queries, breaking the cycle.
-- ============================================================================

-- Helper: does this user host this activity?
create or replace function is_activity_host(p_activity uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from activities a where a.id = p_activity and a.host_id = p_user);
$$;

-- Helper: has this activity not started yet?
create or replace function activity_not_started(p_activity uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from activities a where a.id = p_activity and a.start_time > now());
$$;

-- ============================================================================
-- Explicit DML grants for authenticated role.
--
-- The local Supabase init does not auto-grant SELECT/INSERT/UPDATE/DELETE to
-- authenticated/anon the way the managed cloud does. We add them here so that
-- RLS policies can evaluate (they need table-level privilege before row-level
-- filtering kicks in).
--
-- activities: column-level SELECT was already set in migration 001 (location
-- intentionally excluded). We only add INSERT/UPDATE here so hosts can write.
-- All other app tables get the privileges their policies require.
-- ============================================================================

grant usage on schema public to authenticated, anon;

-- tags: read-only for authenticated (anon never needs it; curated server-side).
grant select on tags to authenticated;

-- profiles: authenticated users read all, write only their own (enforced by RLS).
grant select, insert, update on profiles to authenticated;

-- activities: no table-level SELECT (column-level grant in migration 001 already
-- gives SELECT on all columns except location). Hosts need INSERT and UPDATE.
grant insert, update on activities to authenticated;

-- join_requests: participants create rows; hosts and users update them; both read.
grant select, insert, update on join_requests to authenticated;

-- messages: members read and send; no update/delete (chat is append-only).
grant select, insert on messages to authenticated;

-- Drop and recreate the three join_requests policies that referenced activities
-- directly (causing the cross-table RLS loop).

drop policy "hosts read requests for their activities" on join_requests;
create policy "hosts read requests for their activities"
  on join_requests for select
  to authenticated
  using (is_activity_host(activity_id, auth.uid()));

drop policy "hosts update requests for their activities" on join_requests;
create policy "hosts update requests for their activities"
  on join_requests for update
  to authenticated
  using (is_activity_host(activity_id, auth.uid()));

drop policy "users leave or re-request their own join_requests" on join_requests;
create policy "users leave or re-request their own join_requests"
  on join_requests for update
  to authenticated
  using (user_id = auth.uid() and status <> 'removed')
  with check (
    user_id = auth.uid()
    and (
      status = 'left'
      or (status = 'interested' and activity_not_started(activity_id))
    )
  );
