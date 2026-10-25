# Equipment by SMO

Student equipment lending UI, React + TypeScript + Vite + Tailwind + shadcn/ui, with the existing Firebase backend. Requires Node 24 and npm.

```bash
npm ci
npm run dev           # web (5173) and existing API (3000)
npm run dev:demo      # isolated sample data; no Firebase writes or email
npm run build
npm start            # serves dist and existing /api and /uploads
```

`npm run dev:convex` retains the separate Convex scaffold. It is not this app's backend. `public/` retains the previous HTML/JS and uploads; new static assets are in `static/`, and only `dist/` is deployed. Both `.html` URLs and existing clean page routes work; `/api` and missing static files do not fall through to the app.

Demo admin is `admin@example.invalid` / `demo-only`, exclusively in explicit Vite demo mode. Never use demo mode for production builds. Test data is kept in sessionStorage and identified by a visible banner. Production starts empty/loading/error as actual Firebase data dictates.

```bash
npm run typecheck
npm test
npm run test:e2e
```

Local browser tests use `/usr/bin/chromium` (override `CHROMIUM_PATH`); CI uses Playwright's installed Chromium. Browser tests start their own forced demo server on port 5174, refuse to reuse another server, and block non-local HTTP requests. They never use production. No live Firebase/SMTP integration is implied by their passing.

Latest code review, optimization measurements and outstanding findings: [optimization review](docs/agents/optimization-review.md).

Vercel multi-service setup and demo deployment checkpoint: [Vercel services](docs/agents/vercel-services.md). Use `npm run dev:vercel` to run the services together. The user approved a demo Preview; Vercel Preview builds force sample data and the API blocks real email, uploads and file reads. Deployment remains blocked until the saved environment network draft is applied/published. Live storage and backend authorization still need separate work before production.

The Chulabhorn Likit Text Regular webfont is self-hosted; see docs/agents/font-source.md. Typeset is retained without a container applied.

OmniRoute setup and guarded model handoff: `.agents/skills/omniroute/SKILL.md`. No Gemini Pro connection has been verified. Credentials belong in secure local/environment settings, not chat or Git. API quota is distinct from a Google AI subscription. `npm run omniroute:check` fails closed until configured.

XLS/XLSX uses the npm integrity-pinned `@e965/xlsx` 0.20.3 redistribution because the official SheetJS CDN is blocked in this cloud network. DOCX uses Mammoth in a lazy browser chunk; converted markup is parsed for text cells and never injected into the page. Imports are limited to 10MB/500 rows with preview and explicit confirmation. The prior audit predates this migration; its findings are not automatically revalidated against this revision. Backend security remediation is a separate task; this UI migration is not a security certification.
