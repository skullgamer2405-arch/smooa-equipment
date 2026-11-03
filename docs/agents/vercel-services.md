# Vercel services — official release preparation

Use the existing Vercel project at repository root with Node24. The owner selected Vercel as the official host and Firebase as its backend. Current code prepares Production; it does not establish live credentials, provider entitlement or an already promoted release. Follow [production setup](../production-setup.md).

| Service | Build/runtime | Public routing |
| --- | --- | --- |
| `app` | Vite → `dist`; frontend release checks before non-Preview build | Remaining paths, with clean and `.html` aliases |
| `api` | Node/Express `server.js`; API release checks for Production | `/api/*` and `/uploads/*`, preserving prefixes |

No internal service-to-service HTTP calls exist; no binding is required. The static browser calls same-origin `/api/*`, which Vercel routes to `api`. Do not expose or invent a runtime binding in a VITE variable. Vite's localhost proxy is for local development; `npm run dev:vercel` tests the complete services topology.

Preview always builds demo fixtures and blocks API/uploads before any real side effect. It cannot test actual Firebase/email/LINE. Keep this isolation. Use a separate Vercel project with its own Production environment and isolated Firebase test project for real integration tests. Never point tests at borrower data.

Public Firebase config comes from explicit `VITE_FIREBASE_*` values. API credentials are server-only and must match the selected client Firebase project. No service account, Messaging token, SMTP password or cron secret belongs in VITE variables. `npm run release:check` validates configuration without contacting services or printing secrets. Successful checks do not establish permissions/delivery.

`PUBLIC_APP_URL` is the only source for admin email links and must be credential-free HTTPS. There is no fallback to a preview or internal URL. SMTP requires TLS. Apps Script alternative requires an explicit URL+signing secret; persisted admin settings override that default, including an empty saved URL.

Security headers are applied at top-level Vercel routing and Express, with a regression check for matching values. CSP allows the app's Firebase/LINE endpoints, local fonts, raster/data/blob images and inline styles; it denies framing, objects and inline scripts. If a custom Firebase auth domain or a future SDK endpoint is introduced, verify the exact new origin before extending policy. Local production-browser tests cover rendering, QR and printing; actual LINE webview behavior remains a release check.

New equipment images use server-only signed Cloudinary image uploads. The browser accepts PNG/JPEG/WebP sources up to 10 MiB, 4096px per side and 16 million pixels, then prepares a PNG up to 3 MiB for the unchanged `/api/upload-image` endpoint. The API strictly validates PNG and re-encodes it to a canonical PNG up to 10 MiB. The fixed Cloudinary image-upload endpoint needs no CSP widening. Legacy image URLs and `/uploads` routes remain; `.vercelignore` excludes old files, so those assets are not guaranteed on Vercel. Confirm original sources still work before rollout. No automatic image migration or deletion occurs. Keep `smo-eq`, old `public/js` and opaque ZIPs excluded. Typeset's imported CSS remains a build input.

CI validates pull requests/main and the Preview branch, with read-only GitHub token permissions and pinned actions. It runs UI/API/build, genuine demo Firestore/Storage rules-emulator tests and production CSP browser tests. It does not deploy Firebase Hosting. Deploy root rules/indexes explicitly as part of the rollout; changing hosting alone never updates them.

Prior Preview deployments and historical CLI authentication are not current authentication proof. If deployment tools require login, authenticate in the provider's secure browser flow. Do not copy tokens into Git or chat. Linking a plugin does not populate Firebase/LINE/SMTP settings.

Release/rollback must use a reviewed current-root deployment. Never select legacy source/rules as rollback. A Vercel rollback does not revert database changes, rules, external provider settings or secrets.

Cloudinary setup: [beginner Thai guide](../cloudinary-setup.md). In the intended project’s Production environment, scope `CLOUDINARY_CLOUD_NAME` (Config) and `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (Secret) to `api` only. Never use `VITE_` or expose these to `app`. The four required public Firebase selectors are Config; optional `VITE_FIREBASE_STORAGE_BUCKET` may remain. `FIREBASE_STORAGE_BUCKET` is unused. `FIREBASE_SERVICE_ACCOUNT_JSON` remains an API-only Secret, with Cloud Datastore User and Firebase Authentication Viewer roles; no Firebase Storage role, bucket or Blaze plan is required. Gmail/LINE release gates still apply. The owner must confirm the current Cloudinary Free plan accepts the full 10 MiB canonical output and available quota. Do not enable automatic paid upgrades; Free provides no uptime SLA. No live provider integration is established by offline checks.

The Storage section of the old 27-page [Thai PDF](../../static/manuals/setup-guide-th.pdf) is obsolete for new uploads; use the Cloudinary guide above. The PDF itself remains unchanged.
