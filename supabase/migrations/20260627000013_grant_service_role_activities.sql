-- The delete-activity Edge Function runs as service_role to bypass storage RLS.
-- service_role needs explicit table grants (bypassing RLS does not imply table privileges).
-- 'location' is intentionally excluded — it must never leave the server.
grant select (id, host_id, image_url) on activities to service_role;
grant delete on activities to service_role;
