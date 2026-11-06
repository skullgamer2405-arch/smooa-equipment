import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { memoryDb } from "./fixtures/memory-db.mjs";
import { createBookingService } from "../server/bookings.mjs";
import { createLineService, notificationText } from "../server/line.mjs";
import { createApp } from "../server.js";

function fixture(quantity = 5) {
  const db = memoryDb(), now = () => new Date("2035-06-10T02:00:00Z");
  db.rows.set("equipment/fixture", { title: "เก้าอี้", assetCode: "CHAIR", category: "ครุภัณฑ์", status: "available", quantity, borrowedQuantity: 0 });
  const bookings = createBookingService({ db, now });
  const line = createLineService({ db, now, env: { LINE_LOGIN_CHANNEL_ID: "123" }, request: async () => Response.json({ sub: "U" + "1".repeat(32), aud: "123", iss: "https://access.line.me", exp: +now() / 1000 + 3600 }) });
  const body = { equipmentId: "fixture", fullName: "ผู้ทดสอบ", studentId: "TEST", faculty: "คณะ", department: "สาขา", affiliation: "", applicantEmail: "test@example.invalid", applicantPhone: "", activityName: "กิจกรรม", reason: "ทดสอบ", startDate: "2035-06-10", endDate: "2035-06-11", terms: true, quantity: 3 };
  const create = (values = {}) => bookings.create({ ...body, requestId: randomUUID(), ...values });
  return { db, now, bookings, line, body, create, item: () => db.rows.get("equipment/fixture") };
}

test("quantity: web and LINE keep quantity and reject invalid or excessive requests", async () => {
  for (const channel of ["web", "line"]) {
    const f = fixture();
    const create = values => channel === "web" ? f.create(values) : f.line.createBooking({ ...f.body, idToken: "fixture", lineConsent: true, requestId: randomUUID(), ...values });
    for (const quantity of [0, -1, 1.5, "2", null, 10001, 6]) await assert.rejects(() => create({ quantity }));
    const id = await create({ quantity: 3 });
    assert.equal(f.db.rows.get("bookings/" + id).quantity, 3);
    assert.equal(f.item().borrowedQuantity, 0, "pending does not reserve stock");
  }
});

