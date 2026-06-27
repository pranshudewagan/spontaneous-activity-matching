# Build roadmap

Build one phase at a time, in order. Within a phase, do the lettered steps in order too — each ends in a check you can actually run. Don't start a phase until the previous one's checks pass. `CLAUDE.md` holds the one-line summary of each phase; this file is the working checklist.

Legend: each step is `letter. what to build → ✓ how to verify`.

---

## Phase 0 — Foundation
a. Scaffold the Expo app (TypeScript) and run it on a real device or simulator. → ✓ app boots to a blank screen on your phone.
b. Create the Supabase project; add the client in `src/lib/supabase.ts` with env keys. → ✓ a trivial query (e.g. `select now()`) succeeds from the app.
c. Email OTP sign-up/login screen. → ✓ you receive a code by email and reach a logged-in state.
d. Phone OTP (after connecting an SMS provider, e.g. Twilio). → ✓ you receive a code by SMS and log in.  ⚠️ deferred — all supported providers cost money per SMS; add when ready to spend
e. Configure Supabase Auth rate limits on OTP sends/verifications (esp. phone, for SMS cost/fraud). → ✓ rapid repeated OTP requests get throttled.
f. Empty profile screen gated behind auth. → ✓ logged-out users are bounced to login; logged-in users see it.

## Phase 1 — Data model & security ✓
a. Run `0001_init.sql` against a local Supabase. → ✓ all tables, types, and functions create with no errors.
b. Generate types: `npx supabase gen types typescript --local`. → ✓ `database.types.ts` exists and reflects the schema.
c. RLS cross-user checks (sign in as two users). → ✓ user A cannot read user B's `join_requests`; a non-member cannot read an activity's `messages`; a non-host cannot update someone else's activity.
d. Location lockdown. → ✓ `select location from activities` FAILS for an authenticated user; `nearby_activities()` returns `distance_m` and no coordinates.

## Phase 2 — Host an activity
a. Create-activity form: title, description, time + flexible toggle, max participants, accept mode. → ✓ form renders and blocks submit on missing required fields.
b. Tag picker from the fixed `tags` list (multi-select, optional). → ✓ you can pick zero or more tags; there is no way to type a custom one.  ← current
c. Location picker: defaults to your current location, but you can drag the pin or type an address / place name (geocoded to a point). The **exact spot is never shown on the posting** — distance only. (The real meeting place is shared in chat after matching, so the stored point only needs to be roughly right for the discovery radius.) → ✓ an activity row is created with a location and `host_id` = you; the posting shows no coordinates/address.
d. "My activities" list for the host. → ✓ your posted activity appears in your own list.

## Phase 3 — Discovery stack
a. Radius feed calling `nearby_activities(lat, lng, radius)`; radius in miles. Centers on your current location by default, but you can re-center it (drag, or type an address/place) — that point is where the radius stems from. → ✓ activities inside your radius appear, ones outside don't; re-centering changes the results.
b. Swipe UI — cards, swipe left/right. → ✓ swiping advances the stack; left-swiped cards don't resurface.
c. Exclude past-start activities and your own posts. → ✓ started activities and your own activities never appear in the stack.
d. Optional manual filters (tag, distance). → ✓ a filter narrows the feed; clearing it shows everything eligible again; your listed interests do NOT auto-filter.
e. Confirm the privacy boundary on the wire. → ✓ inspect the network response: only `distance_m`, never lat/lng or an address.

## Phase 4 — Joining & matching
a. Right-swipe creates a `join_request` (status `interested`). → ✓ a row appears; a double-swipe/retry does not create a duplicate.
b. `auto` mode. → ✓ right-swipe is accepted instantly, up to capacity.
c. `manual` mode — host approve/reject queue. → ✓ requests sit pending; host accept and reject both work.
d. `auto_criteria` mode. → ✓ requests that clear the criteria auto-accept; the rest go to the waitlist (not rejected), and the host can override-accept them.
e. Capacity, waitlist & host override (remember `max` includes the host; every activity has a waitlist). → ✓ at capacity, further joins go to the waitlist; a freed seat auto-promotes the next *qualified* waitlister (not a criteria-fail); the host can override-accept anyone on the waitlist; waitlisted/pending users see only the public card — no chat or event-info; two simultaneous accepts can't exceed capacity.
f. Acceptance reversal. → ✓ host removes an accepted person → their seat frees, the waitlist promotes, the removed person loses chat/event access and can't re-request that activity.
g. Participant leaving. → ✓ a participant can leave any time (incl. after start); leaving before start frees their seat and promotes the next qualified waitlister; they lose chat/event access; they can re-request only before start — leaving after start is final.

## Phase 5 — Matched experience
a. Event-info page: time, attendees, details — NO address or map. → ✓ accepted members see it; non-members cannot.
b. Group chat via Supabase Realtime (in-app). → ✓ two accounts exchange messages live; only members can read/post.

## Phase 6 — Profile & lifecycle
a. Public profile: photos, age, gender (man/woman/non-binary), name, bio, interest tags from the fixed list. → ✓ another user sees these fields and nothing more.
b. Photo upload to Supabase Storage. → ✓ a photo uploads and renders on the profile.
c. Private "activities done" count (derived from the owner's own rows). → ✓ you see your count; another user cannot.
d. Host edit and cancel before start. → ✓ edit updates details; cancel removes the activity from the stack while matched members keep their chat and event info.
e. Expiry off the stack at start time. → ✓ a started activity no longer appears in discovery; matched members still have chat/event info.

## Phase 7 — Safety & store-readiness
a. Block. → ✓ blocked users vanish from each other's feed and chat.
b. Report + a moderation path. → ✓ a report is recorded and reaches an admin/you.
c. Age gate (18+) enforced at signup. → ✓ an under-18 birthdate cannot complete signup.
d. Privacy policy + ToS, iOS permission-justification strings, store listing assets. → ✓ policy links present; location/notification/photo prompts have justification strings.
e. In-app account deletion (Apple requires it for apps with sign-up). → ✓ a user can delete their account; their profile/activities/requests/messages are removed (auth cascade).
f. Abuse rate limits on writes (activity creation, messages) — add if/as needed. → ✓ a script can't mass-create activities or flood a chat.
g. Build and submit. → ✓ `eas build` + `eas submit` reach review on both stores.

## Phase 8 — Push notifications (post-v1)
a. Expo Notifications setup: request permission, register device push tokens, store them. → ✓ a test push lands on a device on both platforms.
b. Wire push events: accepted, new chat message, waitlist promotion, host edit/cancel. → ✓ each event fires the right push.

## Phase 9 — Social login (post-v1)
a. Google sign-in (both platforms). → ✓ log in via Google on iOS and Android.
b. Facebook sign-in. → ✓ log in via Facebook.
c. Apple sign-in, shown only on the iOS build (`Platform.OS === 'ios'`). → ✓ the Apple button appears on iOS only, login works, and the iOS build passes App Store review with social logins present.

## Phase 10 — Custom tags (post-v1)
a. Let users suggest a tag beyond the fixed list, into a review queue (not the live list). → ✓ a suggestion lands in the queue, not in `tags` directly.
b. Approve a suggested tag into the shared list. → ✓ an approved tag becomes selectable everywhere fixed tags are, for both activities and interests.

## Phase 11 — Photo moderation (post-v1)
a. Let users report a specific photo; reported photos reach review and can be removed (report-driven). → ✓ a reported photo reaches an admin/you and can be taken down.
b. (Later, optional) automated screening of uploads for nudity/violence before they go live. → ✓ flagged uploads are blocked or queued for review.