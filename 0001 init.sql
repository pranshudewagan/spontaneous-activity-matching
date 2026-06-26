-- ============================================================================
-- Phase 1 — Data model & security
-- Core schema, Row Level Security, and the location-privacy lockdown.
--
-- READ BEFORE TRUSTING: RLS is the security boundary for this app. Every policy
-- below decides what one user can see of another. Review each one by hand.
-- The location lockdown (bottom) is the single most important part — it is what
-- guarantees no coordinates ever reach a client.
--
-- Scope of this phase: profiles, activities, join_requests, messages.
-- Deferred to later phases: blocks/reports (Phase 7), images/storage,
-- push tokens (Phase 8). Add those in their own migrations.
-- ============================================================================

create extension if not exists postgis;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type accept_mode   as enum ('auto', 'auto_criteria', 'manual');
create type activity_status as enum ('open', 'full', 'expired', 'cancelled');
create type join_status    as enum ('interested', 'accepted', 'waitlisted', 'rejected', 'removed', 'left');
create type gender         as enum ('man', 'woman', 'non_binary');

-- ----------------------------------------------------------------------------
-- tags  (the single fixed, shared list — powers both activity tags and
-- profile interests). Stored as data (not an enum) so the list can grow
-- without a schema migration. activities.tags and profiles.interests hold
-- slugs from this table; membership is validated app-side for now (a DB
-- trigger can enforce it later if needed).
-- ----------------------------------------------------------------------------
create table tags (
  slug   text primary key,    -- e.g. 'hiking', 'food_drink'
  label  text not null        -- e.g. 'Hiking', 'Food & drink'
);

alter table tags enable row level security;

-- Everyone signed in can read the list. No client writes — curated via migrations.
create policy "tags are readable by authenticated users"
  on tags for select
  to authenticated
  using (true);

-- Starter list — CURATE THIS for your launch. Add/remove rows freely later.
insert into tags (slug, label) values
  ('outdoors',    'Outdoors'),
  ('sports',      'Sports'),
  ('food_drink',  'Food & drink'),
  ('arts',        'Arts & culture'),
  ('games',       'Games'),
  ('fitness',     'Fitness'),
  ('music',       'Music'),
  ('nightlife',   'Nightlife'),
  ('learning',    'Learning'),
  ('social',      'Social');

-- ----------------------------------------------------------------------------
-- profiles  (PUBLIC fields only — see Constraints in CLAUDE.md)
-- One row per auth user. Everything here is readable by any signed-in user.
-- "activities done" is intentionally NOT stored here; it is derived for the
-- owner from their own join_requests so it never becomes public data.
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  bio         text,
  age         int    not null check (age >= 18),   -- age-gate: 18+ only
  gender      gender not null,                      -- required: man/woman/non_binary
  photos      text[] not null default '{}',         -- storage paths, wired up later
  interests   text[] not null default '{}',         -- tag slugs from the tags table; optional
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Any signed-in user can read any profile (public fields only live here).
create policy "profiles are readable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

-- A user can create and edit only their own profile.
create policy "users insert their own profile"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "users update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- activities
-- NOTE: `location` is geography and is the protected column. It is used ONLY
-- server-side for distance. Clients are never granted SELECT on it (see the
-- lockdown section at the bottom). Discovery goes through nearby_activities().
-- ----------------------------------------------------------------------------
create table activities (
  id               uuid primary key default gen_random_uuid(),
  host_id          uuid not null references profiles (id) on delete cascade,
  title            text not null,
  description      text,
  start_time       timestamptz not null,        -- store UTC; compare in UTC
  time_flexible    boolean not null default false,
  location         geography(Point, 4326) not null,  -- PROTECTED. never sent to client.
  max_participants int not null check (max_participants > 0),  -- INCLUDES the host (max 4 = host + 3)
  tags             text[] not null default '{}',  -- slugs from the tags table; optional
  mode             accept_mode not null default 'auto',
  status           activity_status not null default 'open',
  created_at       timestamptz not null default now()
);

create index activities_location_gix on activities using gist (location);
create index activities_start_time_idx on activities (start_time);

alter table activities enable row level security;

-- A host manages their own activities fully.
create policy "hosts read their own activities"
  on activities for select
  to authenticated
  using (host_id = auth.uid());

create policy "hosts insert their own activities"
  on activities for insert
  to authenticated
  with check (host_id = auth.uid());

create policy "hosts update their own activities"
  on activities for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- Accepted participants may read the activity they're in (for the event-info
-- page). Discovery does NOT use this policy — it uses nearby_activities().
create policy "participants read activities they joined"
  on activities for select
  to authenticated
  using (
    exists (
      select 1 from join_requests jr
      where jr.activity_id = activities.id
        and jr.user_id = auth.uid()
        and jr.status = 'accepted'
    )
  );

-- ----------------------------------------------------------------------------
-- join_requests
-- One row per (activity, user). Status carries the whole lifecycle:
-- interested -> accepted | waitlisted | rejected, and accepted -> removed.
-- ----------------------------------------------------------------------------
create table join_requests (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  status      join_status not null default 'interested',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (activity_id, user_id)   -- swipe idempotency: no duplicate requests
);

