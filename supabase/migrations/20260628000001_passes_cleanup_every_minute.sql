-- TEMPORARY: run cleanup every minute for testing; revert to hourly after verification
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cleanup-expired-passes') then
      perform cron.unschedule('cleanup-expired-passes');
    end if;
    perform cron.schedule(
      'cleanup-expired-passes',
      '* * * * *',
      'delete from passes p using activities a where p.activity_id = a.id and a.start_time <= now()'
    );
  end if;
end;
$$;