test("quantity: partial stock, concurrent approvals, and repeated returns never oversell or inflate stock", async () => {
  const f = fixture();
  const first = await f.create(), second = await f.create();
  const results = await Promise.allSettled([f.line.approve(first, "", "admin"), f.line.approve(second, "", "admin")]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(f.item().status, "available");
  assert.equal(f.item().borrowedQuantity, 3);
  const approved = f.db.rows.get("bookings/" + first).status === "approved" ? first : second;
  const last = await f.create({ quantity: 2 });
  await f.line.approve(last, "", "admin");
  assert.equal(f.item().status, "unavailable");
  assert.equal(f.item().borrowedQuantity, 5);
  await assert.rejects(() => f.create({ quantity: 1 }));
  await f.bookings.returnItem("fixture", approved);
  assert.equal(f.item().status, "available");
  assert.equal(f.item().borrowedQuantity, 2);
  await assert.rejects(() => f.bookings.returnItem("fixture", approved));
  assert.equal(f.item().borrowedQuantity, 2);
  await f.bookings.returnItem("fixture", last);
  assert.equal(f.item().borrowedQuantity, 0);
  assert.equal(f.item().quantity, 5);
});

test("quantity: legacy rows are one piece and returns preserve maintenance", async () => {
  const f = fixture();
  delete f.item().quantity; delete f.item().borrowedQuantity;
  const id = await f.create({ quantity: undefined });
  await f.line.approve(id, "", "admin");
  assert.equal(f.item().quantity, 1);
  assert.equal(f.item().borrowedQuantity, 1);
  f.item().status = "maintenance";
  await f.bookings.returnItem("fixture", id);
  assert.equal(f.item().status, "maintenance");
  assert.equal(f.item().borrowedQuantity, 0);
  assert.match(notificationText(f.db.rows.get("bookings/" + id), "overdue"), /จำนวน: 1 ชิ้น/);
});

test("quantity: partial returns restore only received pieces, deduplicate retries, and leave reminders active", async () => {
  const f = fixture();
  const id = await f.create({ quantity: 5 }); await f.line.approve(id, "", "admin");
  const request = { quantity: 2, requestId: randomUUID() };
  await Promise.all([f.bookings.returnItem("fixture", id, request), f.bookings.returnItem("fixture", id, request)]);
  const booking = () => f.db.rows.get("bookings/" + id);
  assert.equal(booking().status, "approved");
  assert.equal(booking().returnedQuantity, 2);
  assert.equal(f.item().borrowedQuantity, 3);
  assert.equal(f.item().status, "available");
  assert.match(notificationText(booking(), "overdue"), /ค้างคืน: 3 ชิ้น/);
  assert.equal(f.db.rows.get("publicCalendar/" + id).returnedQuantity, 2);
  await assert.rejects(() => f.bookings.returnItem("fixture", id, { ...request, quantity: 1 }));
  await assert.rejects(() => f.bookings.returnItem("fixture", id, { quantity: 4, requestId: randomUUID() }));
  await assert.rejects(() => f.bookings.returnItem("fixture", id, { quantity: 1 }));
  await f.bookings.returnItem("fixture", id, { quantity: 3, requestId: randomUUID() });
  assert.equal(booking().status, "returned");
  assert.equal(booking().returnedQuantity, 5);
  assert.equal(f.item().borrowedQuantity, 0);
  assert.equal(f.db.rows.has("publicCalendar/" + id), false);
  await f.bookings.returnItem("fixture", id, request);
  assert.equal(f.item().borrowedQuantity, 0);
});

test("quantity: equipment API validates admin, rejects lowering below active loans, ignores forged counters, blocks active deletion", async () => {
  const f = fixture();
  const id = await f.create(); await f.line.approve(id, "", "admin");
  const app = createApp({ env: {}, getDb: () => f.db, now: f.now, verifyAdmin: async token => ({ uid: token, admin: token === "admin", email_verified: true }), transport: null });
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const call = (method, body, token = "admin", path = "/fixture") => fetch("http://127.0.0.1:" + server.address().port + "/api/admin/equipment" + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const draft = { title: "เก้าอี้ใหม่", assetCode: "CHAIR", category: "ครุภัณฑ์", status: "available", quantity: 2 };
  try {
    assert.equal((await call("PUT", draft, "ordinary")).status, 403);
    assert.equal((await call("PUT", draft)).status, 409);
    assert.equal((await call("DELETE")).status, 409);
    assert.equal((await call("PUT", { ...draft, quantity: 7, borrowedQuantity: 0 })).status, 200);
    assert.equal(f.item().quantity, 7); assert.equal(f.item().borrowedQuantity, 3);
    assert.equal((await call("POST", { ...draft, quantity: 0 }, "admin", "")).status, 400);
    assert.equal((await call("POST", { ...draft, quantity: 4 }, "admin", "")).status, 200);
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
});

test("quantity: returns always name the borrower booking and never include new loans", async () => {
  const f = fixture(10);
  const first = await f.create({ quantity: 3 }); await f.line.approve(first, "", "admin");
  await assert.rejects(() => f.bookings.returnItem("fixture"), error => error.status === 400);
  const second = await f.create({ quantity: 2 }); await f.line.approve(second, "", "admin");
  await f.bookings.returnItem("fixture", first, { quantity: 3, requestId: randomUUID() });
  assert.equal(f.item().borrowedQuantity, 2);
  assert.equal(f.db.rows.get("bookings/" + second).status, "approved");
});

test("quantity: active-loan limit never prevents returning existing loans", async () => {
  const f = fixture(101);
  for (let i = 0; i < 99; i++) f.db.rows.set("bookings/active-" + i, { ...f.body, quantity: 1, status: "approved" });
  f.item().borrowedQuantity = 99;
  const last = await f.create({ quantity: 1 });
  const blocked = await f.create({ quantity: 1 });
  await f.line.approve(last, "", "admin");
  assert.equal(f.item().borrowedQuantity, 100);
  await assert.rejects(() => f.line.approve(blocked, "", "admin"), error => error.status === 409);
  await f.bookings.returnItem("fixture", "active-0");
  assert.equal(f.item().borrowedQuantity, 99);
  await f.line.approve(blocked, "", "admin");
  await f.bookings.returnItem("fixture", last);
  assert.equal(f.item().borrowedQuantity, 99);
});
