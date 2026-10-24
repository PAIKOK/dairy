# Verification record — October 24, 2026

## Google authentication additions

- `npm test`: 11 new Google-auth tests passed, including optional configuration, verified signup, age/terms, one-time nonce/cookie binding, replay/expiry/cross-origin rejection, invalid claims, stable-subject ownership, no email auto-merge, password-confirmed linking/unlinking, recovery and Google-only deletion. A locally generated RSA key/token fixture exercises the production Google verifier with the certificate-fetch method mocked; no real provider network is used.
- `node --import tsx scripts/google-browser-test.mjs`: 9 journey groups and 7 selected axe/overflow scans passed at desktop/375/320px. Signup/login, actual local persistence, password fallback, linking, unlinking, wrong-account deletion rejection, correct Google-only deletion, consent and blocked SDK loading were exercised with a deliberately mocked Google button/credential verifier.
- Final `npm run check`, `npm test` (39 passed), `npm run build`, the 9 mocked Google journeys/7 scans, and the existing 18-group/48-view browser suite were rerun after the Google changes and passed. The existing suite observed no automatic external requests.
- Real Google credentials, the actual Google account chooser/FedCM behavior, the supplied Cloud OAuth client, authorized origins/audience, and other-network sign-in are not verified. No company network restriction was bypassed.

## Final results

- `npm run build` — passed separately, as well as through the check command.
- `node scripts/eraser-test.mjs` — 7 eraser journey groups passed; keyboard, trusted touch, cancellation, repeated undo/redo, real persistence, text/sticker preservation and 375/320px selected axe/overflow checks.
- `node scripts/notebook-interactions-test.mjs` — 19 journey groups and 4 viewport checks passed for dragging, closing, autosave/error paths and private cover photos.
- `node scripts/diary-home-test.mjs` — 41 checks passed: 30 tab-return journeys, 3 Close book checks, 6 top/menu-logo homepage checks at 1440/375/320px, and 2 private-account save-before-navigation/failure-retention checks. No runtime errors; test account deletion returned 200.

- `npm run check` — passed: TypeScript client/server/shared/tests and Vite production build.
- `npm test` — 39 passed, 0 failed, 0 skipped (including 11 Google-auth tests).
- `npm run test:browser` — final serial rerun passed 18 journey groups and 48 page/viewport inspections. An earlier retry timed out at signup; the test now asserts the actual signup HTTP result and marks a created account for cleanup before the UI wait. No production auth limits or checks were bypassed.
- `node scripts/notebook-test.mjs` — 10 real-account notebook journey groups passed.
- `node scripts/notebook-review.mjs` — 28 layout/selected axe checks at 1440/768/375/320px, including cover upload/removal dialogs and the stationery drawer.
- `node scripts/extra-checks.mjs` — 8 additional targeted interaction checks passed.
- 48 page/viewport inspections in the full browser suite: no horizontal overflow and no findings in the selected WCAG 2 A/AA + 2.1 AA axe checks.
- No uncaught page errors or automatic external HTTP(S) requests observed in the full browser suite.
- Direct requests for the local database, backend source, raw-query variants, and the @fs database path returned 403 without authentication.

## Approved logo-only update

Only the two app-logo instances in Workspace were changed to use the existing public-home Logo default (`/`). Back to my diary and Close book destinations were not changed. `npm run check`, all 28 unit/API tests, and the 41 focused navigation checks passed after this change. No packages, lockfile, database implementation, environment settings, Git state, or deployment configuration were changed. The previous full-site browser run remains the broader baseline; it was not rerun for this two-link fix.

## Latest notebook additions

The moving sheet uses an inert copy of the visible writing/reflection leaf, including text, stickers and ink. Pointer position changes the paper angle without re-rendering the whole notebook every move. Short pulls and reversed gestures return; committed turns flush real saves first. Mouse, trusted Chromium touch, keyboard alternatives, Escape, pointer cancellation, lost capture, year/leap-day boundaries, flat view and reduced motion were tested.

Close book is available above and below the editor, returns to the closed diary, and keeps the closed date for reopening in that navigation session. Save errors keep the editor and its text open. All tabs share the writing desk as their explicit return destination.

