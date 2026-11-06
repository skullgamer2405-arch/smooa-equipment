import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createApp } from "../server.js";
import { createBookingService } from "../server/bookings.mjs";
import { createLineService } from "../server/line.mjs";
import { createInventoryService } from "../server/inventory.mjs";

test("Firestore emulator supports API queries, approval and return transactions with private notifications", async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "Only the loopback demo emulator is permitted");
  const firebase = initializeApp({ projectId: "demo-smooa-test" }, "api-integration");
  const db = getFirestore(firebase), equipmentId = "integration-" + randomUUID();
  const equipment = db.collection("equipment").doc(equipmentId);
  let time = new Date("2035-06-09T03:00:00Z");
  const mails = [], pushes = [];
  const env = { LINE_ENABLED: "true", LINE_LOGIN_CHANNEL_ID: "123", LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "fixture-only", CRON_SECRET: "fixture-cron-".repeat(4), ADMIN_NOTIFICATION_EMAIL: "first@example.invalid,second@example.invalid", PUBLIC_APP_URL: "https://fixture.example.invalid" };
  const app = createApp({ env, getDb: () => db, now: () => time,
    verifyAdmin: async token => ({ uid: "fixture", admin: token === "fixture-admin", email_verified: true }),
    transport: { sendMail: async mail => { mails.push(mail); return { accepted: mail.to.split(","), rejected: [] }; } },
    request: async (url, options) => {
      if (url === "https://api.line.me/oauth2/v2.1/verify") return Response.json({ sub: "U" + "1".repeat(32), aud: "123", iss: "https://access.line.me", exp: +time / 1000 + 3600 });
      assert.equal(url, "https://api.line.me/v2/bot/message/push");
      pushes.push(JSON.parse(options.body)); return Response.json({});
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const request = async (route, body, token = "") => {
    const response = await fetch(base + route, { ...(body ? { method: "POST", body: JSON.stringify(body) } : {}), headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) } });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result)); return result;
  };
  try {
    await equipment.set({ title: "Integration equipment", assetCode: "INTEGRATION", status: "available", createdAt: time });
    const summary = await request("/api/public/equipment-summary"); assert(summary.available >= 1);
    const body = { requestId: randomUUID(), equipmentId, fullName: "Fixture borrower", studentId: "TEST-001", faculty: "Fixture", department: "Fixture", affiliation: "", applicantEmail: "borrower@example.invalid", applicantPhone: "", activityName: "Fixture activity", reason: "Integration test", startDate: "2035-06-10", endDate: "2035-06-11", terms: true, lineConsent: true, idToken: "fixture-line-token" };
    const { bookingId } = await request("/api/line/bookings", body);
    assert.equal((await db.collection("bookings").doc(bookingId).get()).data().status, "pending");
    assert.equal(mails[0].to, "first@example.invalid,second@example.invalid");
    await request("/api/admin/bookings/" + bookingId + "/decision", { action: "approved" }, "fixture-admin");
    assert.equal((await equipment.get()).data().status, "unavailable");
    assert.equal(pushes.length, 1); assert.equal(mails[1].to, body.applicantEmail);
    const calendar = await request("/api/public/calendar?from=2035-06-09&to=2035-06-12");
    const row = calendar.items.find(value => value.id === bookingId); assert(row);
    assert.equal(row.fullName, undefined); assert.equal(row.applicantEmail, undefined);
    await request("/api/admin/booking-summary", undefined, "fixture-admin");
    time = new Date("2035-06-12T02:13:00Z");
    assert.equal((await request("/api/line/reminders", undefined, env.CRON_SECRET)).accepted, 1);
    assert.equal(pushes.length, 2);
    assert.match(pushes[1].messages[0].text, /เกินกำหนด/);
    assert.equal((await request("/api/line/reminders", undefined, env.CRON_SECRET)).accepted, 0);
    time = new Date("2035-06-13T02:13:00Z");
    assert.equal((await request("/api/line/reminders", undefined, env.CRON_SECRET)).accepted, 1);
    assert.equal(pushes.length, 3);
    await request("/api/admin/equipment/" + equipmentId + "/return", { bookingId }, "fixture-admin");
    assert.equal((await equipment.get()).data().status, "available");
    assert.equal((await db.collection("bookings").doc(bookingId).get()).data().status, "returned");
    assert.equal((await db.collection("publicCalendar").doc(bookingId).get()).exists, false);
    assert.equal((await request("/api/line/my-bookings/" + bookingId, undefined, "fixture-line-token")).items[0].status, "returned");
    assert.equal((await request("/api/line/reminders", undefined, env.CRON_SECRET)).accepted, 0);
    assert.equal(pushes.length, 3);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await db.terminate(); await deleteApp(firebase);
  }
});

test("Firestore transactions serialize stock approval, partial return retries, and inventory edits", async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
  const firebase = initializeApp({ projectId: "demo-smooa-test" }, "quantity-integration");
  const db = getFirestore(firebase), now = () => new Date("2035-06-10T02:00:00Z");
  const inventory = createInventoryService({ db, now }), bookings = createBookingService({ db, now });
  const line = createLineService({ db, now, env: {}, request: async () => { throw Error("No real notifications allowed"); } });
  const draft = { title: "เก้าอี้ทดสอบ", assetCode: "CHAIR", status: "available", quantity: 5 };
  const equipmentId = await inventory.save(draft);
  const ref = db.collection("equipment").doc(equipmentId);
  const body = { equipmentId, fullName: "Fixture", studentId: "TEST", faculty: "คณะ", department: "สาขา", affiliation: "", applicantEmail: "test@example.invalid", applicantPhone: "", activityName: "Test", reason: "Test", startDate: "2035-06-10", endDate: "2035-06-11", terms: true, quantity: 3 };
  try {
    const first = await bookings.create({ ...body, requestId: randomUUID() });
    const second = await bookings.create({ ...body, requestId: randomUUID() });
    const results = await Promise.allSettled([line.approve(first, "", "fixture"), line.approve(second, "", "fixture")]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await ref.get()).data().borrowedQuantity, 3);
    assert.equal((await ref.get()).data().status, "available");
    const approved = results[0].status === "fulfilled" ? first : second;
    const pending = approved === first ? second : first;
    const receive = { quantity: 2, requestId: randomUUID() };
    await Promise.all([bookings.returnItem(equipmentId, approved, receive), bookings.returnItem(equipmentId, approved, receive)]);
    assert.equal((await ref.get()).data().borrowedQuantity, 1);
    assert.equal((await db.collection("bookings").doc(approved).get()).data().returnedQuantity, 2);
    const competing = await Promise.allSettled([inventory.save({ ...draft, quantity: 3 }, equipmentId), line.approve(pending, "", "fixture")]);
    assert.equal(competing.filter(r => r.status === "fulfilled").length, 1);
    const saved = (await ref.get()).data();
    assert(saved.borrowedQuantity <= saved.quantity);
    await assert.rejects(() => inventory.remove(equipmentId), error => error.status === 409);
    await bookings.returnItem(equipmentId, approved);
    if ((await db.collection("bookings").doc(pending).get()).data().status === "approved") await bookings.returnItem(equipmentId, pending);
    assert.equal((await ref.get()).data().borrowedQuantity, 0);
    await inventory.remove(equipmentId);
    assert.equal((await ref.get()).exists, false);
  } finally { await db.terminate(); await deleteApp(firebase); }
});
