import { createHash } from "node:crypto";
import { z } from "zod";
import { bookingSchema, validDay } from "../shared/booking-schema.js";
import { publicBooking } from "../shared/calendar.js";
import { ApiError, documentId } from "./http.mjs";
import { submissionLimit } from "./submission-limit.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
export function createBookingService({ db, now = () => new Date() }) {
  async function create(body, principal = "anonymous") {
    const { requestId, equipmentId } = z.object({ requestId: z.string().uuid(), equipmentId: documentId }).parse(body);
    const { terms: _, ...fields } = bookingSchema.parse(body);
    const bookingId = "web-" + digest(requestId);
    const ref = db.collection("bookings").doc(bookingId);
    const fingerprint = digest(JSON.stringify({ ...fields, equipmentId }));
    const receipt = db.collection("bookingReceipts").doc(bookingId);
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref), previous = await tx.get(receipt);
      if (existing.exists) {
        if (previous.data()?.fingerprint !== fingerprint) throw new ApiError(409, "คำขอซ้ำมีข้อมูลต่างกัน กรุณาเริ่มคำขอใหม่");
        return;
      }
      const quota = await submissionLimit(tx, db, "web:" + principal, now());
      const item = await tx.get(db.collection("equipment").doc(equipmentId));
      if (!item.exists || item.data().status !== "available") throw new ApiError(409, "อุปกรณ์ไม่พร้อมให้ยืม กรุณาเลือกใหม่");
      const equipment = item.data();
      tx.create(ref, { ...fields, equipmentId, equipmentName: z.string().min(1).max(200).parse(equipment.title), assetCode: z.string().min(1).max(50).parse(equipment.assetCode), startDate: new Date(fields.startDate + "T00:00:00+07:00"), endDate: new Date(fields.endDate + "T00:00:00+07:00"), status: "pending", createdAt: now() });
      tx.create(receipt, { fingerprint });
      tx.set(quota.ref, quota.value);
    });
    return bookingId;
  }
  async function reject(bookingId, note, uid) {
    const ref = db.collection("bookings").doc(documentId.parse(bookingId));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().status !== "pending") throw new ApiError(409, "คำขอนี้ถูกดำเนินการแล้ว");
      tx.update(ref, { status: "rejected", adminNote: z.string().max(1000).parse(note), rejectedAt: now(), decidedBy: uid });
    });
  }
  async function returnItem(equipmentId, bookingId) {
    const eq = db.collection("equipment").doc(documentId.parse(equipmentId));
    await db.runTransaction(async (tx) => {
      const item = await tx.get(eq);
      if (!item.exists) throw new ApiError(404, "ไม่พบอุปกรณ์");
      const active = await tx.get(db.collection("bookings").where("equipmentId", "==", equipmentId).where("status", "==", "approved").limit(100));
      if (active.docs.length >= 100) throw new ApiError(409, "รายการรับคืนมากเกินไป กรุณาตรวจข้อมูลกับผู้ดูแล");
      if (bookingId && !active.docs.some((d) => d.id === bookingId)) throw new ApiError(409, "รายการนี้รับคืนแล้วหรือไม่ได้อยู่ระหว่างยืม");
      const selected = bookingId ? active.docs.filter((d) => d.id === bookingId) : active.docs;
      for (const snap of selected) {
        tx.update(db.collection("bookings").doc(snap.id), { status: "returned", returnedAt: now() });
        tx.delete(db.collection("publicCalendar").doc(snap.id));
      }
      if (!bookingId || active.docs.length === 1) tx.update(eq, { status: "available", returnDate: null });
    });
  }
  async function calendar({ from, to, equipmentId = "", after = "" }) {
    if (!validDay(from || "") || !validDay(to || "") || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 62) throw new ApiError(400, "เลือกช่วงวันไม่เกิน 62 วัน");
    let query = db.collection("publicCalendar").where("endDay", ">=", from).where("startDay", "<=", to).orderBy("endDay").orderBy("startDay").orderBy("__name__");
    if (equipmentId) query = query.where("equipmentId", "==", documentId.parse(equipmentId));
    if (after) {
      const [day, start, key] = after.split("~");
      if (!validDay(day || "") || !validDay(start || "")) throw new ApiError(400, "หน้าข้อมูลไม่ถูกต้อง");
      query = query.startAfter(day, start, documentId.parse(key));
    }
    const docs = (await query.limit(100).get()).docs;
    // Only the deliberate public projection is read; never serialize private bookings.
    const items = docs.filter((d) => d.data().startDay <= to && d.data().status === "approved").map((d) => ({ ...publicFields(d.data()), id: d.id }));
    const last = docs.at(-1);
    return { items, nextCursor: docs.length === 100 ? last.data().endDay + "~" + last.data().startDay + "~" + last.id : null };
  }
  return { create, reject, returnItem, calendar };
}
function publicFields(value) {
  const { equipmentId, equipmentName, assetCode, startDay, endDay, status } = value;
  return { equipmentId, equipmentName, assetCode, startDay, endDay, status };
}
export { publicBooking };
