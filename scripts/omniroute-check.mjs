import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv.includes("--run")
  ? "run"
  : process.argv.includes("--dry-run")
    ? "dry-run"
    : "check";
const checkpoint = path.join(root, ".local/omniroute-checkpoint.json");
function record(status, detail) {
  mkdirSync(path.dirname(checkpoint), { recursive: true });
  writeFileSync(
    checkpoint,
    JSON.stringify(
      {
        status,
        detail,
        updatedAt: new Date().toISOString(),
        resume: "npm run omniroute:check -- --dry-run",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ status, detail }));
  return status;
}
const model = process.env.OMNIROUTE_PRO_MODEL;
const key = process.env.OMNIROUTE_API_KEY;
const base = process.env.OMNIROUTE_BASE_URL || "http://127.0.0.1:20128";
const url = new URL(base);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.protocol !== "http:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw Error("This project runner only supports the local loopback gateway.");
let blocked = "";
if (!key)
  blocked =
    "Configure an OmniRoute endpoint key securely; no key is read from chat or committed files.";
else if (
  !model ||
  !/(^|[-_/])pro($|[-_/])/i.test(model) ||
  !/gemini/i.test(model)
)
  blocked =
    "Set OMNIROUTE_PRO_MODEL to the exact verified Gemini Pro catalog ID; Flash is not an automatic fallback.";
else if (process.env.OMNIROUTE_QUOTA_VERIFIED !== "1")
  blocked =
    "Verify subscription/model eligibility before setting OMNIROUTE_QUOTA_VERIFIED=1.";
else if (
  process.env.OMNIROUTE_AUTH_KIND === "api" &&
  process.env.OMNIROUTE_API_NO_EXTRA_COST !== "1"
)
  blocked =
    "API fallback requires explicit confirmation of no extra cost; a Google AI student plan alone is insufficient.";
else if (
  !["subscription", "api"].includes(process.env.OMNIROUTE_AUTH_KIND || "")
)
  blocked = "Record the verified authentication route as subscription or api.";
else if (process.env.OMNIROUTE_FALLBACK_DISABLED !== "1")
  blocked =
    "Verify that provider/model fallback is disabled in OmniRoute before setting OMNIROUTE_FALLBACK_DISABLED=1.";
else if (mode === "run" && process.env.OMNIROUTE_TOOL_CALLING_VERIFIED !== "1")
  blocked =
    "Complete the minimal non-secret Pro tool-call test before setting OMNIROUTE_TOOL_CALLING_VERIFIED=1.";
if (blocked) {
  record("blocked_configuration", blocked);
  process.exitCode = 78;
} else {
  try {
    const r = await fetch(new URL("/v1/models", base), {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok)
      throw Error(
        `Gateway catalog returned HTTP ${r.status}; provider/model readiness is not established.`,
      );
    const catalog = await r.json();
    if (!catalog.data?.some((x) => x.id === model))
      throw Error(
        "Configured Pro model is absent from the authenticated catalog.",
      );
    if (mode === "check") {
      record(
        "catalog_verified_not_tool_tested",
        "Catalog ID exists; use a dry-run, then a minimal tool-call test before sending project work.",
      );
    } else {
      const lock = path.join(root, ".local/omniroute-worker.lock");
      mkdirSync(lock);
      const brief = readFileSync(
        path.join(root, "docs/agents/ui-handoff.md"),
        "utf8",
      );
      const args = [
        "run",
        "codex",
        "--model",
        model,
        "--api-key-env",
        "OMNIROUTE_API_KEY",
        ...(mode === "dry-run" ? ["--dry-run", "--json"] : []),
        "--",
        "exec",
        "--sandbox",
        "workspace-write",
        "-C",
        root,
        `Read AGENTS.md and .agents/skills/omniroute/SKILL.md. Follow this handoff. Work on only the next incomplete task; do not deploy, commit, expose secrets or change providers.\n${brief}`,
      ];
      const env = {
        PATH: process.env.PATH,
        LANG: process.env.LANG || "C.UTF-8",
        TERM: process.env.TERM || "dumb",
        OMNIROUTE_API_KEY: key,
      };
      record(
        mode === "run" ? "worker_running" : "dry_run",
        "Single worker lock acquired; primary Codex configuration is not rewritten.",
      );
      const child = spawn("omniroute", args, {
        cwd: root,
        env,
        stdio: "inherit",
        shell: false,
      });
      const cleanup = () => {
        try {
          rmdirSync(lock);
        } catch {
          /* retain a stale lock for manual inspection */
        }
      };
      child.on("error", () => {
        cleanup();
        record("blocked_launcher", "Could not start OmniRoute CLI.");
        process.exitCode = 1;
      });
      child.on("exit", (code, signal) => {
        cleanup();
        record(
          code === 0
            ? mode === "run"
              ? "needs_review"
              : "dry_run_complete"
            : "paused",
          code === 0
            ? "Inspect diff and run checks before advancing."
            : `Worker exited (${code ?? signal}); inspect quota/readiness and resume manually. No provider fallback was requested.`,
        );
        process.exitCode = code ?? 1;
      });
    }
  } catch (error) {
    record(
      "blocked_readiness",
      error instanceof Error
        ? error.message
        : "Gateway readiness check failed.",
    );
    process.exitCode = 78;
  }
}
