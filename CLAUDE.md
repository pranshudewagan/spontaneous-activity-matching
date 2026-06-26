# [App name TBD] — spontaneous activity matching

A location-based app where people post real-life activities they already plan to do (laser tag, hiking, a museum, a food spot) and find others to join them through swipe-based matching. The product is *coordination around a specific plan someone already has* — not scheduled events, not communities, not a social network.

## Product
- **End users:** general public, non-technical. Two roles, same account: hosts who post a plan, participants who swipe to join. A user can be both.
- **The one job:** a stranger should be able to either post "I'm going to X at Y" and get the right people to join, or open the app and find a real activity nearby to join today — with no setup ceremony.
- **Non-goals (do not build these):** recurring events, persistent communities/groups, friend graphs/followers, general chat/DMs outside a matched activity, event ticketing/payments, long-term scheduling. If a feature only makes sense for repeat/scheduled use, it's out of scope.

## Core domain rules
These govern nearly every feature. Treat them as authoritative; if a request conflicts, flag it.

**Entities**
- **Activity** (the unit of the product): title, description, time, location (stored server-side **only** to compute distance — never exposed to anyone, see Constraints), max participants (**counts the host**: "max 4" = host + 3 others), tags (from the fixed shared list; optional — a host picks the closest tags or none), optional images, join policy, status.
- **User:** public profile = name, age, gender (**required**) plus photos, short bio, interest tags (**optional**). Gender is one of: man / woman / non-binary. Interest tags come from the same fixed list as activity tags. Private to the user only: their own count of activities done. No public reputation, no trust score, no tiers.
- **Tags:** one fixed, shared list powers both activity tags and profile interests. Optional on both sides. For now, users/hosts pick **only** from the curated list — no custom or free-form tags. User-suggested/custom tags are a deferred future-phase feature (see Build phases), not v1.
- **JoinRequest:** a participant's expressed interest in one activity; has a status.
- **Participation/Match:** an accepted JoinRequest; grants chat + event-info access. Event-info shows time, attendees, details — **no map or address**; where to meet is coordinated in chat.
- **Chat:** one group chat per activity.

