# UI worker handoff

## Goal and design contract

Migrate the six root pages to React/TypeScript/Vite/shadcn. Navy/gold on a light surface. Chulabhorn Likit Text Regular (400) for all UI, no synthetic bold; 16px body/form, 14px secondary, 24–32px headings. Content max 1200px, 4/8px spacing, primary touch targets 44px, WCAG 2.2 AA. Public navigation prioritizes equipment and calendar; explicit mobile menu; grouped single-page booking form. Fonts self-hosted from the user-supplied ZIP. Loading/error/empty/permission states must not fabricate real data.

## Preserve

Firebase Auth/Firestore, existing document shapes and statuses, `.html` and clean route aliases, query/QR links, booking, approval/rejection/return, equipment CRUD, Excel XLS/XLSX/Word import, QR scan/download/print and webhook settings. Existing public/ files and smo-eq/ are legacy reference, not the new Vite public directory. Keep Typeset installed without applying its container. Do not migrate to Convex, change production rules, or deploy as part of this task.

## Sequential task gates

1. Foundation: React/Vite, actual shadcn components, font/tokens, routing, typed data adapters.
2. Borrower: navigation, home/catalog, grouped booking/success, calendar.
3. Admin: login, requests, inventory/editor/import, QR and settings.
4. Review: `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Use only demo fixtures for browser tests. Inspect desktop/mobile screenshots and keyboard focus. Record actual results, not intended commands.

## Current checkpoint

Foundation, all six pages and the admin workflows are implemented by the primary agent. See `ui-checkpoint.json` for actual checks: clean npm ci/build, 6 unit tests, 15 browser cases, plus focused accessibility/touch-target reruns after final visual refinements. The font was verified from the user's archive and loaded by Chromium. Production route/font GETs and missing API/asset 404s were checked. UI fixture testing does not prove live Firebase login/write or real email integration.

The remaining external prerequisite is Gemini Pro: no endpoint key, Google/provider login, model entitlement or tool-call check is verified. Gateway is loopback-only and rejects unauthenticated catalog calls. No code was handed to Gemini and no Gemini quota was used. The next worker must verify secure connection readiness before any model run, then review the existing implementation rather than recreating completed pages. Preserve user changes, avoid paid/Flash fallback, and update the checkpoint after each reviewed task.
