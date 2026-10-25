# Vercel + MongoDB — October 25, 2026

## What changed

MongoDB is the default and only hosted account store. `api/index.ts` exposes the existing Express routes as a Vercel function. `vercel.json` directs `/api/*` to the function and known React page paths to `/index.html`; assets and private APIs are not swallowed by SPA fallback. Node 24 is explicitly selected.

All saved pages use the shared asynchronous storage contract: accounts/preferences, daily entries and decorations, private photos/gallery, goals/habits, letters, songs, sessions, Google identity/challenge state and distributed abuse limits. The default database is `a_little_life_diary`. See README for the collection map. Demo data and unsaved drafts are not silently uploaded. No extra retention of AI inputs or plaintext credentials was added.

## Existing project environment

The linked project is the existing `dairy` project associated with the supplied `dairy-five-gules.vercel.app` site. Vercel lists MONGODB_URI and GOOGLE_CLIENT_ID for Production and Preview; an unrelated GROQ_API_KEY also exists. These values were neither printed nor committed. Vercel marks the MongoDB URI as sensitive and prevents downloading it for local execution, so no real Atlas connection was verified from this laptop.

Required server-only configuration:

- `MONGODB_URI`: existing connection, left unchanged. Do not prefix with VITE_.
- `MONGODB_DB=a_little_life_diary`: explicitly configured.
- `CLIENT_ORIGIN`: the exact HTTPS diary origin, explicitly configured for the supplied site. Preview adds only the platform-provided deployment URL.
- `RATE_LIMIT_SECRET`: generated private value, configured without printing or committing it.
- `GOOGLE_CLIENT_ID`: existing optional Google public Web client ID, left unchanged.

The database name, origin and rate-limit secret were added for Production and Preview. Groq and other optional AI processing are not enabled by the storage integration.

## Storage and failure behavior

One pooled MongoClient/app is reused per warm instance. Rejected initialization can retry later. The driver requires verified TLS on the hosted path. Transactions require Atlas, a replica set or sharded MongoDB; a standalone nontransactional server is refused.

All collections are initialized with strict structural validators. Private record/photo `_id` values must match their owner/key fields, so an update cannot reassign ownership while retaining the immutable ID. Queries are owner-filtered on the server; unique owner indexes and per-owner transaction coordination protect concurrent entries, quota accounting and related cover/memory changes. MongoDB does not provide a native per-user SQL RLS policy here; administrator/database-credential access remains privileged.

Sessions and nonce challenges persist in MongoDB. Expiry is enforced during authentication, not just by eventual TTL cleanup. Cookie tokens/recovery codes are stored only as hashes. Credential generations prevent stale in-flight logins from resurrecting revoked sessions. Hosted cookies are Secure/HttpOnly/SameSite=Strict; writes check trusted origins. Shared rate counters store HMAC-keyed addresses rather than raw IPs and expire shortly.

Existing collections with an incompatible validator are refused for a reviewed migration, not silently modified. Database permissions must allow the intended collection/index initialization. No existing local SQLite accounts are automatically migrated or merged. Private local files, environment files, the .vercel directory, and test artifacts are ignored by Git.

Missing configuration, network restrictions or rejected database access return a real error (initialization returns 503), never success or a temporary SQLite fallback. `STORAGE_BACKEND=sqlite` is an explicit local-only developer mode and is refused on Vercel.

## Verify after publication

1. Wait for the new Git-triggered deployment to report Ready.
2. Open the signup deep link directly; it should render the form, not Vercel’s 404.
3. Check `GET /api/status`: expect storage `mongodb`.
4. Create a disposable account; keep its recovery code. Save text/mood/decorations, a photo, a goal/habit, a letter, a song and settings. Reload and revisit each.
5. Verify another account cannot see that data. Export, recover and delete the disposable account.
6. Check real Google login separately; the automated provider flows use mocks. Authorize the exact HTTPS browser origin in Google Cloud.

If status returns 503, review Atlas network access, URI/database permissions, replica-set support and required environment names in Vercel. Do not disable TLS verification, enable wildcard CORS, expose a private database file, or weaken Google audience/nonce/signature checks. Do not post connection passwords in chat or Git.

## Verification boundaries

Tests use a real disposable local MongoDB replica set, never Atlas personal data. They cover persistence across clients/reconnection, all saved page types, owner rejection in the API and database validator, concurrent entry/quota behavior, transaction rollback, Google nonce persistence, exports, recovery and deletion. The full Chrome journey also runs against MongoDB. Separate legacy SQLite and mocked Google regressions preserve local behavior.

Local/fixture tests are not proof of the live Atlas network path, a real Google account chooser, managed backups, legal compliance or an independent security audit. Production policies/operator details, regions, backups, email ownership verification/recovery and broader accessibility/device checks still need review.

## October 25 runtime-startup correction

After the first MongoDB commit, the live deployment invoked the API but returned HTTP 500 FUNCTION_INVOCATION_FAILED. Native import of the emitted function reproduced ERR_MODULE_NOT_FOUND for extensionless server/bootstrap. The tsx-based tests and package-only build had not exercised this path. Server/API/shared relative imports now use emitted .js paths. A separate NodeNext compiler check and a plain-Node built-function startup regression protect this runtime boundary. Server-side initialization logs include only error type/numeric code, never a URI, credential, raw error message or diary input. Non-JSON HTTP 5xx responses are now described as server errors rather than claiming the API is undeployed.

Correction checks passed: NodeNext server type checking, 70 automated tests, Vercel production packaging, and the native emitted-function import/handled-JSON-503 smoke test. A live re-deployment check is still required after this commit.
