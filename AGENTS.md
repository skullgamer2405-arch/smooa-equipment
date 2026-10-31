## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `skullgamer2405-arch/smooa-equipment`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

<!-- convex-ai-start -->

Convex tooling is installed for experiments. The current web app uses Firebase/Firestore and the Express API as its production backend; do not migrate it to Convex as part of UI work.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Frontend development

Use Node 24 and npm. The React app is in src/, built assets in dist/, and new public assets in static/. Keep legacy public/ and smo-eq/ as references. Use npm run dev:demo for isolated UI checks; never test against production borrower data. Read .agents/skills/omniroute/SKILL.md for the guarded Gemini Pro handoff and docs/agents/ui-handoff.md for task checkpoints. Do not infer provider access from a model catalog or subscription name.

For the current booking, privacy and notification rollout, read docs/agents/ux-privacy-rollout.md. Preview blocks real APIs; Firebase Hosting production deployment remains gated until same-origin API routing is verified.
