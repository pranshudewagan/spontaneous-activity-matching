-- Fix typo: 'canceled' → 'cancelled' to match the activity_status enum
create or replace function delete_passes_on_cancel()
returns trigger language plpgsql as $$
begin
  if new.status = 'cancelled' and old.status != 'cancelled' then
    delete from passes where activity_id = new.id;
  end if;
  return new;
end;
$$;
