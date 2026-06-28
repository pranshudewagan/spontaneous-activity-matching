-- Delete passes immediately when an activity is canceled
create or replace function delete_passes_on_cancel()
returns trigger language plpgsql as $$
begin
  if new.status = 'canceled' and old.status != 'canceled' then
    delete from passes where activity_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_delete_passes_on_cancel
  after update on activities
  for each row
  execute function delete_passes_on_cancel();

-- Hourly cron: delete passes for activities whose start_time has passed.
-- Requires pg_cron enabled in Supabase dashboard (Database → Extensions → pg_cron).
-- Skipped silently in local dev where pg_cron is not available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-expired-passes',
      '0 * * * *',
      'delete from passes p using activities a where p.activity_id = a.id and a.start_time <= now()'
    );
  end if;
end;
$$;
