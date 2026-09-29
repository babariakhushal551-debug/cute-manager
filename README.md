# Curio 🎀

**Your personal AI manager for everything you save, think about, and want to do.**
*Stop saving things for later. Turn them into actions today.*

A native iOS app (React Native + Expo, SF Symbols, Liquid-Glass-style blur, haptics) that
turns the loop **Save → Forget** into **Capture → Understand → Plan → Do → Review**.

## What it does

- **Universal capture** — a floating **+** button captures text, links, screenshots, PDFs.
- **Share from anywhere** — in Instagram, YouTube, WhatsApp, Safari, Photos: tap
  **Share → Curio** and the reel/link/screenshot lands in your Inbox.
  (Entitlement-free share extension — works with free Apple-ID sideloads.)
- **AI understanding, built in** — every capture (including screenshots and photos,
  via on-device vision requests) is auto-classified (category, intent, tags),
  summarized, and scored for actionability. Works out of the box with built-in
  provider keys (Gemini → OpenRouter → Groq failover); or plug in your own
  OpenAI / Gemini / Groq / OpenRouter key in Settings. Offline-only mode available.
- **Voice notes with AI transcription** — recorded memos are transcribed by the
  built-in AI and become searchable text.
- **Intent clarity** — unsure items ask one tiny question: *"Why did you save this?"*
  (Try it / Learn it / Reference) — implementation-intention style, no guilt.
- **Projects with tiny tasks** — one tap turns a saved idea into a project broken into
  3–7 tasks, each ≤ 30 min, with if-then plans (*"If it's 8pm at my desk, then…"*).
- **Today / One-thing focus** — a single highlighted next action with a built-in focus
  timer. No dashboard overload.
- **Library** — everything saved as reference is searchable (titles, summaries, OCR).
- **Review** — weekly Save→Do funnel, momentum stats, and gentle stale-idea cleanup.
- **Rituals** — optional morning/evening local notifications.
- **Privacy-first** — 100% on-device storage, export anytime, AI keys never leave the
  phone except to the provider you choose. Offline-only mode available.

## Repository layout

```
cute-manager/            (historical folder name; app is Curio)
├── app/                    # expo-router screens
│   ├── (tabs)/             # Today, Inbox, Projects, Library, Review, Settings
│   ├── capture.tsx         # quick capture modal
│   ├── curio-data.tsx      # share-extension handoff route (curio://curio-data)
│   ├── item/[id].tsx       # item detail
│   └── project/[id].tsx    # project detail
├── src/
│   ├── ai/                 # AI abstraction: classify, vision, transcribe, plan
│   ├── capture/            # link metadata + share handoff intake
│   ├── data/               # local-first store (AsyncStorage)
│   ├── services/           # notifications, haptics, vision, transcription
│   ├── theme/              # design tokens (Apple-style)
│   └── ui/                 # primitives, error boundary, floating capture button
├── plugins/curio-share/    # local config plugin: entitlement-free share extension
├── scripts/gen-icons.mjs   # generates app icon / adaptive / splash
└── .github/workflows/      # cloud IPA build (see below)
```

## How the share extension works (no App Groups!)

Free Apple IDs cannot create App Groups, which is why the previous
`expo-share-intent` build flashed and died on share. Curio's extension
(`plugins/curio-share`) instead:

1. Receives the share (link / text / photos).
2. Links & text → embedded directly into a `curio://curio-data?payload=…` deep link.
3. Photos → written to the system Pasteboard, referenced by the deep link
   (auto-expires in 15 minutes), then saved as a local file by the app.
4. The app ingests the payload on the `curio-data` route and routes to the Inbox.

No entitlements, no App Group, no paid developer account needed.

## Install on your iPhone (no Mac needed)

The app is compiled **in the cloud** by GitHub Actions, then signed on your PC with
your own Apple ID using [Sideloadly](https://sideloadly.io) (free, Windows + macOS).

### 1. Build the IPA
1. Push this repo to GitHub (public repo = free macOS runners).
2. Open the **Actions** tab → **Build iOS IPA** → **Run workflow**.
3. Wait ~15–25 min, then download the artifact **cute-manager-unsigned-ipa-<branch>** (e.g. `cute-manager-unsigned-ipa-master`, contains `cute-unsigned.ipa`).

### 2. Get Sideloadly ready
1. Install **Sideloadly** on your Windows PC and **iTunes** (Apple's — needed for USB
   drivers; the Microsoft Store version does not work).
2. Connect your iPhone by USB. Trust the computer when asked.

### 3. Sign & install
1. Open Sideloadly → drag in `cute-unsigned.ipa`.
2. Enter your **Apple ID** (an app-specific password is best:
   appleid.apple.com → Sign-In and Security → App-Specific Passwords).
3. Click **Start**. Wait ~2 min.
4. On the iPhone: **Settings → General → VPN & Device Management** → tap your Apple ID
   → **Trust**.
5. Open **Curio** 🎀 — first run: tap Share in Instagram/YouTube → **More** →
   enable **Curio** so it appears in every share sheet.

> Free Apple ID limits: app signature lasts **7 days**, then re-sideload (Sideloadly
> remembers the IPA; it takes 2 minutes). Max 3 sideloaded apps per device.

### Built-in AI keys

The cloud build injects the bundled AI keys from GitHub Actions secrets
(`EXPO_PUBLIC_GEMINI_API_KEY`, `EXPO_PUBLIC_GROQ_API_KEY`,
`EXPO_PUBLIC_OPENROUTER_API_KEY`) at build time — see `.env.example`.
They live inside the app bundle, so the AI works on a fresh install with zero setup.
For local builds, copy `.env.example` to `.env` and fill in keys.

### Testing without installing (optional)
```bash
cd cute-manager
npm install
npx expo start            # scan QR with Expo Go (Android/iOS) for a quick feel
```
Note: the **share extension** only exists in the real IPA build, not Expo Go.

## Local development

```bash
npm install
npm run typecheck         # strict TypeScript
npm run prebuild          # regenerate native ios/ dir (includes share extension)
npm run ios               # requires macOS + Xcode
```

## Roadmap (from the PRD)

- [x] MVP: capture, AI pipeline, inbox, projects/tasks, Today focus, review
- [x] Phase 2: native iOS share sheet (Instagram/YouTube/WhatsApp/Photos)
- [x] AI vision for screenshots/photos + voice transcription
- [ ] OCR via Vision framework (on-device)
- [ ] Calendar sync (Google/Outlook) and automatic time-blocking
- [ ] Semantic (embedding) search and related-item graph
- [ ] Android share target
