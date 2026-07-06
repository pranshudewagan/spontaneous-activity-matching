-- Core actions (host, join, message) require only auth — not a profile row.
-- Profiles are Phase 6; pointing these FKs at profiles blocked any user without
-- a profile from using the app at all.

alter table activities    drop constraint activities_host_id_fkey;
alter table join_requests drop constraint join_requests_user_id_fkey;
alter table messages      drop constraint messages_sender_id_fkey;

alter table activities    add constraint activities_host_id_fkey
  foreign key (host_id)   references auth.users(id) on delete cascade;
alter table join_requests add constraint join_requests_user_id_fkey
  foreign key (user_id)   references auth.users(id) on delete cascade;
alter table messages      add constraint messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete cascade;
