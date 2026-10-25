# A Little Life — build progress

Project: `/Users/jks1/Desktop/dairy`
Updated: October 25, 2026

## Current step
**MongoDB-first persistence and the Vercel API are implemented and locally verified. Publication to main was requested. Live Atlas connectivity and real Google sign-in remain deployed-site checks.**

- MongoDB is the default; SQLite requires explicit local opt-in and is refused on Vercel.
- Every saved account/page feature uses the shared storage layer, including private photos, decorations, habits, sessions and Google challenge state.
- Owner-filtered queries, immutable owner/key validation, transactions, conflict checks and shared abuse counters are implemented and real replica-set tested.
- The existing Vercel MONGODB_URI and Google client ID remain unchanged and outside Git. Database/origin/rate-limit settings were added for Production/Preview.
- The Vercel API function and separate React deep-link routing are included. No temporary-file persistence or fake save/auth success was added.
- Existing SQLite files remain local and are not silently migrated. Groq/real AI processing remain disabled by this change.

- Drag a lower paper corner for the next/previous day. Short pulls snap back; save failures block a turn. Escape, pointer cancellation, flat view, and reduced motion are supported.
- Visible Close book controls above and below the editor save first, return to the closed-book desk, and keep the current date for reopening.
- Optional personal cover photos use authenticated photo storage. Default linen covers remain available; removing a cover asks for confirmation.
- Each diary section has one shared Back to my diary link to the writing desk. In-app logos now open the main website homepage (`/`), while Back to my diary and Close book keep the writing-desk destination; redundant page-specific return links were removed.
- Type / Doodle / Eraser controls are available on mobile and desktop. The eraser removes whole ink strokes, not individual pixels; undo/redo restores erasing while the page is open. A stroke list provides keyboard erasing. Text and stickers are untouched.

The existing source remote is PAIKOK/dairy. The Vercel project associated with the supplied site is linked only through ignored local metadata. Its sensitive MongoDB variable cannot be downloaded by the CLI, so no local Atlas credential was copied or local Atlas connection claimed. The primary database name is `a_little_life_diary`.

Local browser checks use disposable data, never the supplied Atlas database. The original deployed site returned 404 for signup/API routes before these source changes; deployment readiness must be checked after publication.

## Google authentication
- [x] Optional Continue with Google choices on login and signup, alongside the existing forms.
- [x] Google-only signup, age/terms confirmation, recovery-code handoff and normal private app sessions.
- [x] Official server-side signature/audience/issuer/expiry verification plus one-time browser-bound nonce checks.
- [x] Stable Google subject IDs; matching emails never auto-merge accounts.
- [x] Password-confirmed linking/unlinking in Settings; no removal of the only sign-in method.
- [x] Google-only deletion after DELETE plus the correct linked Google identity; existing password deletion remains available.
- [x] No Google SDK request before choosing Google; no ID/access/refresh token persisted or logged.
- [x] Public client ID configured in private local/Vercel settings; no contact or database secret committed.
- [ ] Real Google sign-in and supplied Cloud client/origin/audience configuration on the intended network.

## Redesigned experience
- [x] Warm cream, honey, sage and rose physical-stationery treatment across the homepage, account pages, calendar, gallery, garden, letters, soundtrack, writing room, review, settings and policy pages.
- [x] Personal 3D diary cover on a writing desk, with a real opening animation.
- [x] Open two-page notebook: handwritten or print writing, reflection page, saved sticky note, graph paper, and personal keepsakes.
- [x] Pointer-driven perspective page-turning, short-drag snap-back, an optional flat view, and reduced-motion support.
- [x] Stationery drawer: nine SVG sticker types, drag positioning, keyboard nudging, rotation, scaling, editable sticky-note text, and confirmation before removal.
- [x] Freehand ink, whole-stroke pointer/touch erasing, keyboard erasing, and undo/redo; no OCR or external drawing processing.
- [x] Saved paper types, ink colours, writing style and personal cover preferences.
- [x] Ribbon bookmarks with a working kept-close pages list.
- [x] Real-data mood/word/habit graphs, adjustable date ranges, data tables and habit check-ins.
- [x] Narrow-screen writing/reflection switching and an accessible mobile tool drawer/menu.
- [x] Cover/page preferences, stickers, notes and ink geometry persist, export, and delete with the account.
- [x] Non-destructive SQLite upgrade preserves existing accounts and writing.

