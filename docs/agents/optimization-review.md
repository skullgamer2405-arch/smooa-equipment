# Ponytail full: code review and optimization

Reviewed the current working tree on 2026-10-25, including uncommitted UI migration work. Changes preserve the existing routes, data fields, font, UI layout and Firebase backend. No deployment, email delivery, production data access or external model worker was used.

## Scope

- Reviewed active React pages, shared components, data subscriptions/mutations, booking validation, imports, QR handling, Express endpoints, Google Apps Script, Firebase rules, package manifests, Hosting and CI configuration.
- Inventoried `public/js/` and `smo-eq/`, compared their shared files after normalizing line endings, and scanned legacy DOM/data/navigation boundaries. These reference implementations were retained, as required by AGENTS.md; this was not a line-by-line rewrite of every legacy copy.
- Existing shadcn primitives were checked for application callers. Third-party package internals, installed agent skills, generated files, binary archives and design exports were excluded from manual application review.

## Changes

- Removed unused `read-excel-file` and five orphaned transitive packages. XLS/XLSX import still uses `@e965/xlsx`; DOCX still uses Mammoth.
- Deleted unused shadcn badge, dropdown-menu and separator files after checking callers and configuration. Other shadcn components and the MIT license remain.
- Removed two unused imports and enabled TypeScript's unused-local/parameter checks.
- Prepared the ten visible booking/equipment pairs once for both admin layouts, retaining canonical document IDs, missing-equipment guards, filtering and page clamping.
- Reused the Thai/Bangkok `Intl.DateTimeFormat` instance instead of recreating it for each date label.
- Loaded QR encoder/decoder modules on demand, retaining download, print and scan behavior and error handling. Reused the camera's canvas context. Cancelled pending camera attempts and stopped late-arriving tracks after dialog closure.

## Measurements

Same workspace, production build, before/after this optimization only. Source counts exclude tests; they do not count unchanged legacy references or dependency internals.

| Measure | Before | After |
| --- | ---: | ---: |
| Application TypeScript/TSX lines | 5,266 | 4,944 |
| Application TypeScript/TSX files | 35 | 32 |
| Main JS chunk, bytes | 368,830 | 216,242 |
| CSS, bytes | 122,422 | 119,893 |
| All JS/CSS chunks combined, bytes | 2,106,323 | 2,104,664 |
| All JS/CSS chunks combined, gzip bytes | 632,913 | 633,235 |

The main JS chunk shrank 41.4%; QR code moves into deferred chunks rather than disappearing. Total compressed assets are effectively unchanged (+322 bytes of chunk/runtime overhead). This is a payload measurement, not a claim that every interaction is 41.4% faster. Browser tests verify QR modules are requested only when used.

A local Node microbenchmark (five passes of 3,000 dates, median) measured formatter creation per label at 308.64ms and reuse at 4.91ms. This isolates date formatting; it is not an end-to-end application benchmark.

## Verification

- Clean `npm ci`, strict TypeScript checks, seven unit tests and production build passed.
- Full browser suite: 17/17 passed before the final camera cancellation guard. Afterwards all four affected QR/scanner/pagination cases passed, including the new late-permission cleanup case. There are now 18 browser cases in the suite; a second full run was not performed.
- Coverage includes six surfaces at 320/375/768/1024/1440px, doubled text scale, Thai Regular font, axe checks, keyboard/menu focus, booking/approval/rejection/return, CRUD, XLS/XLSX/DOCX, inert stored HTML, notification settings, pagination and safe QR navigation.
- Syntax-only checks passed for 21 JavaScript/MJS files, including both server copies, legacy scripts and Apps Script. Browser flows use isolated fixtures with external HTTP blocked; syntax checks do not establish runtime correctness of legacy code.
- Regression additions cover Bangkok's year boundary, canonical equipment/missing-item guards across both admin layouts, QR module loading failures, deferred module requests and camera cleanup.

## Outstanding review findings

These are source observations, not evidence of exploitation or confirmation of the deployed configuration. They were not silently changed during a behavior-preserving optimization.

1. **Priority: high — booking privacy and admin authorization.** `firestore.rules:65` allows public reads of complete booking documents, which include borrower contact fields (`src/lib/types.ts`). `firestore.rules:11` treats any authenticated user as admin. Separate public statistics/calendar data from private records and define explicit admin authorization before tightening rules; simply denying reads would break current public views.
2. **Priority: high — write/email endpoints.** `server.js:132`, `:186`, `:361` and `:450` register upload/notification handlers without auth middleware. `google_apps_script_email.js:22` dispatches notification actions without authenticating the caller. Reachability and deployed protections were not tested. Introduce server-side authorization, validated inputs and abuse limits with matching client credentials and regression tests.
3. **Priority: high — auth fallback.** `server.js:44` allows the protected notification-log handler to continue if Admin SDK initialization failed; the successful verification path checks token validity, not an admin role. Fail closed and check authorization explicitly; evaluate deployment/service-account behavior with an isolated server fixture.
4. **Priority: medium — auth initialization failure.** `src/lib/data.ts:94` has no rejected-import/auth-error path, so `authReady` can stay false on initialization failure. Add an explicit recoverable auth error state rather than treating failure as successful initialization.
5. **Priority: medium — email content.** Templates in `server.js` and `google_apps_script_email.js` interpolate request strings as HTML. Use context-appropriate escaping and validate recipients server-side; rendering and delivery need isolated mail fixtures.

Live Firebase authorization, deployed rules, SMTP, real camera hardware, physical printing, production latency/load and Gemini Pro through OmniRoute remain unverified. This review does not replace the separate security audit or establish that every possible production behavior/performance characteristic is unchanged.
