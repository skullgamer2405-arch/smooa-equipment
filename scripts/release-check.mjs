import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { cloudinaryConfig } from "../server/images.mjs";
import { firebaseConfig } from "../shared/firebase-config.js";
import { validEmail as email, validWebhook, parseAdminEmails } from "../shared/notification-config.js";

const https = value => {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; }
  catch { return false; }
};
export function releaseIssues(env, frontend = false) {
  const issues = [];
  const check = (name, valid) => { if (!valid) issues.push(name); };
  let client;
  try { client = firebaseConfig(env); }
  catch {
    for (const name of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID"]) check("VITE_FIREBASE_" + name, Boolean(env["VITE_FIREBASE_" + name]?.trim()));
  }
  check("Live build: disable demo flags", env.VITE_DEMO_MODE !== "true" && env.SMO_DEMO_MODE !== "true" && env.VERCEL_ENV !== "preview");
  check("VITE_LINE_LIFF_ID", /^\d+-[\w-]+$/.test(env.VITE_LINE_LIFF_ID || ""));
  for (const name of Object.keys(env)) if (/^VITE_CLOUDINARY_/.test(name) || /^VITE_.*(SECRET|TOKEN|PASSWORD|SMTP_PASS|SERVICE_ACCOUNT|PRIVATE_KEY)/.test(name)) check("Remove browser-exposed secret: " + name, false);
  if (frontend) return issues;
  try { cloudinaryConfig(env); } catch { check("CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET", false); }
  check("PUBLIC_APP_URL (HTTPS, no credentials)", https(env.PUBLIC_APP_URL));
  check("LINE_ENABLED=true", env.LINE_ENABLED === "true");
  check("LINE_LOGIN_CHANNEL_ID", /^\d+$/.test(env.LINE_LOGIN_CHANNEL_ID || ""));
  check("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN", Boolean(env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim()));
  check("CRON_SECRET >=32 characters", (env.CRON_SECRET?.trim().length || 0) >= 32);
  check("ADMIN_NOTIFICATION_EMAIL", Boolean(parseAdminEmails(env.ADMIN_NOTIFICATION_EMAIL)));
  const smtp = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
  const webhook = Boolean(env.APPS_SCRIPT_WEBHOOK_URL) && validWebhook(env.APPS_SCRIPT_WEBHOOK_URL) && (env.APPS_SCRIPT_SHARED_SECRET?.length || 0) >= 32;
  check("SMTP settings or Apps Script URL + secret >=32 characters", smtp || webhook);
  if (smtp) {
    const port = env.SMTP_PORT || "587";
    check("SMTP_USER email", email(env.SMTP_USER));
    check("SMTP_PORT", /^\d+$/.test(port) && +port > 0 && +port <= 65535);
  }
  let account, credentialIssue;
  const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON || Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON_B64 || "", "base64").toString("utf8");
  if (!raw) credentialIssue = "missing in API build environment (check Production and service api scope)";
  else {
    try {
      account = JSON.parse(raw);
      if (!account || typeof account !== "object" || Array.isArray(account)) credentialIssue = "expected a JSON object (paste the complete service-account file)";
      else {
        const missing = ["project_id", "client_email", "private_key"].filter(key => typeof account[key] !== "string" || !account[key].trim());
        if (missing.length) credentialIssue = "missing/non-string fields: " + missing.join(", ");
      }
    } catch { credentialIssue = "invalid JSON (paste the complete service-account file, not its filename)"; }
  }
  check("FIREBASE_SERVICE_ACCOUNT_JSON (or _B64)", !credentialIssue);
  // Report only fixed reasons/field names; parser errors can contain private keys.
  if (credentialIssue) issues.push("Firebase credential: " + credentialIssue);
  else check("Firebase server/client project matches", Boolean(client && account.project_id === client.projectId));
  return issues;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  config({ path: [".env.local", ".env"], quiet: true });
  const issues = releaseIssues(process.env, process.argv.includes("--frontend"));
  for (const issue of issues) console.error("MISSING/INVALID " + issue);
  console.log("Configuration checks only; no service contacted, secret values printed, or delivery verified.");
  process.exitCode = issues.length ? 1 : 0;
}
