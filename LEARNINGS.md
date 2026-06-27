# Learnings

## Getting `npx expo start` working on macOS with Expo Go SDK 54

### The actual problems (in order of discovery)

---

### 1. APFS dataless files — the root cause of ETIMEDOUT

macOS silently evicts file content from disk to save space. The file still appears in Finder/`ls` but reading it returns `ETIMEDOUT: connection timed out, read`. This affected both project source files (`src/`, `assets/`) and the `.git/` directory.

**How to detect:**
```bash
ls -lO path/to/file
# shows: compressed,dataless
```

**How to fix:**
```bash
# Delete the empty stubs, then restore from git
find . -not -path "*/node_modules/*" -not -path "*/.git/*" -type f | while read f; do
  flags=$(ls -lO "$f" 2>/dev/null | awk '{print $5}')
  if echo "$flags" | grep -q "dataless"; then rm "$f"; fi
done

# If .git itself is corrupted:
rm .git/HEAD && printf 'ref: refs/heads/main\n' > .git/HEAD
cat > .git/config << 'EOF'
[core]
  repositoryformatversion = 0
  filemode = true
  bare = false
  logallrefupdates = true
  ignorecase = true
  precomposeunicode = true
[remote "origin"]
  url = https://github.com/your-username/your-repo.git
  fetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
  remote = origin
  merge = refs/heads/main
EOF

git fetch --refetch origin
git reset --hard origin/main
```

**Why this happens:** macOS storage optimization (APFS) combined with iCloud or low-disk-space conditions. Completely unrelated to Expo or Metro — it's an OS-level issue that looks like a Metro/bundler bug.

---

### 2. Expo Go only supports one SDK version

Expo Go on device is pinned to a specific SDK version. If your `package.json` targets a newer SDK, you get:

> Project is incompatible with this version of Expo Go. The project you requested requires a newer version of Expo Go.

**Fix:** Match your project's SDK to what's installed on device. As of mid-2025, Expo Go supports up to SDK 54.

---

### 3. SDK 54 package versions

The GitHub repo was initialized with SDK 56. These are the correct SDK 54 versions:

```json
{
  "expo": "~54.0.0",
  "expo-asset": "~12.0.0",
  "expo-constants": "~18.0.0",
  "expo-device": "~8.0.0",
  "expo-font": "~14.0.0",
  "expo-image": "~3.0.0",
  "expo-linking": "~8.0.0",
  "expo-router": "~6.0.0",
  "expo-splash-screen": "~31.0.13",
  "expo-status-bar": "~3.0.9",
  "expo-symbols": "~1.0.0",
  "expo-system-ui": "~6.0.9",
  "expo-web-browser": "~15.0.11",
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "react-native": "0.81.5",
  "react-native-gesture-handler": "~2.28.0",
  "react-native-reanimated": "~4.1.1",
  "react-native-safe-area-context": "~5.6.0",
  "react-native-screens": "~4.16.0",
  "react-native-web": "^0.21.0",
  "react-native-worklets": "0.5.1"
}
```

Remove SDK 56-only packages: `@expo/ui`, `expo-glass-effect`.

---

### 4. `react-native-worklets` must match Expo Go's native version exactly

Expo Go has a native copy of `react-native-worklets` baked in. If the JS version you install doesn't match, the app crashes immediately:

> [Worklets] Mismatch between JavaScript part and native part of Worklets (0.7.4 vs 0.5.1)

**Fix:** Pin to the exact version Expo Go ships with. For SDK 54: `"react-native-worklets": "0.5.1"`.

---

### 5. SDK 56 API not available in SDK 54

`expo-router` v56 exports `ThemeProvider`, `DarkTheme`, and `DefaultTheme`. SDK 54's `expo-router` v6 does not.

**Fix:** Import from `@react-navigation/native` instead:
```tsx
// SDK 56 (wrong for SDK 54)
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';

// SDK 54 (correct)
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
```

---

### 6. Metro ETIMEDOUT workaround

If dataless files still slip through (e.g. right after a fresh `npm install` before macOS has scanned everything), Metro can ETIMEDOUT reading node_modules. Two mitigations:

**`metro.config.js`:**
```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.maxWorkers = 1;
config.resolver = { ...config.resolver, useWatchman: false };
module.exports = config;
```

