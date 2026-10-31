import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import {
  createLineService,
  createLineRouter,
  verifyLineIdentity,
} from "../server/line.mjs";

import { memoryDb } from "./fixtures/memory-db.mjs";
const userId = "U" + "1".repeat(32);
const env = {
  LINE_ENABLED: "true",
  LINE_LOGIN_CHANNEL_ID: "123456789",
  LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "fixture-only",
  LINE_ADMIN_EMAILS: "admin@example.invalid",
  CRON_SECRET: "fixture-only-".repeat(4),
};
function fixture() {
  const db = memoryDb(),
    pushes = [];
  let time = new Date("2035-06-10T02:00:00Z"),
    response = 200,
    responseHeaders = {};
  db.rows.set("equipment/fixture", {
    title: "ลำโพงทดสอบ",
    assetCode: "FIXTURE-01",
    status: "available",
  });
  const request = async (url, options) => {
    if (url === "https://api.line.me/oauth2/v2.1/verify") {
      assert.equal(options.body.get("client_id"), env.LINE_LOGIN_CHANNEL_ID);
      return Response.json({
        aud: env.LINE_LOGIN_CHANNEL_ID,
        iss: "https://access.line.me",
        exp: +time / 1000 + 3600,
        sub: options.body.get("id_token") === "other-account" ? "U" + "2".repeat(32) : userId,
      });
    }
    assert.equal(url, "https://api.line.me/v2/bot/message/push");
    pushes.push({
      payload: JSON.parse(options.body),
      key: options.headers["X-Line-Retry-Key"],
    });
    return new Response(null, { status: response, headers: responseHeaders });
  };
  const service = createLineService({ db, env, request, now: () => time });
  const body = {
    idToken: "fixture-id-token",
    lineConsent: true,
    requestId: "c8ed05f3-76b1-4f51-83bf-1581bbb82591",
    equipmentId: "fixture",
    fullName: "ผู้ยืมทดสอบ",
    studentId: "TEST-01",
    faculty: "คณะทดสอบ",
    department: "สาขาทดสอบ",
    affiliation: "",
    applicantEmail: "student@example.invalid",
    applicantPhone: "",
    activityName: "กิจกรรมทดสอบ",
    reason: "ทดสอบ",
    startDate: "2035-06-10",
    endDate: "2035-06-11",
    terms: true,
  };
  return {
    db,
    service,
    body,
    pushes,
    request,
    now: () => time,
    setTime: (value) => {
      time = new Date(value);
    },
    setResponse: (value, headers = {}) => {
      response = value;
      responseHeaders = headers;
    },
  };
}

