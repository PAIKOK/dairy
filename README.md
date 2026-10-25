# A Little Life — the 2027 diary

**Give every day a page of its own.**

Standalone project in `/Users/jks1/Desktop/dairy`. It does not use or modify the homebuilder application's accounts or data.

## Open / run

Use **Node.js 24 LTS** (24.10+ for the optional SQLite test mode). Local verification also ran with Node 26.3.1; Vercel is explicitly configured for Node 24.

MongoDB is the **primary** database. Configure `MONGODB_URI` in a private environment before starting; never put it in client source or a `VITE_` variable. The default database is `a_little_life_diary`.

```sh
cd /Users/jks1/Desktop/dairy
npm install --legacy-peer-deps  # only if dependencies are absent
# Configure the private .env using .env.example, then:
npm run dev
```

For an offline developer fixture only, opt in explicitly with `STORAGE_BACKEND=sqlite npm run dev`. Existing local SQLite writing remains untouched and is not automatically uploaded or migrated. SQLite is refused for hosted accounts, even if MongoDB is unavailable.

Frontend: `http://127.0.0.1:5177` · API: `http://127.0.0.1:4017`.

- `/` — public homepage with interactive calendar/diary preview
- `/demo` — clearly labeled sample diary; changes are in memory and reset on reload
- `/signup`, `/login`, `/recover` — email/password or optional Google account access, plus saved recovery-code flow
- `/diary` — personal writing desk and openable 3D diary cover
- `/diary/calendar`, `/diary/day/2027-01-01` — real calendars and daily editor
- `/diary/bookmarks`, `/diary/trackers` — kept-close pages and real-data graph-paper trackers
- `/diary/memories`, `/diary/goals`, `/diary/letters`, `/diary/soundtrack`
- `/diary/assistant`, `/diary/review`, `/diary/settings`
- `/privacy`, `/terms`, `/cookies`, `/refunds` — implementation-specific drafts

Do not start a second development server on the same ports. To use different ports:

```sh
CLIENT_PORT=5178 API_PORT=4018 npm run dev
```

The frontend and API must be on this computer. Public binding is deliberately refused by the local server entrypoint.

## Vercel deployment

`api/index.ts` runs the existing Express API with a pooled MongoDB connection. `vercel.json` routes `/api/*` to this function and routes diary/demo/auth/policy deep links to the Vite frontend. API requests never receive an HTML fallback.

The existing Vercel project already contains `MONGODB_URI`, `GOOGLE_CLIENT_ID` and an unrelated Groq key for Production and Preview. Their values were not printed or committed. The dedicated `MONGODB_DB`, exact `CLIENT_ORIGIN`, and generated private `RATE_LIMIT_SECRET` were added without changing those existing credentials. Groq remains disconnected.

Hosted requests require MongoDB, verified TLS, HTTPS origins and Secure cookies. A missing/unreachable database returns an error; there is no temporary-file or in-memory account fallback. The supplied site had no API before this change. Publishing source is not itself proof that Atlas networking, permissions, and a real Google login work; check `/api/status` after the new deployment reports Ready.

See `docs/VERCEL-DEPLOYMENT.md` for deployment setup, collection mapping, failure modes and verification boundaries.

## The summer notebook

The whole site uses warm, physical stationery surfaces: summer cream, honey, sage and soft rose. Covers, page stacks, photo prints, envelopes, record sleeves and paper planners have native CSS/SVG depth rather than a new 3D framework.

- Open a personal diary cover. Pull the lower-right corner left for the next day or the lower-left corner right for the previous day. A short pull returns the page; Escape cancels. Clicking a corner, Enter/Space, and the previous/next links remain available. Page changes wait for autosave and stop on a save error.
- Use Close book above or below the writing tools to return to the closed diary. Reopening keeps the page you closed in this navigation session. Every section’s Back to my diary link returns to that same writing desk. The app logo opens the main website homepage instead.
- In Make this book mine, optionally upload a JPEG/PNG/WebP front-cover photo (up to 15 MB before normalization), or keep a default linen cover. Cover photo uploads/removal save immediately; other preferences save with This feels like me. Removal requires confirmation. Photos are private, included in exports, and removed with the account; unshared previous cover uploads are removed when replaced.
- Personalise the cover name/colour and default paper/handwriting.
- Choose ruled, dotted, plain or graph paper and plum, blue or forest ink per page.
- Type in the self-hosted Caveat handwriting font or use clean print. Doodle with a mouse, touch or stylus. Select Eraser and rub over a line to erase that entire stroke; your typed words and stickers are unaffected. Undo/redo restores drawing or erasing while the page is open. The My pen drawer also has a keyboard-accessible stroke erase list. This is whole-stroke erasing, not pixel erasing, handwriting recognition or OCR.
- Add illustrated stickers and sticky notes; drag, nudge with arrow keys, rotate, resize and remove with confirmation.
- Use ribbon bookmarks to keep pages close.
- Read graph-paper mood, saved-word-count and habit trackers. Missing moods stay blank; data tables provide an accessible alternative to the graphs.
- On narrow screens, switch between the writing page and reflection page. Flat view and reduced-motion support remain available.