create index join_requests_activity_idx on join_requests (activity_id);
create index join_requests_user_idx on join_requests (user_id);

alter table join_requests enable row level security;

-- A user sees their own requests.
create policy "users read their own join_requests"
  on join_requests for select
  to authenticated
  using (user_id = auth.uid());

-- A host sees all requests for their own activities.
create policy "hosts read requests for their activities"
  on join_requests for select
  to authenticated
  using (
    exists (select 1 from activities a
            where a.id = join_requests.activity_id and a.host_id = auth.uid())
  );

-- A user creates their own request (the right-swipe). Acceptance/capacity is
-- decided server-side in Phase 4 (function), not by the client setting status.
create policy "users create their own join_requests"
  on join_requests for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'interested');

-- A host updates status on requests for their own activities (accept/reject/remove).
create policy "hosts update requests for their activities"
  on join_requests for update
  to authenticated
  using (
    exists (select 1 from activities a
            where a.id = join_requests.activity_id and a.host_id = auth.uid())
  );

-- A participant may leave their own request ('left') at any time, or re-request
-- ('interested') ONLY before the activity starts. Leaving after start is final —
-- no rejoin (keeps it simple). They can't self-accept, and can't touch a row a
-- host 'removed', so the host's removal soft-block holds. Seat-freeing/promotion
-- on leave is handled server-side (Edge Function), same as host removal.
create policy "users leave or re-request their own join_requests"
  on join_requests for update
  to authenticated
  using (user_id = auth.uid() and status <> 'removed')
  with check (
    user_id = auth.uid()
    and (
      status = 'left'                         -- leaving is always allowed
      or (status = 'interested'               -- re-requesting only before start
          and exists (select 1 from activities a
                      where a.id = join_requests.activity_id and a.start_time > now()))
    )
  );

-- ----------------------------------------------------------------------------
-- messages  (one group chat per activity)
-- Readable/writable only by the host and accepted participants of that activity.
-- ----------------------------------------------------------------------------
create table messages (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  sender_id   uuid not null references profiles (id) on delete cascade,
  body        text not null check (length(body) > 0),
  created_at  timestamptz not null default now()
);

create index messages_activity_idx on messages (activity_id, created_at);

alter table messages enable row level security;

-- Helper: is this user the host or an accepted participant of the activity?
-- SECURITY DEFINER so the membership check itself doesn't depend on the
-- caller's row visibility.
create or replace function is_activity_member(p_activity uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from activities a where a.id = p_activity and a.host_id = p_user
  ) or exists (
    select 1 from join_requests jr
    where jr.activity_id = p_activity and jr.user_id = p_user and jr.status = 'accepted'
  );
$$;

create policy "members read activity messages"
  on messages for select
  to authenticated
  using (is_activity_member(activity_id, auth.uid()));

create policy "members send activity messages"
  on messages for insert
  to authenticated
  with check (sender_id = auth.uid() and is_activity_member(activity_id, auth.uid()));

-- ============================================================================
-- LOCATION LOCKDOWN  — the most important section.
-- Goal: no client can ever read coordinates. RLS hides ROWS, not COLUMNS, so
-- RLS alone is not enough. We use column-level GRANTs to withhold the location
-- column entirely, and expose distance only through a function that returns a
-- number.
-- ============================================================================

-- Roles 'authenticated' and 'anon' get column-level SELECT on everything EXCEPT
-- location. (Granting an explicit column list means location is never readable,
-- even though row policies above would otherwise permit the row.)
revoke select on activities from authenticated, anon;

grant select
  (id, host_id, title, description, start_time, time_flexible,
   max_participants, tags, mode, status, created_at)
  on activities to authenticated, anon;

-- Discovery: returns open, not-yet-started activities within the caller's
-- chosen radius, with a coarse distance in METERS — and NO geometry.
-- SECURITY DEFINER so it can read the protected location column on the
-- client's behalf without ever returning it.
create or replace function nearby_activities(
  p_lat    double precision,
  p_lng    double precision,
  p_radius_m double precision
)
returns table (
  id               uuid,
  host_id          uuid,
  title            text,
  description      text,
  start_time       timestamptz,
  time_flexible    boolean,
  max_participants int,
  tags             text[],
  mode             accept_mode,
  status           activity_status,
  distance_m       double precision     -- the ONLY spatial value returned
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.host_id, a.title, a.description, a.start_time, a.time_flexible,
         a.max_participants, a.tags, a.mode, a.status,
         round(st_distance(
           a.location,
           st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
         ))::double precision as distance_m
  from activities a
  where a.status = 'open'
    and a.start_time > now()                       -- past-start activities leave the stack
    and st_dwithin(
          a.location,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_m
        )
  order by distance_m asc;
$$;

-- ============================================================================
-- REVIEW CHECKLIST (do this before Phase 2):
--  [ ] Confirm `select location from activities` as an authenticated user FAILS.
--  [ ] Confirm nearby_activities() returns distance_m but no coordinates.
--  [ ] Confirm a user cannot read another user's join_requests.
--  [ ] Confirm a non-member cannot read an activity's messages.
--  [ ] Confirm a non-host cannot update someone else's activity or its requests.
-- ============================================================================