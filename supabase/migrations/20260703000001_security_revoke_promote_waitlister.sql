-- Security fix: revoke public EXECUTE on promote_next_waitlister.
-- This function is only ever called server-side (from host_remove_participant
-- and participant_leave). No client should be able to trigger it directly.
revoke execute on function promote_next_waitlister(uuid) from public, anon, authenticated;