**Matching**
- Many-to-one: many participants → one activity.
- Swipe right = express interest = create a JoinRequest. Swipe left = pass (don't resurface).
- Per-activity accept mode, set by host: `auto` | `auto_criteria` | `manual`.
  - `auto`: accepted immediately, up to capacity.
  - `auto_criteria`: auto-accepted if the participant clears the host's criteria; if not, they go to the **waitlist** (not rejected), where the **host can override and accept them**. Criteria are a small fixed menu of toggles (e.g. has a profile photo + bio; verified — later). **No experience/tenure/reputation gates** — newness is never a criterion; anyone can join anything regardless of how new they are.
  - `manual`: host approves/rejects each request.
- **Acceptance is reversible.** In any mode, a host can remove an already-accepted participant any time before the activity's end time. Removal:
  - immediately revokes the participant's chat and event-info access;
  - frees their seat → auto-promotes the next **qualified** waitlisted person (`auto`/`auto_criteria`) or reopens it for host approval (`manual`);
  - sends the removed participant a neutral notification;
  - soft-blocks them from re-requesting *that* activity (distinct from a full block).
- Removal is forward-looking — the participant may have seen chat content (including anything others typed about where to meet) before removal. For an actual safety problem the tool is **block + report**, not removal.
- Removal isn't a mark against the participant (there's no reputation to ding). Optionally track hosts' removal rates internally as an abuse signal.
- **Participants can leave** on their own at any time, including after the start time. Leaving ends their chat/event-info access and — if before start while accepted — frees their seat, auto-promoting the next qualified waitlister (same seat logic as host removal). They may re-request **only before start**; leaving after the start time is final — no rejoin (kept simple). (Distinct from host removal, which blocks re-requesting entirely.)
- Capacity is a hard limit, and `max_participants` **includes the host** — at "max 4," 3 others can join. **Every activity has a waitlist** (always on, not a toggle). At capacity, new right-swipes go to the waitlist in order.
- The waitlist also holds `auto_criteria` swipers who didn't meet the criteria (see Matching). They sit there pending host action — they are **never auto-promoted**.
- When a seat frees, the next **qualified** waitlisted person (capacity-overflow, not a criteria-fail) is auto-promoted in order.
- **Host override:** a host can manually accept anyone on the waitlist at any time, up to capacity — including someone who didn't meet `auto_criteria`.
- **Not-yet-accepted users see nothing private.** Waitlisted or pending-approval users see only the public activity card — exactly what they saw before swiping. No chat, no event-info, no meeting details. Only acceptance unlocks chat + event-info. (Already enforced by the schema's RLS — chat/event-info require `status = 'accepted'`.)

**Discovery / feed**
- Swipe-based feed of activities (Tinder-style cards).
- The radius is centered on the user's current location by default, but the user can re-center it — drag the pin, or enter an address/place name — and the radius stems from that chosen point.
- Ranking: location proximity + time relevance + optional popularity signal (e.g. how many have shown interest). No reputation/trust signal — ranking never favors veterans over new users.
- **Listed interests never rank or filter the feed.** Your profile interest tags do not change what you see — if you didn't list an interest, matching activities still appear. Narrowing by tag (or anything else) only happens when the user sets a filter manually.
- Filters are optional: if the user sets them, constrain the feed; if not, show everything eligible. Default is "show everything eligible," never an empty feed because no filters were chosen.

**Time**
- Each activity time is either strict or a flexible "suggested" toggle. Respect the toggle in display and ranking.

**Lifecycle**
- Activities are one-time.
- Once an activity's start time passes, it disappears from the discovery stack — it can no longer be swiped or joined.
- There is **no completion check** — nobody confirms whether it actually happened, and other users are never shown that. After its time, it's simply gone from the feed.
- Already-matched participants keep their group chat and event-info page (chat may persist).
- A host can **edit** an activity's details before its start time, and **cancel** it before start. On cancel: it disappears from the discovery stack, but already-matched participants keep their group chat and event info (the chat remains for them).
- Notifications for edits and cancellations are **deferred to the push phase** (Phase 8, once push exists). Until then these changes happen silently in-app.
- For each participant, privately increment their personal "activities done" count — visible only to that user, not public (at least in early phases). No public history.

**Reputation / history (intentionally minimal)**
- No reputation system: no trust score, no tiers, no peer ratings, no public history.
- Everyone can join anything regardless of how new they are. Newness/experience is never used to gate, rank, or filter.
- The only history kept is a private per-user count of activities done, shown only to that user (not public, at least early on).


## Stack
- **Frontend:** React Native via Expo — one codebase ships to both iOS and Android. Builds/submits via EAS (Expo Application Services).
- **Backend:** Supabase (managed). No separate app server.
  - **DB:** Postgres + PostGIS — geo proximity and ranking are SQL/PostGIS queries, never computed in the client.
  - **Auth:** Supabase Auth handles signup/login/sessions. v1 methods: **email or phone number, each via one-time code (OTP)**. (Phone OTP needs an SMS provider, e.g. Twilio — has a per-message cost.) Future phase: Google, Apple, Facebook social login. For that phase: Apple sign-in is required only on the **iOS build**, and only because social logins are offered — email/phone OTP alone never triggers it; Google Play never requires it; show the Apple button conditionally on iOS only.
  - **Realtime:** Supabase Realtime for chat + match/acceptance updates.
  - **Storage:** Supabase Storage for activity images.
  - **Server-side logic:** Postgres functions + Supabase Edge Functions for anything the client must not own (capacity enforcement, waitlist promotion, ranking, matching).
- **Push notifications:** Expo Notifications (acceptance, new chat message, waitlist promotion, host edit/cancel). **Deferred to a later phase** (see Build phases) — it's fiddly (device tokens, permissions, per-platform setup) and the app works in-app without it. Add it once the core loop is solid.

## Commands
> ⚠️ Update to match real scripts once scaffolded.
- Run app (dev): `npx expo start`
- Run on iOS sim / Android emu: `npx expo start --ios` / `--android`
- Local Supabase stack: `npx supabase start` / `stop`
- New migration: `npx supabase migration new <name>`
- Apply migrations locally: `npx supabase db reset`
- Push schema to remote: `npx supabase db push`
- Deploy an Edge Function: `npx supabase functions deploy <name>`
- Generate TS types from schema: `npx supabase gen types typescript --local > src/lib/database.types.ts`
- Build for stores: `eas build -p ios` / `eas build -p android`
- Submit to stores: `eas submit -p ios` / `eas submit -p android`
- Test: `[command — set when test runner is chosen]`

## Layout
> ⚠️ Fill once the repo exists. Document only the non-obvious parts.
- `app/` — Expo Router screens (feed, activity detail, host form, chat, profile)
- `src/components/` — shared UI (swipe card, activity card, etc.)
- `src/lib/supabase.ts` — single Supabase client; all DB access goes through here
- `src/lib/database.types.ts` — generated DB types; never hand-edit
- `supabase/migrations/` — schema, source of truth for the DB
- `supabase/functions/` — Edge Functions (matching, ranking, capacity-sensitive ops)

## Conventions
- DB schema is the source of truth: change it via a migration, then regenerate `database.types.ts`. Never hand-edit generated types or the schema in the dashboard.
- All geo/ranking logic is SQL/PostGIS in Postgres functions, never recomputed client-side.
- Any operation that touches capacity, acceptance, or waitlist order runs in an Edge Function or Postgres function — the client never decides these.
- Every table has Row Level Security enabled with explicit policies. RLS is the security boundary (see Constraints). No table ships with RLS off.
- Distances are shown to and entered by users in **miles** (US). PostGIS works in meters — convert at the edge, store/compute in meters.
- UI follows `DESIGN.md` — read it before building any screen or component, so the look stays coherent and reinforces the product decisions (no address, no ratings, distance-not-location).
- One Supabase client instance, imported everywhere; don't construct ad-hoc clients.
- Commit at every working slice; small diffs over big ones.

## Constraints
- **Location is never exposed to anyone, at any stage.** No user's location and no activity's coordinates/address are ever sent to a client — not in discovery, not after matching. Location exists only server-side, solely to compute distance for radius-based discovery. The only spatial thing a client may receive is a distance/eligibility result (e.g. "within your radius"), never coordinates or an address. Where to actually meet is coordinated by participants in the activity chat. This must be enforced at the database: the client is never granted read access to the location column; distance comes back only through a function that returns a number. Hiding it in the UI is not enough.
- Age-gate the app and enforce it; this app coordinates in-person meetings between strangers.
- Every user must be able to report and block; blocked users never see each other in the feed or chat. (App Store / Play Store frequently require this for meet-strangers apps.)
- Default to user-protective choices when host convenience and participant safety conflict.
- Secrets live in env/config, never in code or committed files (`.env` is git-ignored). The Supabase anon key is public by design (safe in the app, guarded by RLS); the **service-role key bypasses RLS and must never reach the client** — it lives only in server-side Edge Function secrets. In Expo, anything prefixed `EXPO_PUBLIC_` is bundled into the app and readable by anyone — only the Supabase URL + anon key belong there; SMS/provider keys and the service-role key stay server-side.
- **Rate limiting:** configure Supabase Auth's built-in limits on OTP sends/verifications, especially for **phone OTP** — SMS costs money, so an uncapped send endpoint invites toll fraud and bill spikes. Custom per-action limits on writes (activity creation, messages, swipes) are deferred to the safety phase and added in response to real abuse; keep any swipe limit generous, since fast swiping is normal.
- Never weaken capacity, join-policy, or expiry enforcement for convenience — these are correctness rules, not preferences.

## Gotchas
> Bank debugging pain here so future-you only pays it once.
- **RLS is the security boundary — review every policy by hand.** A missing or too-loose policy leaks data directly to clients. This is the #1 failure mode of AI-built Supabase apps; never trust a generated policy without reading it.
- PostGIS distance/SRID: be explicit about coordinate systems; mixing degrees and meters silently returns garbage proximity.
- Time zones: store UTC, convert at the edges; "expired" must be computed against the activity's actual local time.
- Swipe idempotency: a double-tap or retry must not create two JoinRequests for the same user+activity (unique constraint on user+activity).
- Capacity race: two participants accepted into the last seat at once — enforce capacity inside a Postgres function/transaction, not in client logic.
- Regenerate `database.types.ts` after every migration, or the app and DB silently drift.
- Edge Functions cold-start; don't put latency-critical UI on a cold function path without thought.
- **Never grant the client SELECT on the location column.** Use Postgres column-level grants + a SECURITY DEFINER distance function. RLS hides rows, not columns — a readable coordinate column leaks location regardless of RLS or UI.
- [Add real ones as you hit them, e.g. EAS build/signing quirks, push-notification setup on each platform.]

## Build phases
> Build ONE phase at a time, in order. Each phase — and each lettered step within it — ends in something runnable and verifiable. The detailed sub-steps and verify checks live in `ROADMAP.md`; read it when working a phase. Do not build ahead unless asked.
0. **Foundation** — Expo + Supabase + email/phone OTP auth (+ configure auth rate limits) + empty profile screen.
1. **Data model & security** — schema, RLS, location lockdown, generated types. ← current
1. **Data model & security** — schema, RLS, location lockdown, generated types. 
2. **Host an activity** — create form (+ fixed-list tag picker) → DB.
3. **Discovery stack** — radius feed, swipe UI, manual filters, exclude past/own.
4. **Joining & matching** — join requests, three accept modes, capacity + waitlist, reversal.
5. **Matched experience** — event-info (no address), group chat (in-app, Realtime).
6. **Profile & lifecycle** — public profile + interests, private activities-done, host edit/cancel, expiry.
7. **Safety & store-readiness** — block/report, age gate, in-app account deletion, abuse rate limits, policies, permission strings, submit.
8. **Push notifications** (post-v1) — Expo push: tokens + permission, then wire accepted / new-message / waitlist-promotion / host-edit-cancel events.
9. **Social login** (post-v1) — Google, Facebook, Apple (iOS build only).
10. **Custom tags** (post-v1) — user-suggested tags beyond the fixed list, with moderation.
11. **Photo moderation** (post-v1) — report-driven photo reporting/review; automated screening even later.