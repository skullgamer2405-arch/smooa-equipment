import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const script = readFileSync(new URL("../google_apps_script_email.js", import.meta.url), "utf8");
function fixture(failSend = false) {
  const secret = "fixture-secret-of-at-least-32-characters", cache = new Map(), mail = [];
  let held = false;
  const scope = {
    Date, JSON,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { held = true; return true; }, releaseLock: () => { assert(held); held = false; } }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key,value) => cache.set(key,value) }) },
    Utilities: { computeHmacSha256Signature: (payload,key) => [...createHmac("sha256",key).update(payload).digest()].map(x => x > 127 ? x - 256 : x) },
    MailApp: { sendEmail: value => { mail.push(value); if (failSend) throw Error("delivery uncertain"); } },
    ContentService: { MimeType: {JSON:"json"}, createTextOutput: text => ({setMimeType: () => ({text})}) },
  };
  vm.createContext(scope); vm.runInContext(script, scope, { timeout: 1000 });
  const payload = {to:"borrower@example.invalid", subject:"คำขอ",html:"<p>fixture</p>",timestamp:Date.now(),requestId:"fixture-booking_approved"};
  const envelope = value => {const body=JSON.stringify(value);return {postData:{contents:JSON.stringify({payload:body,signature:createHmac("sha256",secret).update(body).digest("hex")})}};};
  const send = e => JSON.parse(scope.doPost(e).text);
  return {payload,envelope,send,cache,mail};
}
test("Apps Script checks signature and treats duplicate sent jobs as accepted", () => {
 const f=fixture(); const request=f.envelope(f.payload);
 assert.deepEqual(f.send(request),{success:true});
 assert.deepEqual(f.send(request),{success:true});
 assert.equal(f.mail.length,1);
 const changed=JSON.parse(request.postData.contents);changed.payload=JSON.stringify({...f.payload,to:"attacker@example.invalid"});
 assert.deepEqual(f.send({postData:{contents:JSON.stringify(changed)}}),{success:false});
 assert.equal(f.mail.length,1);
});
test("an ambiguous Apps Script send is never reported as sent or resent", () => {
 const f=fixture(true),request=f.envelope(f.payload);
 assert.deepEqual(f.send(request),{success:false});
 assert.equal(f.cache.get(f.payload.requestId),"sending");
 assert.deepEqual(f.send(request),{success:false});
 assert.equal(f.mail.length,1);
});
