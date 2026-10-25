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

## Storage decision still required

The old upload code writes into the repository, which cannot be used as a writable directory in Vercel functions. Vercel now uses `/tmp` and preserves the `/uploads/*` response/route contract. These files are **temporary and per instance**, so an upload may disappear or be unavailable in another function instance. The in-memory notification log has the same per-instance limitation it already had.

Temporary disk storage applies only when the real API is enabled; demo Preview blocks uploads and file reads entirely. Before real uploads are enabled, choose persistent shared object storage (existing Firebase Storage is a candidate), then update both upload and download paths. That migration has not been guessed or implemented. Existing backend authorization findings in `optimization-review.md` remain relevant before public API rollout.

## Validation

The installed Vercel CLI 65.2.0 schema and service resolver accept this configuration, resolve `app` to `@vercel/static-build` and `api` to `@vercel/backends`, and accept both services sharing the root. Strict TypeScript, seven frontend unit cases, four isolated Express cases and the demo build passed. The Express checks verify unstripped API/upload paths, temporary upload read-back in non-demo mode, missing-token handling, both deployment/canonical email origins, and demo denial of JSON/multipart uploads, notifications and stored files even when conflicting flags are false. SMTP is mocked and no real credentials are inherited. Node server tests run through `npm run test:server`; Playwright collects only `*.spec.ts`.

`npm run dev:vercel -- --listen 127.0.0.1:5196 --yes` was attempted. The CLI found no local credentials, tried its login flow and exited with `fetch failed`; the Vercel plugin connection has not supplied CLI credentials. The official `vercel-labs/agent-skills` deploy-to-vercel Codex fallback (source revision `063bee94c3f4df8453406c830b0a7df0f2860278`) was also attempted with an allowlisted demo archive and escalated permissions. The proxy blocked both `api.vercel.com` and `codex-deploy-skills.vercel.sh` with HTTP 403. No deployment URL was returned.

The environment configuration draft now preserves all existing network rules and adds `vercel.com`, `api.vercel.com`, `codex-deploy-skills.vercel.sh`, `openapi.vercel.sh` and `*.vercel.app`. Saving the draft succeeded with `requires_publish=true`; the user must review/save it in environment settings and publish before readiness can be rechecked. Saved startup instructions include the guarded demo deployment workflow. This is not a deployment or proof of an applied runtime network change.

The ignored `.local/vercel-preview/services-demo.tgz` contains only selected source/assets/manifests/config. It excludes secrets and real uploads, forces the demo frontend build, and forces `SMO_DEMO_MODE=true` at the staged backend entrypoint regardless of the fallback host's environment classification. `.local/vercel-preview/checkpoint.json` records the outstanding deployment step. Local checks do not establish remote build, service dispatch or deployed runtime success.
