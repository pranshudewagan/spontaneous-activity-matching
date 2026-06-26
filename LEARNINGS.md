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

### Quick start checklist

1. Check for dataless files: `ls -lO src/app/_layout.tsx` — should NOT show `dataless`
2. Run `npm install`
3. Run `npm start`
4. Scan QR in Expo Go — do NOT open `localhost:8081` in browser (triggers SSR crash)
