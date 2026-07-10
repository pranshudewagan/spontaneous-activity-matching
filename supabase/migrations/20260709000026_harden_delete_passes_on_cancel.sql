-- Harden the delete_passes_on_cancel trigger function.
--
-- Same shape as the security-definer + search_path hardening applied to
-- is_activity_member in 20260703000004. Without either qualifier, a caller
-- whose session search_path shadows `public.passes` with an attacker-owned
-- table could redirect the DELETE. Not exploitable in the current app surface
-- (no route lets a client run arbitrary SQL), but standard defense-in-depth
-- for every function that touches a table by unqualified name.

create or replace function delete_passes_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status != 'cancelled' then
    delete from passes where activity_id = new.id;
  end if;
  return new;
end;
$$;
