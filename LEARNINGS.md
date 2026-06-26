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

### Quick start checklist

1. Check for dataless files: `ls -lO src/app/_layout.tsx` — should NOT show `dataless`
2. Run `npm install`
3. Run `npm start`
4. Scan QR in Expo Go — do NOT open `localhost:8081` in browser (triggers SSR crash)
