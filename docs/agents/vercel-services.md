# Vercel services — official release preparation

Use the existing Vercel project at repository root with Node24. The owner selected Vercel as the official host and Firebase as its backend. Current code prepares Production; it does not establish live credentials, provider entitlement or an already promoted release. Follow [production setup](../production-setup.md).

| Service | Build/runtime | Public routing |
| --- | --- | --- |
| `app` | Vite → `dist`; frontend release checks before non-Preview build | Remaining paths, with clean and `.html` aliases |
| `api` | Node/Express `server.js`; API release checks for Production | `/api/*` and `/uploads/*`, preserving prefixes |

No internal service-to-service HTTP calls exist; no binding is required. The static browser calls same-origin `/api/*`, which Vercel routes to `api`. Do not expose or invent a runtime binding in a VITE variable. Vite's localhost proxy is for local development; `npm run dev:vercel` tests the complete services topology.

Preview always builds demo fixtures and blocks API/uploads before any real side effect. It cannot test actual Firebase/email/LINE. Keep this isolation. Use a separate Vercel project with its own Production environment and isolated Firebase test project for real integration tests. Never point tests at borrower data.

Public Firebase config comes from explicit `VITE_FIREBASE_*` values. API credentials are server-only and must match the selected client project/bucket. No service account, Messaging token, SMTP password or cron secret belongs in VITE variables. `npm run release:check` validates configuration without contacting services or printing secrets. Successful checks do not establish permissions/delivery.

`PUBLIC_APP_URL` is the only source for admin email links and must be credential-free HTTPS. There is no fallback to a preview or internal URL. SMTP requires TLS. Apps Script alternative requires an explicit URL+signing secret; persisted admin settings override that default, including an empty saved URL.

Security headers are applied at top-level Vercel routing and Express, with a regression check for matching values. CSP allows the app's Firebase/LINE endpoints, local fonts, raster/data/blob images and inline styles; it denies framing, objects and inline scripts. If a custom Firebase auth domain or a future SDK endpoint is introduced, verify the exact new origin before extending policy. Local production-browser tests cover rendering, QR and printing; actual LINE webview behavior remains a release check.

New images use validated non-interlaced PNG produced by the browser and persistent Firebase Storage. Legacy `/uploads` is read-only; old files are excluded from Vercel uploads and must be explicitly migrated if needed. Keep `smo-eq`, old `public/js` and opaque ZIPs excluded. Typeset's imported CSS remains a build input.

CI validates pull requests/main and the Preview branch, with read-only GitHub token permissions and pinned actions. It runs UI/API/build, genuine demo Firestore/Storage rules-emulator tests and production CSP browser tests. It does not deploy Firebase Hosting. Deploy root rules/indexes explicitly as part of the rollout; changing hosting alone never updates them.

Prior Preview deployments and historical CLI authentication are not current authentication proof. If deployment tools require login, authenticate in the provider's secure browser flow. Do not copy tokens into Git or chat. Linking a plugin does not populate Firebase/LINE/SMTP settings.

Release/rollback must use a reviewed current-root deployment. Never select legacy source/rules as rollback. A Vercel rollback does not revert database changes, rules, external provider settings or secrets.
