# Cute Manager 🎀

**Your personal AI manager for everything you save, think about, and want to do.**
*Stop saving things for later. Turn them into actions today.*

A native iOS app (React Native + Expo, SF Symbols, Liquid-Glass-style blur, haptics) that
turns the loop **Save → Forget** into **Capture → Understand → Plan → Do → Review**.

## What it does

- **Universal capture** — a floating **+** button captures text, links, screenshots, PDFs.
- **Share from anywhere** — in Instagram, YouTube, WhatsApp, Safari, Photos: tap
  **Share → Cute Manager** and the reel/link/screenshot lands in your Inbox.
  (Enabled via a real iOS Share Extension.)
- **AI understanding** — every capture is auto-classified (category, intent, tags),
  summarized, and scored for actionability. Works fully offline with the built-in
  engine; optionally plug in OpenAI, Gemini, or Groq in Settings.
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
cute-manager/
├── app/                    # expo-router screens
│   ├── (tabs)/             # Today, Inbox, Projects, Library, Review, Settings
│   ├── capture.tsx         # quick capture modal
│   ├── item/[id].tsx       # item detail
│   └── project/[id].tsx    # project detail
├── src/
│   ├── ai/                 # AI abstraction: classify, summarize, breakDownGoal, plan
│   ├── capture/            # link metadata + share-extension intake
│   ├── data/               # local-first store (AsyncStorage) — PRD schema
│   ├── services/           # notifications, haptics
│   ├── theme/              # design tokens (Apple-style)
│   └── ui/                 # primitives + floating capture button
├── scripts/gen-icons.mjs   # generates app icon / adaptive / splash
└── .github/workflows/      # cloud IPA build (see below)
```

## Install on your iPhone (no Mac needed)

The app is compiled **in the cloud** by GitHub Actions, then signed on your PC with
your own Apple ID using [Sideloadly](https://sideloadly.io) (free, Windows + macOS).

### 1. Build the IPA
1. Push this repo to GitHub (public repo = free macOS runners).
2. Open the **Actions** tab → **Build iOS IPA** → **Run workflow**.
3. Wait ~15–25 min, then download the artifact **cute-manager-unsigned-ipa**
   (contains `cute-unsigned.ipa`).

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
5. Open **Cute Manager** 🎀 — first run: tap Share in Instagram/YouTube → **More** →
   enable **Cute Manager** so it appears in every share sheet.

> Free Apple ID limits: app signature lasts **7 days**, then re-sideload (Sideloadly
> remembers the IPA; it takes 2 minutes). Max 3 sideloaded apps per device.

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
- [ ] Voice notes with transcription · OCR via Vision framework
- [ ] Calendar sync (Google/Outlook) and automatic time-blocking
- [ ] Semantic (embedding) search and related-item graph
- [ ] Android share target
