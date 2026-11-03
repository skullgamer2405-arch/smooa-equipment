---
name: omniroute
description: Project-specific handoff of SMO.CRA UI tasks to a verified Gemini Pro coding worker through the installed OmniRoute gateway. Not an official OmniRoute skill.
---

# OmniRoute UI handoff

Use the existing checkout. Every cloud task is isolated; do not create a Git worktree unless explicitly requested. Preserve pre-existing changes. One coding worker at a time, sequential tasks and review gates. The current chat's model is not changed by this skill.

## Readiness and authentication

1. Start the installed gateway bound to loopback with authentication: `OMNIROUTE_SERVER_HOST=127.0.0.1 REQUIRE_API_KEY=true omniroute serve --no-open --headless`. Keep credentials outside source control. Never print keys, read credential files into context, or request passwords/cookies/tokens in chat.
2. Verify the actual installed server's provider registry, not just the CLI's advertised list. During this implementation, OmniRoute 3.8.52 advertised `oauth start --provider gemini` but `src/lib/oauth/providers/index.ts` did not register Gemini OAuth; Gemini AI Studio was an API-key provider. Do not claim that Google AI student/Pro subscription login works through this route. Antigravity/Code Assist and API access are distinct capabilities, not automatic substitutes.
3. Have the user authorize a supported official Google account flow in their browser when such a route is established. No credentials are currently configured. Use API access only if the owner separately verifies its quota and no extra cost. No automatic Flash/paid fallback.
4. Read the authenticated `/v1/models` catalog. Record the exact Gemini Pro ID in `OMNIROUTE_PRO_MODEL`, the endpoint key in `OMNIROUTE_API_KEY`, and verified route in `OMNIROUTE_AUTH_KIND=subscription|api`. Set `OMNIROUTE_QUOTA_VERIFIED=1` only after actual verification; API also requires `OMNIROUTE_API_NO_EXTRA_COST=1`.
5. Disable provider/model fallback and set `OMNIROUTE_FALLBACK_DISABLED=1` only after verifying that setting. `npm run omniroute:check` performs metadata-only readiness checks. `npm run omniroute:check -- --dry-run` verifies the installed launcher plan. A catalog entry does not prove provider access or tool calling. Before full project work run one bounded non-secret tool-call test; confirm the selected Pro model, tool results and quota, then set `OMNIROUTE_TOOL_CALLING_VERIFIED=1`. A dry-run is not a real tool-call test.

## Worker contract

Use `docs/agents/ui-handoff.md`. After readiness and the minimal tool test pass, `npm run omniroute:check -- --run` launches the installed `omniroute run codex --model <verified-id>` wrapper. Keep provider fallback disabled in OmniRoute itself as well. Pass only the task, necessary source and non-secret configuration; exclude `.env*`, credentials, real borrower records, uploaded documents and private logs.

Work on one task only. Before the next task, the primary agent reviews the diff and runs typecheck, build, unit tests, browser and accessibility checks relevant to the change. Do not reset user changes, deploy, push, or commit automatically. Never use `--inherit-env` to pass the full parent environment.

## Checkpoints and quota

The runner records non-secret status under ignored `.local/omniroute-checkpoint.json`. On quota/auth/tool incompatibility stop; keep changes, failure context and the next task. Do not claim automatic wake-up after quota reset. Resume explicitly using the recorded command. A stale worker lock requires checking the existing process before removing it. This implementation has **not** verified a Google login, Gemini Pro entitlement or any real model/tool call.
