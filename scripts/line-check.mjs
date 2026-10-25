import { config } from "dotenv";
import { lineOa } from "../shared/line-oa.js";
config({ path: [".env.local", ".env"], quiet: true });
const env = process.env;
const results = [];
function check(name, ready) {
  results.push(Boolean(ready));
  console.log(`${ready ? "OK" : "MISSING/INVALID"} ${name}`);
}
check("LINE_ENABLED", env.LINE_ENABLED === "true");
check("VITE_LINE_LIFF_ID", /^\d+-[\w-]+$/.test(env.VITE_LINE_LIFF_ID || ""));
check("LINE_LOGIN_CHANNEL_ID", /^\d+$/.test(env.LINE_LOGIN_CHANNEL_ID || ""));
check(
  "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN",
  Boolean(env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN),
);
check(
  "LINE_ADMIN_EMAILS",
  Boolean(
    env.LINE_ADMIN_EMAILS?.split(",").every((email) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    ),
  ),
);
check("CRON_SECRET >= 32 characters", (env.CRON_SECRET?.length || 0) >= 32);
try {
  const u = new URL(env.PUBLIC_APP_URL);
  check("PUBLIC_APP_URL HTTPS", u.protocol === "https:");
} catch {
  check("PUBLIC_APP_URL HTTPS", false);
}
try {
  const u = new URL(env.VITE_LINE_OA_URL || lineOa.friendUrl);
  check(
    "VITE_LINE_OA_URL",
    u.protocol === "https:" && ["line.me", "lin.ee"].includes(u.hostname),
  );
} catch {
  check("VITE_LINE_OA_URL", false);
}
check(
  "Firebase Admin credential source",
  Boolean(
    env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    env.FIREBASE_SERVICE_ACCOUNT_JSON_B64 ||
    env.GOOGLE_APPLICATION_CREDENTIALS,
  ),
);
check(
  "Live mode (Preview deliberately blocks all real APIs)",
  env.VERCEL_ENV !== "preview" &&
    env.SMO_DEMO_MODE !== "true" &&
    env.VITE_DEMO_MODE !== "true",
);
console.log(
  "Presence/format checks only. No credentials are printed and no service is contacted. Real channel ownership, Firebase access, cron execution and message delivery still need verification.",
);
process.exitCode = results.every(Boolean) ? 0 : 1;
