# Security, privacy, and launch review

This is a **local development edition**, not a production deployment or verified compliance offering.

## Implemented controls

- Development server explicitly denies backend/database file serving (including raw and @fs requests), disables cross-origin resource sharing and automatic browser-console forwarding, and sets basic response headers. Private storage cannot be configured inside public/client asset directories.
- Local-only server binding; separate standalone database from the homebuilder app.
- Persistent, random opaque session tokens; only SHA-256 token digests stored server-side.
- HttpOnly, SameSite=Strict cookies, seven-day lifetime, logout revocation and account-session removal.
- Salted scrypt password hashing. High-entropy recovery codes are shown once and stored as hashes.
- Constant-time secret comparisons, authentication limits and generic login failures.
- Same-origin checks on state-changing API requests; strict validation of incoming values and rejection of ownership fields.
- Owner-filtered database views, write triggers, and a SQLite authorizer that rejects direct private base-table access during user-scoped operations. Scoped operations are synchronous transactions; exceptions roll back changes.
- Personal notebook preferences are added by a non-destructive account-table migration. Stickers, ink geometry and page notes are validated, owner-scoped entry data; they are exported/deleted with the entry. No drawing pressure or timing telemetry is collected.
- Optimistic entry versions, serialized autosave, retained failed drafts, and idempotent retries of the same saved payload.
- Optional cover photos have owner-validated references enforced by server checks and SQLite triggers. Replacement is atomic and removes an unused old cover upload; memory references are retained. Cover data follows the same export/account-deletion path.
- Private authenticated photo endpoints, no-store/nosniff headers, browser re-encoding, server JPEG metadata filtering, dimension bounds, upload limits and an account storage quota.
- Locked letter bodies omitted until the server's opening-date check succeeds; no public sharing endpoints.
- Recovery/password changes invalidate old codes and sessions, with a transactional expected-hash check against concurrent changes.
- Account export excludes password, recovery and session hashes. Export intentionally includes sealed letter bodies and photo data.
- Account deletion requires current credentials, cascades live content/session deletion, and enables SQLite secure_delete. Storage-level copies and backups cannot be guaranteed erased by application code.
- No analytics, ads, social SDKs, remote font requests, embedded music players, or automatic diary-to-AI processing.

## Important limitations / human review

- Content is readable to the machine's administrator. There is **no end-to-end encryption**, encrypted backups, or managed backup/recovery infrastructure.
- The loopback-only HTTP build uses a non-Secure session cookie. Before any public use, add HTTPS, Secure cookies, front-end security headers/CSP, a verified reverse-proxy model, hardened operational configuration, and abuse monitoring. Do not simply remove the loopback guard.
- Accounts do not verify email ownership. Recovery is by saved code, not email. There is no notification sender or email delivery service.
- The local SQLite architecture is not a multi-instance/cloud scaling plan. Quotas, migrations, operational recovery, lock contention, and volume limits need review before broader use.
- No MongoDB adapter or migration is implemented; Groq is also not connected. Tests against those services are deferred. A database password exposed in chat must be rotated separately in Atlas before any future integration.
- The optional Gemini REST route exists but is disabled without server configuration and was not tested against a real provider. Review provider retention, regions, contracts and request controls before enabling it for anyone else. There is no claim of zero third-party retention.
- No subscriptions, billing, or checkout exist. Publish accurate payment/refund terms only after a billing system is actually added.
- Policy pages are drafts. Operator identity, actual contact address, jurisdiction, consumer/privacy rights, age requirements, data-transfer terms, subprocessors, deletion/retention schedules, and enforceable terms need qualified review.
- Automated accessibility checks are limited. Manual screen-reader, browser/OS, input-device, cognitive/usability, and legal accessibility review remain advisable.

## Operational notes

Never commit `.env`, SQLite files, screenshots of real private entries, exported diaries, credentials, or recovery codes. Restrict access to the machine and encrypt its disk where appropriate. If archiving the database, stop the application first and protect the archive; account deletion does not rewrite already-created filesystem snapshots.
