-- Automatically delete the storage file whenever an activities row is deleted.
-- Uses pg_net (built-in to Supabase) to call the Storage REST API.
--
-- REQUIRED one-time setup — run this in the Supabase SQL editor (not in a migration,
-- because the values are secrets):
--
--   alter database postgres set app.supabase_url    = 'https://<project>.supabase.co';
--   alter database postgres set app.service_role_key = '<service-role-key>';
--
-- The service_role_key bypasses RLS on the storage API call, so it must never
-- reach the client — it stays server-side inside this Postgres function.

create or replace function _delete_activity_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_base_url text;
  v_key text;
begin
  if old.image_url is null then
    return old;
  end if;

  v_path     := split_part(old.image_url, '/activity-images/', 2);
  v_base_url := nullif(current_setting('app.supabase_url',     true), '');
  v_key      := nullif(current_setting('app.service_role_key', true), '');

  if v_path = '' or v_base_url is null or v_key is null then
    return old;
  end if;

  perform net.http_delete(
    url     := v_base_url || '/storage/v1/object/activity-images/' || v_path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key)
  );

  return old;
end;
$$;

drop trigger if exists trg_delete_activity_image on activities;

create trigger trg_delete_activity_image
  after delete on activities
  for each row execute function _delete_activity_image();
