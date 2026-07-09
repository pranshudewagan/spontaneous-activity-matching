-- Realtime fixes for message_reactions:
--
-- 1. REPLICA IDENTITY FULL — with the default (PK only), UPDATE/DELETE WAL
--    rows carry just (message_id, user_id). The realtime `activity_id=eq.…`
--    filter can't match, so reaction changes/removals are silently dropped
--    from subscribers. FULL includes the whole old row so the filter matches.
--
-- 2. Drop-then-add on the supabase_realtime publication forces the Realtime
--    service to reload its publication list. Adding a table to the publication
--    while the service is already running is otherwise cached until restart.
--    Idempotent + safe to re-run.

alter table public.message_reactions replica identity full;

alter publication supabase_realtime drop table public.message_reactions;
alter publication supabase_realtime add  table public.message_reactions;
