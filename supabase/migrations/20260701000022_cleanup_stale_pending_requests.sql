-- Hourly cron job: delete interested/waitlisted requests for activities that have
-- already started. These people never got in and the requests are now meaningless.
-- Activities with accepted participants stay in the DB for chat, so their stale
-- pending/waitlisted rows won't be caught by cascade deletes.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cleanup-stale-pending-requests') then
      perform cron.unschedule('cleanup-stale-pending-requests');
    end if;
    perform cron.schedule(
      'cleanup-stale-pending-requests',
      '0 * * * *',
      $sql$
        delete from join_requests
        using activities
        where join_requests.activity_id = activities.id
          and activities.start_time <= now()
          and join_requests.status in ('interested', 'waitlisted')
      $sql$
    );
  end if;
end;
$$;
