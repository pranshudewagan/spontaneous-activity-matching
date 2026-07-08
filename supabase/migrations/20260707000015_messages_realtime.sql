-- Enable Realtime on messages so postgres_changes subscriptions fire.
-- Without this, inserts are never broadcast to subscribers regardless of RLS.
alter publication supabase_realtime add table messages;
