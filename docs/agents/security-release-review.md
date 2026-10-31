# Security audit and official-release hardening

Date: 2026-10-26. Baseline: `b7c5802d0b596f7a3bae4c9c7284676472441729` plus recorded working-tree email changes. This document describes the current hardening work; it does not certify a live deployment.

## Audit result

Cloudflare security-audit standard six-phase workflow completed against the frozen source: four reconnaissance agents, five hunters, post-wave coverage critic and a distinct final-clean critic. Ledger: 17 source-covered units and one explicit exclusion for three opaque ZIP snapshots. No surviving candidate met the complete boundary/impact gate: **0 confirmed vulnerabilities and 0 retained needs_validation findings**. Prior run-1's 11 leads are source-refuted for the currently selected root app, not asserted fixed in historical deployments.

Private bookings, verified admin claims, canonical document IDs, safe public projection, React/mail escaping, strict QR navigation, LINE ownership, signed Apps Script calls and notification deduplication were checked. Local target code ran only in network-disabled resource-bounded Docker containers with empty allowlisted environments, readonly source/tools, temporary scratch and parent-promoted bounded evidence. No real credentials, borrower data, provider messages or deployed endpoints were used.

Complete baseline artifacts are outside Git at `/workspace/security-audit-skill/smooa-equipment/run-2/`: REPORT.md, FINDINGS-DETAIL.md, NEEDS-VALIDATION.md, findings.json, coverage-ledger.json, metadata and minimum execution evidence. Both skill validators passed. Baseline audit and later hardening are recorded separately so changes do not silently reuse an old audit revision.

## Changes after audit

- Installed and used Ponytail full. Fixed shared causes and callers; preserved boundary validation, error handling, existing UI/font/routes and features. No new runtime dependency; rules-test SDK is development-only.
- PNG chunk preflight rejects repeated/truncated headers and unsupported interlaced server input before decode. Browser PNG/JPEG/WebP conversion remains supported. The tiny duplicate-IHDR fixture demonstrated a dimensions-policy discrepancy, not a claimed shared-service availability exploit.
- SMTP requires TLS and certificate verification stays enabled. Existing canonical recipients, escaping and ambiguous-result deduplication remain. The legacy-shaped LINE approval endpoint now invokes the same stored-booking email callback.
- Web and verified-LINE creation share a transactional 30-new-requests/minute policy scoped to web principal or LINE subject; identical retries do not consume it twice. Actual Vercel IP attribution still requires an operator check.
- Firebase web selectors now come from per-environment public configuration. Production app/API builds run presence/format checks and reject demo flags, browser-exposed secrets, and server/client project/bucket mismatch. These checks do not log in or validate provider permissions.
- Apps Script release alternative requires a matching URL+secret pair. Runtime uses the same environment URL default; explicitly saved database settings, including empty URL, override it. A fresh reviewer caught the earlier secret-only readiness gap; it was fixed and regression-tested.
- Vercel and Express share tested CSP/frame/nosniff/referrer/permission policies. LINE/Firebase origins are explicitly scoped. Actual mobile LIFF/provider compatibility remains an owner-side staging check.
- CI validates PRs/main/Preview branch with read-only GitHub token permissions and immutable action revisions. It includes genuine Firestore/Storage emulator tests, not only an in-memory DB. Firebase Hosting auto-deployment was removed because official hosting is Vercel.
- Tailwind scans frontend sources explicitly, keeping output independent of test reports, docs and installed skill text. New release/emulator configuration is documented in the owner guide.

## Verification

- TypeScript and production build passed. All emitted JS chunks total about 672.5kB gzip versus 672.3kB baseline; this is bundle size, not a live latency measurement. Explicit frontend Tailwind sources keep CSS stable before/after generated test reports.
- Frontend unit tests: 22 passed.
- Server/LINE/Apps Script/release tests: 37 passed.
- Full browser regression: 36 passed, including mobile widths 320/375/768/1024/1440, supplied font, accessibility, consent, imports, QR and borrower/admin workflows.
- Genuine Firestore/Storage emulator matrix: 3 tests passed across anonymous, ordinary, unverified-admin and verified-admin identities; private state and client workflow writes are denied.
- Browser test with production security headers: rendering, QR and label printing passed.
- Vercel instance configuration conforms to the fetched public schema under Draft7 validation. Remote metaschema self-validation was incompatible; this is configuration-instance validation, not a claim the provider deployed it.

Emulator tooling was prepared separately after the frozen baseline audit, then executed offline using Java21, firebase-tools15.34.1 and reviewed cached emulator artifacts. It neither used nor changed an actual Firebase project.

## Remaining release gates

Follow [production setup](../production-setup.md). Owner must set private/public values, verify actual Firebase rules/indexes/IAM/admin accounts, test SMTP and LINE with dedicated accounts on isolated staging, and then publish/promote the selected root version. No live messages, Firebase policy deployment, database reset, package upgrade or Production promotion was performed in this work.

Source/offline coverage does not establish remote advisory freshness, exhaustive third-party internals, historical deployed versions, effective platform headers, provider quotas or inbox/handset delivery. No paid service was enabled. Do not call a single audit pass a security guarantee.
