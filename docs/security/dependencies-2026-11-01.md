# Dependency review — 2026-11-01

The previous runtime-only npm audit reported 13 package entries, several inherited from the same underlying advisories. The updated complete lockfile, including development dependencies, reports zero known npm advisories at review time. This is a dependency check, not a guarantee about application security or deployed configuration.

| Area | Change | Reason and compatibility boundary |
| --- | --- | --- |
| Email | Nodemailer 10.3.1 | Patched address parsing, transport, and TLS handling. The actual composer is tested with two admin envelope recipients and one borrower recipient; provider delivery still requires staging acceptance. |
| Validation | Zod 4.6.7 | Patched constrained-collection validation. Existing schemas, custom messages, resolver, and inferred types pass API, form, and browser tests using v4 directly. |
| LINE client dependency | follow-redirects 1.16.2 | Patch update for header forwarding. Server provider calls continue using native fetch. |
| Firebase client | Scoped `@firebase/firestore → @grpc/grpc-js:1.13.7` | Replaces the vulnerable Node gRPC branch while retaining Firebase 11 and the proto-loader 0.7 family. Browser exports do not use gRPC; real client policy tests exercise the Node branch. |
| Google server client | Scoped `@google-cloud/firestore → @google-cloud/firestore-api:0.7.1` | Removes the legacy Google gax/auth/metadata/rimraf/glob/minimatch subtree. This crosses the declared generated-client range and therefore requires real SDK query, count, and transaction tests. The application's v1 surface remains supported; the removed deprecated v1beta1 export is not used. |
| Vercel Auth compatibility | Preserve `firebase-admin → jwks-rsa:3.2.2`, resolved jose 4.15.9 | Vercel's loader rejects CommonJS require of ESM-only jose 6. The pinned pair has a genuine CommonJS path. jose 4 is outside upstream's current supported line; retain this temporary workaround only until upstream/runtime compatibility allows removal after the same tests. |

No application endpoint, data schema, authorization requirement, provider account, or paid service was changed. Override updates must be reviewed explicitly; do not run `npm audit fix --force`. Remove each override when upstream selects a compatible patched dependency and repeat the tests below.

## Verification

- 51 API/unit server cases, including actual Firebase Auth SDK loading, RSA/EC JWKS conversion and signature verification, and actual email composition. The server suite disables Node's require(ESM) bridge to catch the Vercel failure mode in CI.
- 22 frontend unit cases, TypeScript and demo production build.
- Three Firestore/Storage policy cases and a real Admin SDK integration against loopback emulators: document read/write, aggregate count, LINE-linked booking creation, approval transaction, notification outbox, private public-calendar projection, and return transaction. SMTP and LINE providers are simulated; no production borrower records or credentials are used.
- 42 responsive/accessibility/workflow browser cases and the production-header browser case, in offline containers with scratch-only writes.
- Independent review of source, exact lockfile and advisories. Expected policy-denial logs prove denied operations; emulator metadata discovery attempts were blocked by the offline container.

The frontend shared chunk grows from approximately 62 KB to 72 KB gzipped with the validation update. Responsive layout and workflow tests pass; no broader performance claim is made.

Before promotion: validate the exact new staging commit with the owner's Firebase, Cloudinary, SMTP and LINE test accounts; verify the deployed rules/indexes, scheduled reminders, and returned-item behavior. Earlier staging checks are baseline evidence, not proof of the new server dependency path. The deployment to the official `main` branch remains a separate release step.