Cover choices, stickers, notes, paper/ink/font choices and freehand geometry persist in the account and are included in exports. The old SQLite account/entry schema is upgraded without deleting existing writing; this migration is tested. No pressure/timing telemetry, external font requests, or AI processing of drawings is added.

Limits: 30 stickers and 30 ink strokes per daily page, with bounded stroke coordinates/point counts. Failed saves retain the page state in the open tab.

## Optional Google login and sign-up

Google access is implemented alongside email/password login. The Google SDK loads only when the user chooses Google; there is no automatic One Tap prompt. Signup requires the age/terms checkbox and shows a saved recovery-code handoff. Existing password accounts must sign in and confirm their diary password in Settings before linking Google; matching emails never silently merge accounts.

Only a public Google Web application client ID is required: set `GOOGLE_CLIENT_ID` server-side in the ignored `.env` file and authorize the local/live origins in Google Cloud. No Google client secret or Drive/Sheets/Gmail permission is used. The public client ID is configured in private server settings, including Vercel; it is not embedded in Git. The test account chooser and verifier are mocked in automated tests. **Real sign-in with the supplied Google client is not tested yet**, at the user’s request; it must be checked on the other network after the client’s origins/audience are configured.

Google-only accounts can delete their diary after typing DELETE and reauthenticating with the linked Google account. Their saved recovery code can add a diary password. Password-equipped accounts can unlink Google after password confirmation; the only login method cannot be removed.

See `docs/GOOGLE-SIGN-IN.md` for the exact console steps, local configuration, network-error handling, and real-account test checklist. Contact webhooks, Google Sheets and Groq are not enabled by Google sign-in. MongoDB persistence is implemented separately. Previously exposed database/webhook secrets were not copied into this project and must be rotated separately.

## Saved data and recovery

All saved user content uses MongoDB for hosted accounts:

| Collection | Saved data |
|---|---|
| `accounts` | Email, optional nickname, credential hashes, timezone/week start, notebook/cover preferences |
| `entries` | Daily writing, moods, bookmarks, paper/ink/font, sticky notes, stickers and doodles |
| `photos`, `memories` | Private JPEG bytes, photo captions/alt text/dates, cover photographs |
| `goals` | Goal milestones, habits and dated check-ins |
| `letters` | Future letters, opening dates and their original time zones |
| `songs` | Soundtrack links, artists, dates and memory notes |
| `sessions`, `google_identities`, `google_challenges` | Server-side sign-in state and Google linkage; no plaintext tokens |
| `rate_limits` | Short-lived keyed counters; no raw IP address |

Calendars, trackers, bookmarks, constellations and year reviews read this saved data; they do not create separate competing stores. Demo changes remain in memory, clearly labeled. Unsaved drafts remain in their open tab. AI prompt text is not newly retained or sent automatically; only suggestions explicitly inserted and saved into an entry become diary data.

Private queries include the authenticated owner. MongoDB validators tie immutable document IDs to their owners; unique indexes, transactions and account-scoped write coordination prevent owner reassignment and conflicting/quota-breaking writes. This is not end-to-end encryption or a claim of native MongoDB row-level-security roles. Service/database administrators can access stored content.

**Save the recovery code shown after signup.** Password changes/recovery replace the old code and revoke old sessions. Email recovery is not configured. Settings exports owned content, photos and **sealed letters**, never password/recovery/session hashes. Deletion removes live owned records, not prior exports or hosting backups. Photos are limited to 20 MB per account.

The optional local SQLite mode retains its existing private file permissions, scoped views and write checks. Existing local accounts are not silently merged into cloud accounts; migration requires a separate, reviewed step.

