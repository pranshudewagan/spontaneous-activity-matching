-- Security fix #4: tighten the host activities UPDATE policy.
--
-- Before: host_id = auth.uid() on both sides — no other constraints.
-- After:
--   USING: host can only target activities that haven't started yet,
--          preventing edits to expired activities (and closing the
--          "reopen by setting start_time to the future" loophole).
--   WITH CHECK: new max_participants must be >= accepted count + 1 (the host's
--               own seat), preventing the host from setting capacity below the
--               number of people already in.

drop policy if exists "hosts update their own activities" on activities;

create policy "hosts update their own activities"
  on activities for update
  to authenticated
  using (
    host_id = auth.uid()
    and start_time > now()
  )
  with check (
    host_id = auth.uid()
    and max_participants >= (
      select count(*)::int
      from join_requests
      where activity_id = id
        and status = 'accepted'
    ) + 1
  );
