-- Hourly cron job: hard-delete expired activities where nobody joined (host only).
-- Cancelled + no participants are already hard-deleted at cancel time, so this
-- only catches activities that simply expired with no takers.
-- Cascades handle join_requests, passes, and storage references.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cleanup-expired-empty-activities') then
      perform cron.unschedule('cleanup-expired-empty-activities');
    end if;
    perform cron.schedule(
      'cleanup-expired-empty-activities',
      '0 * * * *',
      $sql$
        delete from activities
        where start_time <= now()
          and not exists (
            select 1 from join_requests
            where activity_id = activities.id
              and status = 'accepted'
          )
      $sql$
    );
  end if;
end;
$$;