**`scripts/warmup-node-modules.js`** — pre-reads all node_modules files to prime macOS's security scan cache before Metro starts. Run it in `postinstall` and before `expo start` in `package.json` scripts.

---

---

### 7. `react-native-reanimated` layout animation crash on web

On web, reanimated 4.x throws `Cannot read properties of undefined (reading 'top')` inside `layoutReanimation/web/componentStyle.js` during animation cleanup. Phone is unaffected.

This is a reanimated web compatibility issue, not an app bug. Since web is not a v1 target, ignore it for now.

---

---

### 8. `expo-router/unstable-native-tabs` API — Label and Icon are standalone exports

`NativeTabs.Trigger.Label` and `NativeTabs.Trigger.Icon` **do not exist**. They are separate top-level exports:

```tsx
// Wrong
import { NativeTabs } from 'expo-router/unstable-native-tabs';
<NativeTabs.Trigger name="index">
  <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>  // ❌ doesn't exist
</NativeTabs.Trigger>

// Correct
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
<NativeTabs.Trigger name="index">
  <Label>Discover</Label>   // ✓
  <Icon sf={{ default: 'map', selected: 'map.fill' }} />  // ✓
</NativeTabs.Trigger>
```

`calendar.fill` is NOT a valid SFSymbols7_0 name. For the calendar tab, use `sf="calendar"` (same for both states) — the color change via `iconColor` is sufficient selection signal.

---

### 9. NativeTabs going dark — two separate causes

**Cause 1 — System dark mode:** If `userInterfaceStyle` in `app.json` is `"automatic"`, the tab bar adopts system appearance. Fix: set `"userInterfaceStyle": "light"` to lock the app to light mode.

**Cause 2 — ScrollView scroll edge:** iOS's adaptive scroll-edge appearance makes the tab bar translucent/dark when a ScrollView is at its edge. Fix: add `disableTransparentOnScrollEdge` prop to `<NativeTabs>`.

---

### 10. Circular RLS between `activities` and `join_requests`

RLS policies that cross-reference tables create infinite recursion if both tables reference each other:

- `activities` policy "participants read activities they joined" → subquery on `join_requests`  
- `join_requests` policy "hosts read requests for their activities" → subquery on `activities`  
→ PostgreSQL error: `infinite recursion detected in policy for relation "activities"`

**Fix:** Any RLS policy that needs to look up a row in another RLS-protected table must go through a `SECURITY DEFINER` function. The function runs as its owner (postgres), bypasses RLS for its internal queries, and breaks the cycle:

```sql
create or replace function is_activity_host(p_activity uuid, p_user uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from activities a where a.id = p_activity and a.host_id = p_user);
$$;
-- Replace the direct subquery in the join_requests policy with is_activity_host(activity_id, auth.uid())
```

---

### 11. Local Supabase missing default DML grants

`supabase init` + user migrations do not automatically grant `SELECT`, `INSERT`, `UPDATE`, `DELETE` to `authenticated` and `anon` roles the way the managed cloud does. Without these grants, RLS policies evaluate but the table-level privilege check fails first.

**Fix:** Add explicit grants in a migration:

```sql
grant usage on schema public to authenticated, anon;
grant select on tags to authenticated;
grant select, insert, update on profiles to authenticated;
grant insert, update on activities to authenticated;   -- SELECT is column-level already
grant select, insert, update on join_requests to authenticated;
grant select, insert on messages to authenticated;
```

Note: for `activities`, we use column-level `GRANT SELECT (col1, col2, ...)` to exclude the `location` column. Do NOT add table-level `GRANT SELECT` on activities — that would expose location.

---

### 12. `supabase gen types` includes `location: unknown`

The type generator introspects the schema structure, not grant restrictions. It generates `location: unknown` for the `activities` table even though the column is blocked by column-level grants. This is acceptable:
- The DB grant is the real security boundary
- `unknown` type prevents accidental client-side use in TypeScript
- Never hand-edit the generated file

---

### 13. Supabase Storage `remove()` silently returns `removed: []` on RLS failure

`supabase.storage.from(bucket).remove([path])` returns `{ data: [], error: null }` when the delete is blocked by RLS — no error, just an empty array. This makes it impossible to distinguish a policy failure from a missing file at the call site. This occurs even when `owner` and `owner_id` in `storage.objects` are both correctly set to `auth.uid()` and the policy logic looks right. The JWT auth context is not forwarded to the Storage API the same way it is for database calls.