Cover-photo uploads use the existing JPEG normalization, authenticated storage, quota and export/deletion paths. New tests verify server and database ownership checks, atomic replacement, reclaiming bytes at the photo quota, rejection of invalid/oversized data, preservation of shared memory photos, default-cover removal and account deletion with an active cover. No real personal photo was used by these tests.

The eraser removes whole ink strokes intersected by its swept pixel-radius path; it does not do partial/pixel erasing. Ink dots, fast crossings, misses, page-size changes, mouse/touch cancellation, repeated undo/redo and persistence were checked. The stroke list provides keyboard deletion. Undo history stays in the open page and is not persisted as another copy of removed ink.

Desktop/mobile paper turns, the mobile photo cover, and the full 320px eraser layout were visually reviewed. Other captured cover/dialog layouts received selected automated checks; not every screenshot was manually cold-read.

## Summer notebook redesign

Personal covers and defaults persist across reload; ruled/dotted/plain/graph paper, ink and handwriting choices save per page. Stickers add, drag, move by keyboard, rotate and scale; note text saves. Freehand pointer strokes, undo/redo, reflection notes, ribbon bookmarks and tracker values are verified against the real local API and exported data. A legacy eight-column account database and saved entry survive the non-destructive preferences migration.

Normal 3D page turning was checked through a running Web Animation and completed route navigation; flat view and reduced-motion navigation also passed. Current screenshots were reviewed for a clean opaque paper surface and usable mobile tool layout.

The previous flat/editorial UI verification was the baseline, not evidence for the changed UI. The counts above reflect the final summer redesign reruns.

## What was actually exercised

Calendar arithmetic, all 365 2027 dates, January/December weekday accuracy, leap-year and year-boundary arithmetic, timezone-sensitive Today, month selection, 2028 leap-day UI, keyboard date boundaries, week-start settings, text search, and correct daily entry routes.

Account signup with validation and password visibility; one-time recovery-code handoff; protected dashboard; real entry/mood persistence across reload; failed autosave retention and explicit retry; edits made during in-flight saves; optimistic conflicts and idempotent retries; navigation guards.

Browser-normalized photo upload, authenticated photo display, metadata stripping tests, memory preview, constellation links, goal milestones and growing SVG state, habit check-ins, sealed letter body omission, server opening-date enforcement, letter opening, music links, local writing prompts, preferences, full export with photo data and sealed letters, password change, recovery, session revocation, individual deletion, and account deletion.

Two-user isolation was checked on server data, entry mutation, goals, letters, photos and memories. SQLite transactions were checked for rollback after exceptions; private database permissions and reopen persistence were checked.

Native confirmation cancel/delete paths, skip link, mobile drawer keyboard behavior, resizing an open drawer, normal/reduced-motion animation styles, and search empty/reset states were checked.

## Screens and environment

Installed macOS Google Chrome driven through Playwright, Node 26.3.1. Responsive views are browser viewport emulation, not tests on physical phones.

- Homepage: 320, 375, 768 and 1440 px.
- All twelve demo workspace pages: desktop and 375 px mobile.
- Calendar/editor: 768 px tablet.
- Populated private workspace pages: 375 px mobile; private review also desktop; bookmarks/trackers are included.
- Policy pages and signup/error handling: desktop.

Screenshots are in ignored `artifacts/`. The summer homepage, 3D diary cover on desktop/mobile, open notebook on desktop/mobile, and earlier calendar/garden/letter compositions were visually reviewed, including the final wrapping diary title. Not every generated screenshot was manually cold-read.

## Test data handling

The API suite uses disposable temporary SQLite databases and removes them. The browser journey suite creates a clearly artificial account and deletes it at the end. Extra checks use only the in-memory demo. No real diary, database credential, or recovery code was written into the result summaries.

## Not verified / not provided

MongoDB or Groq connection tests (explicitly deferred), a real AI-provider call, MongoDB integration/migration, email verification or email delivery, public deployment, managed backups, multi-instance scale, other browser engines, physical mobile devices, or a manual screen-reader/security/legal audit. Automated accessibility checks are not a complete accessibility-compliance determination.

See SECURITY-AND-LAUNCH.md for required human review before public availability.
