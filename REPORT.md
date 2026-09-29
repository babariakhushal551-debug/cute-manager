# Curio — Engineering Report

**Date:** 2026-09-30 · **Branches:** master & lite (synced) · **Build:** `36629854212`

---

## 1. Requested changes

| # | Request | Status |
|---|---------|--------|
| 1 | New app name (not cringe/common) | ✅ **Curio** — bundle `com.freecuff.curio`, scheme `curio://`, extension `CurioShare`, chosen via user poll |
| 2 | Share sheet opens & instantly closes, nothing lands in app | ✅ **Root-caused & fixed** (see §2.1) |
| 3 | AI must understand reels/shorts/photos and plan accordingly | ✅ **Built-in AI + vision** (see §2.2), keys wired from `Project no. 2/.env` via GitHub secrets |

## 2. Root causes found & fixed

### 2.1 Share flash-close (the big one)
**Root cause:** `expo-share-intent` passes share payloads through an **iOS App Group**. Free Apple-ID profiles (Sideloadly) **cannot create App Groups**. Its extension force-unwraps `containerURL(forSecurityApplicationGroupIdentifier:)!` → instant crash for media (your millisecond flash), and for links the data write lands nowhere → app opens with nothing.

**Fix:** new local config plugin `plugins/curio-share` — completely entitlement-free:
- Links/text → JSON payload percent-encoded **inside** the `curio://curio-data?payload=…` deep link (no App Group, no UserDefaults)
- Images → system **Pasteboard** (15-min expiry), app pulls via `expo-clipboard` and saves a local file
- Extension always completes its request cleanly; handoff via the responder-chain `openURL` (safe in extensions)
- App side: `app/curio-data.tsx` route ingests the payload with nonce dedupe and a race-safe hydration wait, then routes to Inbox
- Verified structurally: plists parse, no leftover placeholders, no `UIApplication.shared`, balanced braces, all error paths complete the request

### 2.2 AI understanding (vision + transcription + failover)
- **Built-in keys**: `EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_GROQ_API_KEY`, `EXPO_PUBLIC_OPENROUTER_API_KEY` injected at build time from GitHub Actions secrets (job-level env — they must exist when Metro bundles during `xcodebuild`)
- **All 3 keys validated live** against their APIs (HTTP 200); models validated too: `gemini-3.8-flash` ✅ (3.7-flash returned 503 — why failover matters), `openai/gpt-oss-20b` ✅, `openrouter/free` ✅
- **Owner's priority honored**: gemini → openrouter → groq, with automatic provider failover
- **Vision**: shared screenshots are downscaled (`expo-image-manipulator`, 1280px JPEG), sent to the vision model, described in the *same* classification round-trip (one network call), stored as `ocrText` → feeds category, summary, tags, and Library search
- **Voice**: transcription moved to Gemini audio (Whisper endpoints removed); fixes the crash from `getInfoAsync` which no longer exists in `expo-file-system` (SDK 54+ barrel) — now uses `expo-file-system/legacy`
- **OpenRouter** added as a first-class Settings provider; auto mode shows "Built-in AI is active" in Settings

### 2.3 Extra bugs found & fixed along the way
| Bug | Fix |
|---|---|
| `transcription.ts` called removed `FileSystem.getInfoAsync` → runtime crash on every voice note | legacy API import |
| `package.json` name still `cute-manager` | renamed to `curio` |
| Storage keys `@cute-manager/*` would orphan existing user data after rename | one-time `LEGACY_KEY` migration in `hydrate()` |
| Workflow artifact name didn't match README | `cute-manager-unsigned-ipa-${{ github.ref_name }}` |
| `@expo/plist` CJS interop (`plist.build is not a function`) | `.default` import |
| Plugin export shape rejected by Expo ("must export a function") | callable `module.exports` |
| Manual base64 %encoding would be double-encoded by `URLComponents` | documented exact chain: Swift %-encodes → URLComponents re-encodes → router decodes once → JS decodes once |
| Identical re-shares swallowed by dedupe | per-share UUID nonce in payload |
| `UIApplication.shared` (compile error in extension context) | responder-chain walk |
| Safari HTML shares without `og:url` | graceful degrade: title captured as text |
| Two vision round-trips per image (latency/cost) | merged into single classification call |
| Dead `resolveProvider` after refactor | removed |

## 3. Verification performed
- `tsc --noEmit` strict — **passes** (after every cycle)
- `expo export --platform ios` — full Metro bundle builds (validates app.json + plugin resolution)
- Plugin dry-run: real files written to temp dir, plists parsed, Swift source linted structurally
- Live API validation of all 3 keys + 4 models
- GitHub secrets confirmed present (names listed, values never displayed)

## 4. Known limitations (by design, free-profile constraints)
1. **Videos/files from the share sheet** can't round-trip through the pasteboard as data — the app explains and offers the in-app + button (photos, links, text all work)
2. Only the **first** attachment of a multi-photo share is ingested
3. Bundle ID changed (`com.freecuff.cutemanager` → `com.freecuff.curio`) → installs as a **new app**; old export data can be re-imported via Settings → Export
4. Keys ship inside the bundle (required for built-in AI on a free profile — no server) — acceptable for personal use; rotate if the IPA leaks
5. `lite` branch now mirrors `master` (its diagnostic purpose is served — root cause found)

## 5. Next steps
- Build `36629854212` → IPA → Sideloadly → **Settings → VPN & Device Management → Trust** (new app!)
- First-run: Share → More → enable **Curio** in the share sheet
