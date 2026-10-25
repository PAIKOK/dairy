# Security, privacy, and launch review

This is a **preview edition** with MongoDB-first hosted storage and an explicit local SQLite developer mode, not a verified compliance offering.

## Implemented controls

- Development server explicitly denies backend/database file serving (including raw and @fs requests), disables cross-origin resource sharing and automatic browser-console forwarding, and sets basic response headers. Private storage cannot be configured inside public/client asset directories.
- Local development binds only to loopback. Vercel uses a separate API entry with trusted HTTPS origins, Secure cookies and MongoDB; no hosted SQLite fallback. The app does not access homebuilder data.
- Persistent, random opaque session tokens; only SHA-256 token digests stored server-side.
- HttpOnly, SameSite=Strict cookies (Secure on the hosted path), seven-day lifetime, persistent sessions, logout revocation and credential-generation checks.
- Salted scrypt password hashing. High-entropy recovery codes are shown once and stored as hashes.
- Constant-time secret comparisons, authentication limits and generic login failures.
- Same-origin checks on state-changing API requests; strict validation of incoming values and rejection of ownership fields.
- MongoDB owner-filtered queries, immutable owner/key validation, unique indexes and transactions protect private records/photos; an account write coordinates concurrent quota/content changes. Persistent HMAC-keyed rate counters are shared across instances. MongoDB administrator access is not native user-scoped RLS.
- In explicit local SQLite mode: owner-filtered database views, write triggers, and a SQLite authorizer that rejects direct private base-table access during user-scoped operations. Scoped operations are synchronous transactions; exceptions roll back changes.
- Personal notebook preferences are added by a non-destructive account-table migration. Stickers, ink geometry and page notes are validated, owner-scoped entry data; they are exported/deleted with the entry. No drawing pressure or timing telemetry is collected.
- Optimistic entry versions, serialized autosave, retained failed drafts, and idempotent retries of the same saved payload.
- Optional cover photos have owner-validated references enforced by server checks and SQLite triggers. Replacement is atomic and removes an unused old cover upload; memory references are retained. Cover data follows the same export/account-deletion path.
- Private authenticated photo endpoints, no-store/nosniff headers, browser re-encoding, server JPEG metadata filtering, dimension bounds, upload limits and an account storage quota.
- Locked letter bodies omitted until the server's opening-date check succeeds; no public sharing endpoints.
- Recovery/password changes invalidate old codes and sessions, with a transactional expected-hash check against concurrent changes.
- Account export excludes password, recovery and session hashes. Export intentionally includes sealed letter bodies and photo data.
- Account deletion requires current credentials, cascades live content/session deletion, and enables SQLite secure_delete. Storage-level copies and backups cannot be guaranteed erased by application code.
- No analytics, ads, embedded music players, or automatic diary-to-AI processing. App fonts remain self-hosted. Optional Google Identity Services loads only after choosing Google; Google may load its own identity UI resources under its policies.
- Google identity is verified server-side with the official library, then checked for issuer, audience, expiry, verified email and a single-use nonce bound to an HttpOnly cookie. Stable subject IDs map to accounts; identities are unique and cascade with deletion. Linking requires the current password and a bound app session, not just a matching email. Google-only deletion requires DELETE and the correct linked identity.
- Google ID/access/refresh tokens are not persisted or logged. Only subject/email linkage and short-lived hashed nonce records are stored. The supplied public client ID is local configuration; unrelated pasted credentials were not saved.

## Important limitations / human review

- Real Google sign-in on the intended network, client ownership/type, origins, OAuth app audience/testing status, branding/privacy domains, provider terms, and public publishing requirements need human verification. Automated Google flows use mocks. App logout does not sign out of the user’s Google browser account. The hosted entry requires HTTPS origins and sets Secure cookies. Real Google/Atlas runtime paths still require deployed verification.

- Content is readable to the machine's administrator. There is **no end-to-end encryption**, encrypted backups, or managed backup/recovery infrastructure.
- The optional loopback HTTP developer mode uses a non-Secure session cookie. Hosted mode sets Secure cookies and requires trusted HTTPS origins. Front-end CSP, the platform proxy/IP model, operational monitoring and hosting configuration still require review. Do not remove the local entrypoint’s loopback guard.
- Accounts do not verify email ownership. Recovery is by saved code, not email. There is no notification sender or email delivery service.
- The local SQLite architecture is not a multi-instance/cloud scaling plan. Quotas, migrations, operational recovery, lock contention, and volume limits need review before broader use.
- MongoDB persistence is implemented and locally replica-set tested; the real hosted Atlas connection remains a deployment check. There is no automatic SQLite-to-MongoDB account migration. Groq is not connected. A database password exposed in chat must be rotated separately in Atlas before any future integration.
- The optional Gemini REST route exists but is disabled without server configuration and was not tested against a real provider. Review provider retention, regions, contracts and request controls before enabling it for anyone else. There is no claim of zero third-party retention.
- No subscriptions, billing, or checkout exist. Publish accurate payment/refund terms only after a billing system is actually added.
- Policy pages are drafts. Operator identity, actual contact address, jurisdiction, consumer/privacy rights, age requirements, data-transfer terms, subprocessors, deletion/retention schedules, and enforceable terms need qualified review.
- Automated accessibility checks are limited. Manual screen-reader, browser/OS, input-device, cognitive/usability, and legal accessibility review remain advisable.

## Operational notes

Never commit `.env`, SQLite files, screenshots of real private entries, exported diaries, credentials, or recovery codes. Restrict access to the machine and encrypt its disk where appropriate. If archiving the database, stop the application first and protect the archive; account deletion does not rewrite already-created filesystem snapshots.