## Latest observed verification
- `node --import tsx scripts/google-browser-test.mjs`: **17 journey groups and 10 selected axe/overflow scans passed** on October 25. Includes settings HTTP/network/HTML/invalid-response retry, preserved inputs, signup 404 rejection, an intercepted hosted-origin mobile fixture, and the existing mocked Google flows. No real Google account chooser or provider call was exercised.
- `npm run build`: passed as a separate command, in addition to the build included in `npm run check`.
- `node scripts/eraser-test.mjs`: **7 journey groups passed**, including real persistence, undo/redo, pointer/touch cancellation, keyboard erasing, text/sticker preservation, and 375/320px layout/selected axe checks.
- `node scripts/notebook-interactions-test.mjs`: **19 journey groups and 4 viewport scans passed**, covering drag gestures, navigation cancellation, real/failed saves, keyboard controls, date boundaries, closing/reopening and private cover photos.
- `node scripts/diary-home-test.mjs`: **41 checks passed**: 30 tab-return journeys, 3 unchanged Close book checks, 6 logo-to-homepage checks at 1440/375/320px, and 2 private-account save/error navigation checks. The disposable account was deleted successfully.
- `npm run check`: passed, client/server/shared/tests TypeScript plus production frontend build.
- `npm test`: **69 passed, 0 failed** on October 25, including real MongoDB replica-set persistence for every page, owner validation, cross-instance sessions, concurrent save/quota behavior, rollback, Secure cookies, stale-login revocation, recovery/deletion, plus legacy SQLite and routing/error regressions.
- `npm run test:browser:mongo`: the final MongoDB-backed regression passed **18 end-to-end journey groups** and **48 page/viewport inspections**, with no horizontal overflow, selected axe findings, uncaught page errors, or automatic external HTTP(S) requests. An earlier retry timed out at signup; the harness now asserts the actual signup HTTP result and marks a successful test account for cleanup before waiting for the handoff screen. No production rate limit or authentication control was relaxed.
- `node scripts/notebook-test.mjs`: **10 notebook journey groups passed**, including real account persistence for covers, drag/keyboard sticker adjustments, freehand ink, notes, export, bookmarks, tracker values, mobile pages, and normal/reduced-motion page turning.
- `node scripts/extra-checks.mjs`: **8 targeted checks passed**, including keyboard date boundaries, leap-year UI, search, habits, deletion confirmation, motion styles and menu resizing.
- `node scripts/notebook-review.mjs`: **28 layout/accessibility checks passed** at 1440/768/375/320px, covering default/photo covers, preferences, removal confirmation, editor and stationery drawer.
- New screenshots visually reviewed for the desktop Google-settings error, 320px signup API error, and 320px hosted-origin missing-service fixture. The fixture is not a deployed Vercel test. Earlier screenshots visually reviewed for the summer homepage, 3D/photo cover on mobile, pointer-driven paper turns on desktop/mobile, the 320px eraser toolbar, open notebook on desktop/mobile, and earlier calendar/garden/letter layouts. Not every generated screenshot has been manually cold-read.
- Disposable browser test accounts were deleted successfully. API fixtures use temporary databases and do not erase the real diary database.

- Live Vercel checks on October 25: `/` and `/index.html` returned 200; direct `/signup`, Google settings, `POST /api/signup` and `/api/status` returned 404. No production account was created. The page rewrites remain local and have not been verified on Vercel after deployment.

## Remaining / human review
- Real deployed Atlas network/permissions checks, optional reviewed migration of old local accounts, and any future Groq adapter.
- Any real AI-provider request (not configured or tested).
- Deployment/CSP and platform-proxy review, scaling, encrypted backups and operational hardening. Hosted Secure cookies and exact HTTPS origin enforcement are implemented/tested, not a full security audit.
- Email verification/recovery/delivery; current recovery uses an offline saved code.
- Operator/business details, jurisdiction, asset rights, provider contracts and legal/policy review.
- Broader manual screen-reader, physical-device and cross-browser testing.

See README.md, docs/VERIFICATION.md and docs/SECURITY-AND-LAUNCH.md. These checks do not constitute a security audit, complete accessibility assessment, or legal-compliance certification.

## Dependency review
MongoDB uses the official driver. The test-only replica-set helper is not part of the API runtime and its install-time binary download is disabled. The observed Vite/Zod/body-parser advisories were patched; the subsequent npm audit reported zero vulnerabilities. This is not an independent security audit.

- Final local Vercel production packaging check (`vercel build --prod`) passed; the API function was included. This is a packaging check, not a live Atlas or Google test.

## October 25 runtime-startup correction

After the first MongoDB commit, the live deployment invoked the API but returned HTTP 500 FUNCTION_INVOCATION_FAILED. Native import of the emitted function reproduced ERR_MODULE_NOT_FOUND for extensionless server/bootstrap. The tsx-based tests and package-only build had not exercised this path. Server/API/shared relative imports now use emitted .js paths. A separate NodeNext compiler check and a plain-Node built-function startup regression protect this runtime boundary. Server-side initialization logs include only error type/numeric code, never a URI, credential, raw error message or diary input. Non-JSON HTTP 5xx responses are now described as server errors rather than claiming the API is undeployed.

Correction checks passed: NodeNext server type checking, 70 automated tests, Vercel production packaging, and the native emitted-function import/handled-JSON-503 smoke test. A live re-deployment check is still required after this commit.
