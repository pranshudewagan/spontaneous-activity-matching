-- Fix: revoking from PUBLIC also stripped authenticated users.
-- Re-grant EXECUTE to authenticated only — anon stays locked out.
grant execute on function nearby_activities(double precision, double precision, double precision) to authenticated;
