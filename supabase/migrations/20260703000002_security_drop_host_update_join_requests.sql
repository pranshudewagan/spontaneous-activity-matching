-- Security fix: drop the host UPDATE policy on join_requests.
-- Hosts have no business writing directly to this table — every host
-- action (approve, reject, remove) goes through SECURITY DEFINER
-- functions (host_respond_to_request, host_remove_participant) that
-- enforce capacity locks. The bare UPDATE policy has no WITH CHECK,
-- so a host could forge status, reorder the waitlist via created_at,
-- or force-add arbitrary users by rewriting user_id.
drop policy if exists "hosts update requests for their activities" on join_requests;
