-- Grant criteria column read access — missed in migration 012.
grant select (criteria) on activities to authenticated, anon;