test("LINE verifies token issuer, audience, expiry and subject; never trusts a supplied user ID", async () => {
  const valid = {
    aud: env.LINE_LOGIN_CHANNEL_ID,
    iss: "https://access.line.me",
    exp: Date.now() / 1000 + 3600,
    sub: userId,
  };
  for (const invalid of [
    { aud: "other" },
    { iss: "https://attacker.invalid" },
    { exp: 1 },
    { sub: "attacker" },
  ])
    await assert.rejects(
      () =>
        verifyLineIdentity("fixture", env.LINE_LOGIN_CHANNEL_ID, async () =>
          Response.json({ ...valid, ...invalid }),
        ),
      (e) => e.status === 401,
    );
  await assert.rejects(
    () =>
      verifyLineIdentity(
        "fixture",
        env.LINE_LOGIN_CHANNEL_ID,
        async () => new Response(null, { status: 400 }),
      ),
    (e) => e.status === 401,
  );
  const f = fixture();
  const key = await f.service.createBooking({
    ...f.body,
    lineUserId: "attacker",
    equipmentName: "forged",
    status: "approved",
  });
  const booking = f.db.rows.get("bookings/" + key),
    recipient = f.db.rows.get("lineBookingRecipients/" + key);
  assert.equal(booking.status, "pending");
  assert.equal(booking.equipmentName, "ลำโพงทดสอบ");
  assert.equal(recipient.userId, userId);
  assert(!JSON.stringify(booking).includes(userId));
  assert(!JSON.stringify([...f.db.rows]).includes("fixture-id-token"));
});
test("LINE booking validates consent/dates, is idempotent and rejects altered retries", async () => {
  const f = fixture();
  for (const bad of [
    { lineConsent: false },
    { endDate: "2035-02-30" },
    { endDate: "2035-06-09" },
    { terms: false },
  ])
    await assert.rejects(() => f.service.createBooking({ ...f.body, ...bad }));
  assert.equal(f.db.rows.size, 1);
  const first = await f.service.createBooking(f.body);
  assert.equal(await f.service.createBooking(f.body), first);
  await assert.rejects(
    () => f.service.createBooking({ ...f.body, fullName: "changed" }),
    (e) => e.status === 409,
  );
  assert.equal(f.db.rows.size, 4); // Equipment, booking, recipient and submission budget.
});
test("LINE history only returns bookings owned by the verified LINE subject", async () => {
  const f = fixture();
  const mine = await f.service.createBooking(f.body);
  const theirs = await f.service.createBooking({ ...f.body, idToken: "other-account", requestId: "89b5e4c3-20ff-45a4-9625-466228689c10", fullName: "บัญชีอื่น" });
  const first = await f.service.myBookings("fixture-id-token");
  assert.deepEqual(first.items.map(item => item.id), [mine]);
  assert(!JSON.stringify(first).includes("บัญชีอื่น"));
  assert(!JSON.stringify(first).includes("other-account"));
  await assert.rejects(() => f.service.myBookings("fixture-id-token", "", theirs), error => error.status === 404);
  assert.deepEqual((await f.service.myBookings("other-account")).items.map(item => item.id), [theirs]);
  await assert.rejects(() => f.service.myBookings("fixture-id-token", "broken~cursor"), error => error.status === 400);
});
test("approval commits once and push retries reuse a durable key; concurrent delivery is leased", async () => {
  const f = fixture(),
    key = await f.service.createBooking(f.body);
  f.setResponse(429);
  assert.equal(await f.service.approve(key, "", "admin-fixture"), "queued");
  assert.equal(f.db.rows.get("bookings/" + key).status, "approved");
  f.setResponse(200);
  const job = [...f.db.rows.keys()]
    .find((k) => k.startsWith("lineNotifications/"))
    .split("/")
    .at(-1);
  await Promise.all([f.service.deliver(job), f.service.deliver(job)]);
  assert.equal(f.pushes.length, 2);
  assert.equal(f.pushes[0].key, f.pushes[1].key);
  assert.deepEqual(f.pushes[0].payload, f.pushes[1].payload);
  await f.service.approve(key, "", "admin-fixture");
  assert.equal(f.pushes.length, 2);
  assert.match(f.pushes[1].payload.messages[0].text, /อนุมัติ/);
});
test("reminders use Bangkok dates, send before/due once and stop after return or changed due date", async () => {
  const f = fixture(),
    key = await f.service.createBooking(f.body);
  await f.service.approve(key, "", "admin-fixture");
  await f.service.reminders();
  await f.service.reminders();
  assert.equal(f.pushes.length, 2);
  assert.match(f.pushes[1].payload.messages[0].text, /พรุ่งนี้/);
  f.setTime("2035-06-11T02:00:00Z");
  await f.service.reminders();
  await f.service.reminders();
  assert.equal(f.pushes.length, 3);
  assert.match(f.pushes[2].payload.messages[0].text, /วันนี้/);
  f.db.rows.get("bookings/" + key).status = "returned";
  f.setTime("2035-06-12T02:00:00Z");
  await f.service.reminders();
  assert.equal(f.pushes.length, 3);
  const g = fixture(),
    other = await g.service.createBooking(g.body);
  g.setResponse(500);
  await g.service.approve(other, "", "admin-fixture");
  await g.service.reminders();
  g.db.rows.get("bookings/" + other).endDate = new Date(
    "2035-06-15T00:00:00+07:00",
  );
  const before = g.pushes.length;
  g.setResponse(200);
  await g.service.reminders();
  // Do not change an ambiguous retry payload; obsolete reminders are skipped.
  assert.equal(g.pushes.length, before);
  assert([...g.db.rows.values()].some((row) => row.status === "needs_review"));
});
test("ambiguous pushes stop before the 24-hour LINE deduplication expiry", async () => {
  const f = fixture(),
    key = await f.service.createBooking(f.body);
  f.setResponse(500);
  await f.service.approve(key, "", "admin-fixture");
  f.setTime("2035-06-11T02:00:00Z");
  const job = [...f.db.rows.keys()].find((k) =>
    k.startsWith("lineNotifications/"),
  );
  assert.equal(await f.service.deliver(job.split("/").at(-1)), "unchanged");
  assert.equal(f.db.rows.get(job).status, "needs_review");
  assert.equal(f.pushes.length, 1);
});
test("HTTP routes require explicit enablement, verified admin claims and cron secret", async () => {
  const f = fixture();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/line",
    createLineRouter({
      getDb: () => f.db,
      env,
      request: f.request,
      now: f.now,
      verifyAdmin: async (token) => {
        if (token === "allow")
          return {
            uid: "admin",
            admin: true,
            email: "admin@example.invalid",
            email_verified: true,
          };
        return {
          uid: "other",
          email:
            token === "unverified"
              ? "admin@example.invalid"
              : "other@example.invalid",
          email_verified: token !== "unverified",
        };
      },
    }),
  );
  app.use(
    "/disabled",
    createLineRouter({
      getDb: () => {
        throw Error("must not initialize");
      },
      env: {},
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const key = await f.service.createBooking(f.body);
    for (const token of ["", "other", "unverified"]) {
      const res = await fetch(
        origin + "/api/line/bookings/" + key + "/approve",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: "{}",
        },
      );
      assert.equal(res.status, token ? 403 : 401);
    }
    assert.equal((await fetch(origin + "/api/line/reminders")).status, 401);
    assert.equal((await fetch(origin + "/disabled/reminders")).status, 503);
    assert.equal(f.pushes.length, 0);
    const approved = await fetch(
      origin + "/api/line/bookings/" + key + "/approve",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer allow",
        },
        body: "{}",
      },
    );
    assert.equal(approved.status, 200);
    assert.equal(f.pushes.length, 1);
    assert.equal(
      (
        await fetch(origin + "/api/line/reminders", {
          headers: { Authorization: "Bearer " + env.CRON_SECRET },
        })
      ).status,
      200,
    );
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});