**Fix:** Use an Edge Function with the service role key — `admin.storage.from(bucket).remove([path])` where `admin` is a `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` instance. The service role key bypasses storage RLS entirely.

```typescript
// In Edge Function (server-side)
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const { data } = await admin.storage.from('activity-images').remove([path])
// data will contain the deleted file — no silent empty array
```

---

### 14. `service_role` bypasses RLS but still needs PostgreSQL table-level grants

The service role key has `BYPASSRLS` privilege, but that is separate from table-level grants. If migrations only grant `SELECT`/`INSERT`/`DELETE` to `authenticated` and `anon`, an Edge Function using the service role key gets:

> `permission denied for table activities`

**Fix:** Add explicit grants for `service_role` in a migration. Grant only the columns and operations the server-side code actually needs — keep sensitive columns like `location` excluded:

```sql
grant select (id, host_id, image_url) on activities to service_role;
grant delete on activities to service_role;
```

---

### 15. Edge Function caller verification — use anon key client, not service role `getUser(jwt)`

The correct pattern to identify the calling user inside a Supabase Edge Function is to create a client with the **anon key** and the request's Authorization header, then call `getUser()` with no arguments:

```typescript
// Correct
const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
  global: { headers: { Authorization: req.headers.get('Authorization')! } },
})
const { data: { user } } = await userClient.auth.getUser()

// Wrong — admin.auth.getUser(jwt) may not forward auth context correctly
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const { data: { user } } = await admin.auth.getUser(jwt)
```

Then use a separate `createClient(url, SERVICE_ROLE_KEY)` for admin writes. The two clients serve different roles: one verifies identity, the other performs privileged operations.

---

### 16. iOS `ImagePicker` ignores the `aspect` ratio — always square

`ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [3, 4] })` shows a **square** crop box on iOS regardless of the `aspect` prop. Android respects it. This is an iOS system limitation, not a bug in expo-image-picker.

**Fix:** Disable `allowsEditing` on iOS to skip the native crop UI, then center-crop programmatically with `expo-image-manipulator`:

```typescript
const isIOS = Platform.OS === 'ios'
const result = await ImagePicker.launchImageLibraryAsync({
  allowsEditing: !isIOS,
  aspect: [3, 4],   // only respected on Android
  quality: 1,
})
// Then compute crop dimensions and run through ImageManipulator
```

---

### 17. `LayoutAnimation` has no effect when Reanimated is active

`LayoutAnimation.configureNext(...)` does not animate layout changes when `react-native-reanimated` is installed — Reanimated takes over the animation loop and `LayoutAnimation` calls are silently no-ops.

**Fix:** Use `LinearTransition` from Reanimated v4 directly on the `Animated.View`:

```tsx
import Animated, { LinearTransition } from 'react-native-reanimated'

<Animated.View layout={LinearTransition.duration(200)}>
  {/* content that changes size */}
</Animated.View>
```

Also add `overflow: 'hidden'` on the animated view if its content can overflow the shrinking bounds during animation.

---

### 18. `expo-image-manipulator` new builder API (old `manipulateAsync` deprecated)

```typescript
// Deprecated (still works but shows warning)
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
await manipulateAsync(uri, [{ crop: {...} }], { compress: 0.8, format: SaveFormat.JPEG })

// Current API
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
const imageRef = await ImageManipulator
  .manipulate(uri)
  .crop({ originX, originY, width, height })
  .renderAsync()
const result = await imageRef.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })
```

---

### 19. `ALTER DATABASE SET` is blocked in the Supabase SQL editor

The Supabase dashboard SQL editor does not run as superuser:

> `permission denied to set parameter "app.supabase_url"`

This blocks the pattern of storing secrets as `current_setting('app.key')` DB parameters from within the editor. **Workaround:** Use Supabase Vault for secrets, or avoid `current_setting()` in triggers entirely and use an Edge Function instead (where `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are auto-injected as `Deno.env` variables).

---

### Quick start checklist

1. Check for dataless files: `ls -lO src/app/_layout.tsx` — should NOT show `dataless`
2. Run `npm install`
3. Run `npm start`
4. Scan QR in Expo Go — do NOT open `localhost:8081` in browser (triggers SSR crash)