## Autosave and dates

Autosave is serialized per day and runs after a 600 ms typing pause; Save now flushes immediately. Writing made during an in-flight save is retained and saved next. Failed saves retain drafts in the open tab; retry is explicit. Optimistic versions refuse conflicting overwrites. Navigation waits for pending saves. Closing/reloading a tab with unsaved writing triggers the browser's warning. Private drafts are not cached in localStorage, so do not discard a failed-save tab before recovering/copying the text.

Dates are `YYYY-MM-DD` values. Calendar arithmetic is independent of timestamps; Today and habit check-ins use the profile's IANA time zone. Week starts are configurable. Year navigation supports 1900–2200, including leap years. Letters keep the time zone chosen when written and unlock on the server at midnight on their selected day. They are not emailed, and their seal is an app feature, not time-lock encryption.

## Optional AI

Curated writing prompts work without an external provider. The existing Gemini REST path is disabled unless `GEMINI_API_KEY` and `GEMINI_MODEL` are configured server-side. Text is sent only after per-request consent. A real AI call has not been tested. Groq has no adapter in this change; its existing Vercel key was left untouched.

## Checks

```sh
npm run test:vercel-runtime # after vercel build: native emitted-function startup, no tsx
npm run check           # TypeScript for client/server/tests, then production frontend build
npm test                # date, autosave, privacy, API, recovery, export/deletion and persistence tests
npm run test:browser:mongo # isolated MongoDB + full Chrome journeys, then cleanup
npm run test:browser    # with npm run dev running: Chrome journeys, screenshots and axe checks
node --import tsx scripts/google-browser-test.mjs # mocked Google signup/login/link/unlink/deletion and responsive checks
node scripts/eraser-test.mjs # whole-stroke erasing, undo/redo, real persistence, keyboard/touch, narrow layouts
node scripts/notebook-interactions-test.mjs # drag-to-turn, failed saves, closing, photo covers, mobile touch
node scripts/diary-home-test.mjs # logos open the homepage; Back/Close keep the diary desk; save/error guards
node scripts/notebook-test.mjs # saved covers, stickers, freehand ink, bookmarks, trackers, responsive book
node scripts/notebook-review.mjs # covers, photo dialogs, notebook/drawer screenshots and accessibility review
node scripts/extra-checks.mjs # targeted keyboard, leap-year UI, motion, filtering, confirmation and resize checks
```

The browser suite defaults to the installed macOS Google Chrome executable. Override `CHROME_PATH` or `TEST_URL` if necessary. It uses disposable test accounts and removes the account on completion. Screenshots/results go into ignored `artifacts/`. API tests use and remove temporary SQLite databases, never your real diary database. The deterministic JPEG fixture can be regenerated with `node scripts/make-test-photo.mjs`.

See `PROGRESS.md` for the current verification state and `docs/SECURITY-AND-LAUNCH.md` for launch limitations. Passing automated checks is not an independent security audit or legal-compliance certification.

## Source map

- `client/Notebook*.tsx`, `notebook.css`, `summer.css` — personal 3D diary, stationery tools, trackers and the whole-site summer skin
- `client/Landing.tsx`, `styles.css`, `icons.tsx` — editorial identity and native illustrations
- `client/Workspace.tsx`, `EntryQueue.ts` — private/demo state, navigation protection, autosave
- `client/DiaryPages.tsx`, `CollectionPages.tsx`, `SettingsPages.tsx` — purpose-specific product flows
- `api/index.ts`, `server/bootstrap.ts`, `mongo-store.ts`, `storage.ts` — Vercel entry, MongoDB-first persistence and async storage contract
- `server/app.ts`, `store.ts`, `photos.ts`, `password.ts` — shared API, opt-in local store and security boundaries
- `shared/` — shared date logic, data types, validated input contracts

The app uses React, React Router, Express, Zod, and Vite. Fonts and sample images are self-hosted; see `docs/ASSETS.md` for provenance and font licenses.

## Native server-module check

Server/API/shared imports use `.js` specifiers so Vercel’s emitted ES modules resolve under native Node. `npm run check` includes a separate NodeNext server check. After `vercel build --prod`, run `npm run test:vercel-runtime`; it loads the emitted function without tsx and verifies a handled JSON 503 with intentionally missing configuration. This test cannot connect to real MongoDB. A successful package build alone is not a runtime startup test.
