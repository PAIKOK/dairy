# Google login and sign-up — setup and testing

This is optional Google Identity Services authentication for A Little Life. Email/password login remains available. It does not enable Groq, Google Sheets, email forwarding, Google Drive, or contact enquiries.

## 1. Configure a Web application client in Google Cloud

Use a Google Cloud project you control. The public client ID supplied by the user is configured only in this computer’s ignored `.env` file; `.env.example` intentionally leaves it empty. No Google client secret is used for this ID-token flow.

1. Open Google Cloud Console and select the correct project.
2. Open **Google Auth Platform → Clients** (older navigation: **APIs & Services → Credentials**).
3. Select the intended **Web application** OAuth client. If you do not control the supplied client, create a new Web application client for A Little Life instead.
4. Under **Authorized JavaScript origins**, add the address you will actually open, including the port, with no path:
   - `http://localhost:5177`
   - `http://127.0.0.1:5177` if Google accepts this loopback origin for the client and you use that address.
   - Google’s local setup guide also recommends `http://localhost` for localhost testing.
5. Add your real HTTPS website origin after deployment. A GitHub repository URL is not the running website origin.
6. Save. If the OAuth app is in Testing and access is restricted, add your intended Google account under **Audience → Test users**. Check whether the app is Internal to a Workspace organisation or External; Internal apps cannot accept arbitrary personal Google accounts.
7. Review Branding, consent-screen display name, privacy/terms URLs, domain ownership and publishing/verification requirements before public use. Do not claim verification that has not been completed.

This implementation uses the JavaScript button’s popup callback, not a server OAuth-code redirect. It does not ask for a client secret, authorization-code exchange, Gmail/Sheets/Drive scopes, or refresh tokens.

Official setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

## 2. Configure this project locally

In `/Users/jks1/Desktop/dairy/.env`, keep only appropriate local configuration and add your public Web application client ID:

```dotenv
GOOGLE_CLIENT_ID=YOUR_WEB_APPLICATION_CLIENT_ID.apps.googleusercontent.com
```

The public ID is present in the ignored local file and in Vercel Production/Preview server settings. MongoDB persistence is configured separately. Never put a database password, webhook secret or private API key in frontend source. Do not paste secrets into chat. The Atlas/webhook values previously exposed in chat must be rotated separately; they are not used by this feature.

Restart `npm run dev` after changing environment settings. Open `http://localhost:5177/login` or `/signup`. Do not start a second development server on the same ports.

## 3. Use the feature

- **Existing linked diary:** Login → Continue with Google → choose the account using Google’s own button.
- **New Google diary:** Create an account → confirm the age/terms checkbox → Continue with Google. No diary password is required. Save the one-time recovery code before opening the diary.
- **Existing password diary:** Sign in with the diary password first → Settings → Google sign-in → confirm the current diary password → choose Google. Matching emails never silently merge accounts.
- **Unlink Google:** In Settings, confirm the diary password. Google-only diaries must first use their saved recovery code to add a diary password; the last sign-in method cannot be removed.
- **Google-only deletion:** Settings → Delete my local account → type DELETE → confirm with the Google account linked to that diary. A different Google account is refused. This deletes live local data, not exports or device backups.
- **Optional diary password:** Use the saved recovery code at `/recover`; this sets a diary password and rotates the recovery code while retaining the Google link.

Google’s script is not loaded automatically. The first local Continue button requests Google’s button; click Google’s rendered button to select an account. Cancelling the popup does not create an account. Retry starts a fresh five-minute request. After successful Google authentication, the app reloads before entering the private diary.

## 4. Security and privacy boundaries

The server uses `google-auth-library` to verify the signed ID token, audience, issuer and expiry, and then checks the verified email and nonce. An HttpOnly, SameSite=Strict challenge cookie binds a single-use database record to this browser. Link/delete challenges are also bound to the authenticated diary session. Google’s stable subject ID, not a browser-supplied email, maps to a private app account.

Only Google subject/email and ordinary account metadata are stored. No Google ID/access/refresh token is stored or logged. Linked identity metadata is included in the user’s private export and removed with the account. Google-only accounts have no usable password until they explicitly add one by recovery. This preview is not end-to-end encrypted or independently security-audited. Hosted sessions require verified TLS, exact HTTPS origins and Secure cookies; their identity/session state persists in MongoDB.

## 5. What is and is not tested

Tests use fake Google responses and local signed RSA fixtures. They do not make real provider calls. Browser tests intercept Google’s SDK with a clearly mocked test button; they are not evidence that Google’s actual account chooser or the supplied Cloud client is configured correctly.

```sh
npm test
npm run check
node --import tsx scripts/google-browser-test.mjs
```

On the other network, verify real signup, logout, login, reopening saved writing, linking a password account, and deleting a disposable Google-only test account. Do not bypass company TLS, proxies, Google verification, or browser security to make a blocked network pass. If Google reports an origin mismatch, correct the client’s Authorized JavaScript origins; do not disable ID-token verification.
