# A Little Life — build progress

Project: `/Users/jks1/Desktop/dairy`
Updated: October 24, 2026

## Current step
**Google login/sign-up complete in code; local mocked tests and final regressions passed. The requested GitHub update is being published. Real Google sign-in remains deferred to the other network.**

- Drag a lower paper corner for the next/previous day. Short pulls snap back; save failures block a turn. Escape, pointer cancellation, flat view, and reduced motion are supported.
- Visible Close book controls above and below the editor save first, return to the closed-book desk, and keep the current date for reopening.
- Optional personal cover photos use authenticated photo storage. Default linen covers remain available; removing a cover asks for confirmation.
- Each diary section has one shared Back to my diary link to the writing desk. In-app logos now open the main website homepage (`/`), while Back to my diary and Close book keep the writing-desk destination; redundant page-specific return links were removed.
- Type / Doodle / Eraser controls are available on mobile and desktop. The eraser removes whole ink strokes, not individual pixels; undo/redo restores erasing while the page is open. A stroke list provides keyboard erasing. Text and stickers are untouched.

Requested next: MongoDB, Groq, and public hosting. No MongoDB/Groq adapter or public deployment has been added. The approved Google feature adds the official google-auth-library dependency only. The user switched npm to the public registry and removed the private lockfile URL. GitHub publication of this existing local build to PAIKOK/dairy has been requested; cloud integration remains a separate, unapproved phase. Private diary data is not part of the source repository. The cloud database name requested for the next phase is a_little_life_diary; it is not configured or used yet.

Preview: `http://127.0.0.1:5177` · Personal notebook: `http://127.0.0.1:5177/demo/day/2027-05-15`

MongoDB and Groq connections/testing are **deferred at the user’s request**. Their shared credentials have not been copied into project files or tested. The app remains on local SQLite and curated writing prompts; no real AI provider is active.

## Google authentication
- [x] Optional Continue with Google choices on login and signup, alongside the existing forms.
- [x] Google-only signup, age/terms confirmation, recovery-code handoff and normal private app sessions.
- [x] Official server-side signature/audience/issuer/expiry verification plus one-time browser-bound nonce checks.
- [x] Stable Google subject IDs; matching emails never auto-merge accounts.
- [x] Password-confirmed linking/unlinking in Settings; no removal of the only sign-in method.
- [x] Google-only deletion after DELETE plus the correct linked Google identity; existing password deletion remains available.
- [x] No Google SDK request before choosing Google; no ID/access/refresh token persisted or logged.
- [x] Public client ID configured only in ignored local .env; no pasted contact or database secret saved.
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
- `node --import tsx scripts/google-browser-test.mjs`: **9 mocked journey groups and 7 selected axe/overflow scans passed**. No real Google account chooser or provider call was exercised.
- `npm run build`: passed as a separate command, in addition to the build included in `npm run check`.
- `node scripts/eraser-test.mjs`: **7 journey groups passed**, including real persistence, undo/redo, pointer/touch cancellation, keyboard erasing, text/sticker preservation, and 375/320px layout/selected axe checks.
- `node scripts/notebook-interactions-test.mjs`: **19 journey groups and 4 viewport scans passed**, covering drag gestures, navigation cancellation, real/failed saves, keyboard controls, date boundaries, closing/reopening and private cover photos.
- `node scripts/diary-home-test.mjs`: **41 checks passed**: 30 tab-return journeys, 3 unchanged Close book checks, 6 logo-to-homepage checks at 1440/375/320px, and 2 private-account save/error navigation checks. The disposable account was deleted successfully.
- `npm run check`: passed, client/server/shared/tests TypeScript plus production frontend build.
- `npm test`: **39 passed, 0 failed**, including the new decoration/preferences contracts, owner checks and legacy-data migration.
- `npm run test:browser`: final serial rerun passed **18 end-to-end journey groups** and **48 page/viewport inspections**, with no horizontal overflow, selected axe findings, uncaught page errors, or automatic external HTTP(S) requests. An earlier retry timed out at signup; the harness now asserts the actual signup HTTP result and marks a successful test account for cleanup before waiting for the handoff screen. No production rate limit or authentication control was relaxed.
- `node scripts/notebook-test.mjs`: **10 notebook journey groups passed**, including real account persistence for covers, drag/keyboard sticker adjustments, freehand ink, notes, export, bookmarks, tracker values, mobile pages, and normal/reduced-motion page turning.
- `node scripts/extra-checks.mjs`: **8 targeted checks passed**, including keyboard date boundaries, leap-year UI, search, habits, deletion confirmation, motion styles and menu resizing.
- `node scripts/notebook-review.mjs`: **28 layout/accessibility checks passed** at 1440/768/375/320px, covering default/photo covers, preferences, removal confirmation, editor and stationery drawer.
- Screenshots visually reviewed for the summer homepage, 3D/photo cover on mobile, pointer-driven paper turns on desktop/mobile, the 320px eraser toolbar, open notebook on desktop/mobile, and earlier calendar/garden/letter layouts. Not every generated screenshot has been manually cold-read.
- Disposable browser test accounts were deleted successfully. API fixtures use temporary databases and do not erase the real diary database.

## Remaining / human review
- MongoDB adapter and migration; Groq adapter; cloud connection tests on the intended network.
- Any real AI-provider request (not configured or tested).
- Public HTTPS/Secure cookies, deployment headers/CSP review, scaling, backups and operational hardening.
- Email verification/recovery/delivery; current recovery uses an offline saved code.
- Operator/business details, jurisdiction, asset rights, provider contracts and legal/policy review.
- Broader manual screen-reader, physical-device and cross-browser testing.

See README.md, docs/VERIFICATION.md and docs/SECURITY-AND-LAUNCH.md. These checks do not constitute a security audit, complete accessibility assessment, or legal-compliance certification.
