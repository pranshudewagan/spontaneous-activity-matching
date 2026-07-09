-- Grant SELECT on message_reactions to authenticated.
--
-- RLS policies gate WHICH rows a role can see, but the role still needs
-- table-level SELECT privilege to see the table at all. Without this grant,
-- Supabase Realtime returns "Error 401: Unauthorized" for every change event
-- on this table — the WAL delta is generated, but the per-client RLS check
-- fails at the grant layer before RLS is even evaluated.
--
-- Writes to message_reactions still go exclusively through set_message_reaction
-- (SECURITY DEFINER); there is intentionally no INSERT/UPDATE/DELETE grant.

grant select on public.message_reactions to authenticated;
