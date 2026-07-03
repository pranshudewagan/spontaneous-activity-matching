-- Security fix #8: remove the service-role key from the database GUC.
-- The trigger _delete_activity_image used app.service_role_key (set via ALTER DATABASE)
-- to call the Storage API. A GUC is readable from any SQL foothold via current_setting().
--
-- Storage cleanup for user-initiated deletes is already handled by the delete-activity
-- Edge Function (which holds the key securely in env vars, never in the DB).
-- Cron-deleted expired activities may orphan images in storage — acceptable trade-off
-- vs. keeping the service-role key readable from SQL.

-- Drop the trigger first so nothing calls the function
drop trigger if exists trg_delete_activity_image on activities;

-- Drop the function
drop function if exists _delete_activity_image();

-- NOTE: the GUC values (app.service_role_key, app.supabase_url) were set via
-- ALTER DATABASE by a superuser and cannot be reset in a migration. Run this
-- manually in the Supabase SQL editor (Dashboard → SQL editor):
--
--   alter database postgres reset "app.service_role_key";
--   alter database postgres reset "app.supabase_url";
