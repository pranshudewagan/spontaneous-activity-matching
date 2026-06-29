-- Phase 4d: add criteria column for auto_criteria screening mode.
-- Stored as JSONB: { has_photo, min_age, max_age, genders, within_mi }.
-- Null when mode is not auto_criteria.
alter table activities add column if not exists criteria jsonb;

-- Column-level grant required: the init migration revokes all SELECT on activities
-- then grants specific columns only — every new column needs an explicit grant.
grant select (criteria) on activities to authenticated, anon;
