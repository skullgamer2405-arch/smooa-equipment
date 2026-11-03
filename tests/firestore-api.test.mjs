import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createApp } from "../server.js";

test("Firestore emulator supports API queries, approval and return transactions with private notifications", async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080", "Only the loopback demo emulator is permitted");
  const firebase = initializeApp({ projectId: "demo-smooa-test" }, "api-integration");
  const db = getFirestore(firebase), equipmentId = "integration-" + randomUUID();
  const equipment = db.collection("equipment").doc(equipmentId);
  const time = new Date("2035-06-09T03:00:00Z"), mails = [], pushes = [];
  const env = { LINE_ENABLED: "true", LINE_LOGIN_CHANNEL_ID: "123", LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "fixture-only", ADMIN_NOTIFICATION_EMAIL: "first@example.invalid,second@example.invalid", PUBLIC_APP_URL: "https://fixture.example.invalid" };
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
  const request = async (route, body, admin = false) => {
    const response = await fetch(base + route, { ...(body ? { method: "POST", body: JSON.stringify(body) } : {}), headers: { "Content-Type": "application/json", ...(admin ? { Authorization: "Bearer fixture-admin" } : {}) } });
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
    await request("/api/admin/bookings/" + bookingId + "/decision", { action: "approved" }, true);
    assert.equal((await equipment.get()).data().status, "unavailable");
    assert.equal(pushes.length, 1); assert.equal(mails[1].to, body.applicantEmail);
    const calendar = await request("/api/public/calendar?from=2035-06-09&to=2035-06-12");
    const row = calendar.items.find(value => value.id === bookingId); assert(row);
    assert.equal(row.fullName, undefined); assert.equal(row.applicantEmail, undefined);
    await request("/api/admin/booking-summary", undefined, true);
    await request("/api/admin/equipment/" + equipmentId + "/return", { bookingId }, true);
    assert.equal((await equipment.get()).data().status, "available");
    assert.equal((await db.collection("bookings").doc(bookingId).get()).data().status, "returned");
    assert.equal((await db.collection("publicCalendar").doc(bookingId).get()).exists, false);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await db.terminate(); await deleteApp(firebase);
  }
});
