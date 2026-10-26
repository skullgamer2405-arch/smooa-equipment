# Vercel services configuration — demo Preview authorized

The root `vercel.json` configures two independently built services from the same root package/lockfile:

| Service | Runtime/build | Public routes |
| --- | --- | --- |
| `app` | Vite static frontend, `npm run build`, output `dist` | All remaining paths; known clean/HTML page aliases rewrite to `index.html` within this service |
| `api` | Node/Express, entrypoint `server.js` | `/api/*` and `/uploads/*`, preserving those prefixes |

`smo-eq/` is a retained legacy copy, not an independently maintained backend. It has no runtime caller in the current React application and is excluded from deployment. The user authorized the proposed topology and a demo-only Preview after reviewing the explanation; do not ask for that same authorization again. Production is not authorized.

For `VERCEL_ENV=preview`, the app build explicitly forces `VITE_DEMO_MODE=true` and uses Vite demo mode. The API returns HTTP 403 / `DEMO_MODE` for every `/api` and `/uploads` request before body parsing, Firebase Admin initialization or upload directory creation. `SMO_DEMO_MODE=true` or `VITE_DEMO_MODE=true` also enforce that backend guard. The UI uses session-scoped fixtures, local image previews and a visible demo banner; it does not need live credentials.

## Bindings and URLs

There are no internal services or server-to-server HTTP calls in this topology, so no service binding is declared. Browser calls in `src/lib/data.ts` and `src/components/admin-equipment.tsx` already use same-origin `/api/*`. The edge routes those requests directly to the public `api` service. A browser request is not a function-to-function call; a private runtime binding would not be available to the static bundle.

The Vite localhost proxy belongs only to the existing standalone `npm run dev` workflow. `vercel dev` dispatches the API paths using the top-level service rewrites. No binding variable is set manually or exposed through `VITE_*`.

Express exports its app for Vercel's Node handler and retains its standalone listener outside Vercel. The email admin link uses optional `PUBLIC_APP_URL`, otherwise Vercel's public `VERCEL_URL`, otherwise the local standalone origin. It does not use an internal service URL or the previous hardcoded Cloud Run host.

If the API should instead be private, confirm that change first: it requires an application-side function gateway plus a caller-side service binding and matching proxy handling. A static browser client cannot directly use a private binding. No unused gateway or dependency was added.

## Development and environment

```bash
npm ci
npm run build
npm run test:server
npm run dev:vercel
```

Use `vercel dev` for the complete services topology. Securely log in/link the Vercel project when the CLI requires it. For a local whole-topology demo, set both `SMO_DEMO_MODE=true` and `VITE_DEMO_MODE=true`; remote Preview mode automatically forces the sample frontend and blocks real API requests. Never add live credentials just to get the sample UI working. No credentials or real account values are added to Git.

The existing API uses Firebase Admin credentials and optional SMTP settings described in `.env.example`. Vercel project environment settings must supply those securely for live use; linking the Vercel plugin does not populate application credentials. `.vercelignore` excludes local secrets, tools, generated outputs, uploads and legacy reference copies.

## Storage and private data update

The current API stores validated PNG equipment images in persistent Firebase Storage through the authenticated API. Browser uploads must include a verified admin ID token. The old `/uploads/*` route remains read-only for existing assets; new uploads return Firebase Storage download URLs. Booking, email queue and LINE recipient state are Firestore-backed. See `ux-privacy-rollout.md` before switching on production APIs. The historical validation and Preview deployment notes below describe the earlier revision, not validation of the current hardening changes.

## Validation

The installed Vercel CLI 65.2.0 schema and service resolver accept this configuration, resolve `app` to `@vercel/static-build` and `api` to `@vercel/backends`, and accept both services sharing the root. Strict TypeScript, seven frontend unit cases, four isolated Express cases and the demo build passed. The Express checks verify unstripped API/upload paths, temporary upload read-back in non-demo mode, missing-token handling, both deployment/canonical email origins, and demo denial of JSON/multipart uploads, notifications and stored files even when conflicting flags are false. SMTP is mocked and no real credentials are inherited. Node server tests run through `npm run test:server`; Playwright collects only `*.spec.ts`.

## Successful Preview deployment

The earlier network/authentication blockers were resolved: Vercel CLI 65.2.0 is installed globally and authenticated. The existing `smocra-69/smooa-equipment` project is linked locally; `.vercel/` and `.env.local` (including its generated OIDC credential) stay ignored.

The failed Git deployment used the project's stale **Root Directory `smo-eq`** and Node framework override, so it did not load the repository-root service configuration. The project settings were corrected to the repository root (`rootDirectory: null`) and no global framework (`framework: null`); the frameworks are specified per service. The production branch remains `main`.

An explicit **Preview**, with `VITE_DEMO_MODE=true` for builds and `SMO_DEMO_MODE=true` at runtime, reached provider state **READY**:

- Preview: https://smooa-equipment-jawmyxah5-smocra-69.vercel.app
- Deployment: `dpl_Hddz6Djj7SDywBgGUNT5YxXBihu8`
- Build log confirms Vite demo mode, the backend `server.js` entrypoint and completed deployment.
- Existing Vercel deployment protection remains enabled; the owner may need to sign into Vercel to open the Preview.

No production deployment was promoted. During login troubleshooting, a Chromium walkthrough of this exact hosted Preview authenticated successfully with the documented demo account, with all external origins blocked. A separate reproduction showed that denying browser session storage prevented the old admin view from loading; this does not establish the cause on the owner’s browser. The demo now provides an explicit one-click login and falls back to in-memory fixtures/auth when storage is denied. Without storage, a page reload resets the demo session. Regression coverage includes incorrect credentials, one-click entry, fixture mutations, reload and logout with storage available and denied. The ignored `.local/vercel-preview/checkpoint.json` retains provider metadata and the deployment checkpoint. The old allowlisted demo archive is retained only as a fallback, not the source of this successful linked deployment.

## Agent setup

The official https://vercel.com/get-started.md guide was followed. The Vercel plugin installer could not find Vercel in this Codex marketplace, so the documented fallback installed nine global standalone skills from `vercel-labs/agent-skills`. Plugin commands are not claimed to be installed.

Codex's shared MCP endpoint `https://mcp.vercel.com` is configured in the agent's user configuration. Its first OAuth callback timed out; MCP authentication and authenticated `list_teams` verification remain pending. CLI authentication and CLI team access succeeded independently. Do not mistake one for the other or copy credentials into the repository.

Inside the restricted cloud shell, `XDG_CACHE_HOME=/tmp/smooa-vercel-auth/cache NODE_USE_ENV_PROXY=1 vercel ...` avoids writes to the read-only default cache and uses the configured network proxy. Authenticated CLI team commands also need write access to their own user configuration cache; use the platform permission flow rather than copying its auth file.
