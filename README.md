# A Little Life — the 2027 diary

**Give every day a page of its own.**

Standalone project in `/Users/jks1/Desktop/dairy`. It does not use or modify the homebuilder application's accounts or data.

## Open / run

Requires **Node.js 24.10 or newer** (tested here with Node 26.3.1). SQLite is built into Node; no MongoDB credentials are required.

```sh
cd /Users/jks1/Desktop/dairy
npm install --legacy-peer-deps  # only needed if node_modules is absent
npm run dev
```

Frontend: `http://127.0.0.1:5177` · API: `http://127.0.0.1:4017`.

- `/` — public homepage with interactive calendar/diary preview
- `/demo` — clearly labeled sample diary; changes are in memory and reset on reload
- `/signup`, `/login`, `/recover` — local account access and recovery-code flow
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

Cover choices, stickers, notes, paper/ink/font choices and freehand geometry persist in the local account and are included in exports. The old SQLite account/entry schema is upgraded without deleting existing writing; this migration is tested. No pressure/timing telemetry, external font requests, or AI processing of drawings is added.

Limits: 30 stickers and 30 ink strokes per daily page, with bounded stroke coordinates/point counts. Failed saves retain the page state in the open tab.

## Local storage and recovery

Real accounts persist in `server/data/little-life.sqlite`, **not localStorage**. The data directory is mode 0700 and the database 0600. Private data is owner-filtered in server repository access and database views, with SQL authorization and write checks. This is not end-to-end encryption: a computer operator or device backup can access the file.

**Save the recovery code shown after sign-up.** Email reset is not configured. Password changes and recovery replace the old recovery code and revoke old sessions. If you lose both the password and the saved code, there is no automated recovery for this edition.

Settings exports JSON containing the account, entries, goals/habits, song links, **sealed letters**, and photo data. Keep exports private. Account deletion requires the password and the word DELETE; it erases live database content, not existing exports or filesystem snapshots.

Photos are normalized in the browser, validated on the server, and served only through authenticated endpoints. Per-account photo storage is limited to 20 MB.

## Autosave and dates

Autosave is serialized per day and runs after a 600 ms typing pause; Save now flushes immediately. Writing made during an in-flight save is retained and saved next. Failed saves retain drafts in the open tab; retry is explicit. Optimistic versions refuse conflicting overwrites. Navigation waits for pending saves. Closing/reloading a tab with unsaved writing triggers the browser's warning. Private drafts are not cached in localStorage, so do not discard a failed-save tab before recovering/copying the text.

Dates are `YYYY-MM-DD` values. Calendar arithmetic is independent of timestamps; Today and habit check-ins use the profile's IANA time zone. Week starts are configurable. Year navigation supports 1900–2200, including leap years. Letters keep the time zone chosen when written and unlock on the server at midnight on their selected day. They are not emailed, and their seal is an app feature, not time-lock encryption.

## Optional AI and MongoDB

No AI provider is active by default. Curated writing prompts work without external processing. To configure the optional Gemini REST path after a privacy/provider review, copy `.env.example` to `.env` and set `GEMINI_API_KEY` and `GEMINI_MODEL` server-side. Only pasted text is sent after per-request consent. A real provider call has **not** been tested in this build.

**MongoDB and Groq are not connected.** Cloud connection tests are deferred; the shared credentials have not been copied into project files or used for requests. Groq has no adapter in this build.

**MongoDB is not connected.** Do not put a real URI in this build expecting it to migrate data. The entrypoint explicitly refuses a nonempty MONGODB_URI rather than silently using another database. A separately tested MongoDB adapter and migration are still required. Never paste database passwords into chat or commit `.env`.

## Checks

```sh
npm run check           # TypeScript for client/server/tests, then production frontend build
npm test                # date, autosave, privacy, API, recovery, export/deletion and persistence tests
npm run test:browser    # with npm run dev running: Chrome journeys, screenshots and axe checks
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
- `server/app.ts`, `store.ts`, `photos.ts`, `password.ts` — local API and storage/security boundaries
- `shared/` — shared date logic, data types, validated input contracts

The app uses React, React Router, Express, Zod, and Vite. Fonts and sample images are self-hosted; see `docs/ASSETS.md` for provenance and font licenses.
