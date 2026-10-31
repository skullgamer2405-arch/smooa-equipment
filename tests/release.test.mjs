import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { releaseIssues } from "../scripts/release-check.mjs";
import { firebaseConfig } from "../shared/firebase-config.js";

const env = {
  VITE_FIREBASE_API_KEY: "fixture-public-key", VITE_FIREBASE_AUTH_DOMAIN: "fixture.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "fixture-project", VITE_FIREBASE_APP_ID: "fixture-app",
  VITE_LINE_LIFF_ID: "123-fixture", LINE_ENABLED: "true", LINE_LOGIN_CHANNEL_ID: "123", LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "fixture-only",
  CRON_SECRET: "x".repeat(32), PUBLIC_APP_URL: "https://equipment.example.invalid", ADMIN_NOTIFICATION_EMAIL: "admin@example.invalid",
  SMTP_HOST: "smtp.example.invalid", SMTP_USER: "sender@example.invalid", SMTP_PASS: "fixture-only", CLOUDINARY_CLOUD_NAME: "fixture-cloud", CLOUDINARY_API_KEY:"fixture-key", CLOUDINARY_API_SECRET:"fixture-secret",
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({project_id:"fixture-project",client_email:"fixture@example.invalid",private_key:"fixture-only"}),
};
test("release checks fail closed on missing settings without exposing credential values",()=>{
  assert(releaseIssues({}).length > 10);
  assert.deepEqual(releaseIssues(env),[]);
  assert(releaseIssues({...env,FIREBASE_SERVICE_ACCOUNT_JSON:"secret malformed JSON"}).includes("FIREBASE_SERVICE_ACCOUNT_JSON (or _B64)"));
  assert(!JSON.stringify(releaseIssues({...env,FIREBASE_SERVICE_ACCOUNT_JSON:"secret malformed JSON"})).includes("secret malformed JSON"));
});
test("release checks separate public frontend from private API and reject project drift/demo/secrets",()=>{
  const publicEnv=Object.fromEntries(Object.entries(env).filter(([key])=>key.startsWith("VITE_")));
  assert.deepEqual(releaseIssues(publicEnv,true),[]);
  assert(releaseIssues({...env,VITE_FIREBASE_PROJECT_ID:"other-project"}).includes("Firebase server/client project matches"));
  assert.deepEqual(releaseIssues({...env,VITE_FIREBASE_STORAGE_BUCKET:"other-bucket"}),[]);
  for(const name of ["CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET"])assert(releaseIssues({...env,[name]:""}).some(x=>x.includes("CLOUDINARY")));
  assert(releaseIssues({...env,CLOUDINARY_CLOUD_NAME:"../evil"}).some(x=>x.includes("CLOUDINARY")));
  for(const name of ["VITE_CLOUDINARY_CLOUD_NAME","VITE_CLOUDINARY_API_KEY","VITE_CLOUDINARY_API_SECRET"])assert(releaseIssues({...env,[name]:"fixture"},true).some(x=>x.includes(name)));
  assert.equal(firebaseConfig(env).storageBucket,undefined);
  for(const flags of [{VITE_DEMO_MODE:"true"},{SMO_DEMO_MODE:"true"},{VERCEL_ENV:"preview"}])assert(releaseIssues({...env,...flags}).includes("Live build: disable demo flags"));
  assert(releaseIssues({...env,VITE_SMTP_PASS:"must-never-be-public"},true).some(x=>x.includes("Remove browser-exposed secret")));
  assert.throws(()=>firebaseConfig({}),/VITE_FIREBASE_API_KEY/);
  assert.equal(firebaseConfig({...env,VITE_FIREBASE_PROJECT_ID:"test-project"}).projectId,"test-project");
});
test("Apps Script alternative requires both a valid URL and signing secret",()=>{
  const alternative={...env,SMTP_PASS:"",APPS_SCRIPT_SHARED_SECRET:"x".repeat(32)};
  assert(releaseIssues(alternative).some(x=>x.includes("Apps Script URL")));
  assert.deepEqual(releaseIssues({...alternative,APPS_SCRIPT_WEBHOOK_URL:"https://script.google.com/macros/s/fixture/exec"}),[]);
  assert(releaseIssues({...alternative,APPS_SCRIPT_WEBHOOK_URL:"https://attacker.example.invalid/exec"}).some(x=>x.includes("Apps Script URL")));
});
test("Vercel and Express security policies agree and production build gates remain enabled",()=>{
  const policy=JSON.parse(readFileSync(new URL("../shared/security-headers.json",import.meta.url)));
  const vercel=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url)));
  assert.deepEqual(Object.fromEntries(vercel.headers[0].headers.map(x=>[x.key,x.value])),policy);
  assert(policy["Content-Security-Policy"].includes("frame-ancestors 'none'"));
  assert(!/script-src[^;]*'unsafe-inline'/.test(policy["Content-Security-Policy"]));
  assert.match(vercel.services.app.buildCommand,/release:check -- --frontend/);
  assert.match(vercel.services.api.buildCommand,/release:check/);
  assert.deepEqual(Object.keys(vercel.services),["app","api"]);
});

test("release checks accept one or two admin recipients only, keeping SMTP user single",()=>{
 assert.deepEqual(releaseIssues({...env,ADMIN_NOTIFICATION_EMAIL:" a@example.invalid , b@example.invalid "}),[]);
 assert.deepEqual(releaseIssues({...env,ADMIN_NOTIFICATION_EMAIL:"a@example.invalid,A@example.invalid"}),[]);
 for(const value of ["a@example.invalid,", "a@example.invalid,bad","a@example.invalid,b@example.invalid,c@example.invalid","a@example.invalid\r\n"])
  assert(releaseIssues({...env,ADMIN_NOTIFICATION_EMAIL:value}).includes("ADMIN_NOTIFICATION_EMAIL"));
 assert(releaseIssues({...env,SMTP_USER:"a@example.invalid,b@example.invalid"}).includes("SMTP_USER email"));
});

test("Firebase credential diagnostics distinguish absent, malformed and incomplete settings without leaking values",()=>{
 const cases = [
  [undefined, "missing in API build environment"],
  ["private-fixture-not-json", "invalid JSON"],
  [JSON.stringify("private-fixture-string"), "expected a JSON object"],
  ["null", "expected a JSON object"],
  ["[]", "expected a JSON object"],
  [JSON.stringify({project_id:"fixture-project",client_email:"fixture@example.invalid"}), "missing/non-string fields: private_key"],
  [JSON.stringify({project_id:"fixture-project",client_email:42,private_key:"private-fixture-value"}), "missing/non-string fields: client_email"],
 ];
 for (const [value, reason] of cases) {
  const issues=releaseIssues({...env,FIREBASE_SERVICE_ACCOUNT_JSON:value});
  assert(issues.some(issue=>issue.includes(reason)), reason);
  assert(issues.includes("FIREBASE_SERVICE_ACCOUNT_JSON (or _B64)"));
  assert(!issues.includes("Firebase server/client project matches"), "unreadable credentials must not imply a project mismatch");
  assert(!JSON.stringify(issues).includes("private-fixture"));
 }
 assert.deepEqual(releaseIssues({...env,FIREBASE_SERVICE_ACCOUNT_JSON:"",FIREBASE_SERVICE_ACCOUNT_JSON_B64:Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON).toString("base64")}),[]);
 const mismatch=releaseIssues({...env,FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:"other-project",client_email:"fixture@example.invalid",private_key:"private-fixture-value"})});
 assert.deepEqual(mismatch,["Firebase server/client project matches"]);
});