test("a queued approval/reminder is skipped after return; reminders never send before 09:00 Bangkok", async () => {
  const f = fixture(),
    key = await f.service.createBooking(f.body);
  f.setTime("2035-06-10T01:59:00Z");
  await f.service.approve(key, "", "admin-fixture");
  await f.service.reminders();
  assert.equal(
    f.pushes.length,
    1,
    "approval may send immediately, reminder must wait",
  );
  f.setTime("2035-06-10T02:00:00Z");
  f.setResponse(429);
  await f.service.reminders();
  assert.equal(f.pushes.length, 2);
  f.db.rows.get("bookings/" + key).status = "returned";
  f.setResponse(200);
  await f.service.reminders();
  assert.equal(f.pushes.length, 2, "return cancels the queued reminder");
  const g = fixture(),
    other = await g.service.createBooking(g.body);
  g.setResponse(500);
  await g.service.approve(other, "", "admin-fixture");
  g.db.rows.get("bookings/" + other).status = "returned";
  g.setResponse(200);
  await g.service.reminders();
  assert.equal(
    g.pushes.length,
    1,
    "return cancels a queued approval notice too",
  );
});

test("only documented duplicate acceptance counts as sent; other 4xx require review", async () => {
  for (const [status, headers, expected] of [
    [409, { "x-line-accepted-request-id": "fixture-request" }, "accepted"],
    [409, {}, "needs_review"],
    [400, {}, "needs_review"],
    [401, {}, "needs_review"],
  ]) {
    const f = fixture(),
      key = await f.service.createBooking(f.body);
    f.setResponse(status, headers);
    assert.equal(await f.service.approve(key, "", "admin-fixture"), expected);
    await f.service.reminders();
    const approvalCalls = f.pushes.filter((p) =>
      p.payload.messages[0].text.includes("อนุมัติ"),
    );
    assert.equal(approvalCalls.length, 1);
  }
});

test("LINE submissions use verified-subject quota without charging duplicate retries",async()=>{
 const f=fixture();
 for(let i=0;i<30;i++)await f.service.createBooking({...f.body,requestId:randomUUID()});
 await assert.rejects(()=>f.service.createBooking(f.body),e=>e.status===429);
 const other={...f.body,idToken:"other-account"};
 const key=await f.service.createBooking(other);
 assert.equal(await f.service.createBooking(other),key);
 assert.equal([...f.db.rows.keys()].filter(k=>k.startsWith("bookings/")).length,31);
 f.setTime('2035-06-10T02:01:00Z');await f.service.createBooking(f.body);
});
