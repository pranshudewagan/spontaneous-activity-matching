# Spontaneous Activity Matching

A location-based mobile app where people post real-life activities they already plan to do — laser tag, hiking, a museum, a food spot — and find others to join them through swipe-based matching.

The core idea is coordination around a specific plan someone already has, not scheduled events or communities. A stranger should be able to either post "I'm going to X at Y" and get the right people to join, or open the app and find a real activity nearby to join today.

## Stack

- **Frontend:** React Native + Expo (SDK 54), Expo Router, Reanimated 4
- **Backend:** Supabase — Postgres + PostGIS, Auth (OTP), Realtime, Storage, Edge Functions
- **Builds:** EAS (Expo Application Services)

## Running locally

```bash
npm install
npx expo start
```

Scan the QR code in Expo Go. Do not open `localhost:8081` in a browser — it triggers an SSR crash unrelated to the app.

### Supabase (local)

```bash
npx supabase start       # spin up local stack
npx supabase db reset    # apply all migrations from scratch
npx supabase stop
```

### After schema changes

```bash
npx supabase migration new <name>          # create a new migration file
npx supabase db push                       # push to remote
npx supabase gen types typescript --local > src/lib/database.types.ts
```

### Edge Functions

```bash
npx supabase functions deploy <name>
```

## Project structure

```
src/
  app/
    (app)/          # tab screens (discover, my-plans)
    host.tsx        # post an activity
    location-picker.tsx
  components/       # shared UI (swipe-card, activity-card, etc.)
  constants/        # theme tokens
  lib/              # supabase client, helpers
supabase/
  migrations/       # Postgres schema — source of truth
  functions/        # Edge Functions
```

## Key design decisions

- **Location is never exposed to any client.** Coordinates are stored server-side only to compute distance. The only spatial data a client ever receives is a distance number. This is enforced at the DB layer with column-level grants — hiding it in UI is not enough.
- **All geo/ranking logic is SQL + PostGIS**, never recomputed client-side.
- **Capacity and waitlist enforcement run inside Postgres functions**, not in client code.
- **RLS is the security boundary.** Every table has Row Level Security enabled with explicit policies. The service role key bypasses RLS and never reaches the client.

## Environment

Create a `.env` file at the project root (see `.env.example` if present):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

The anon key is safe to bundle in the app — it's guarded by RLS. The service role key must stay server-side (Edge Function secrets only).
