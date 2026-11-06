import { createHash } from "node:crypto";
import { z } from "zod";
import { bookingSchema, validDay } from "../shared/booking-schema.js";
import { publicBooking } from "../shared/calendar.js";
import { ApiError, documentId } from "./http.mjs";
import { submissionLimit } from "./submission-limit.mjs";
import { availableQuantity, totalQuantity, stockFields, fingerprintFields, quantitySchema, bookingQuantity, remainingQuantity, returnedQuantity } from "../shared/inventory.js";
import { activeLoans, loanTotal } from "./inventory.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
export function createBookingService({ db, now = () => new Date() }) {
  async function create(body, principal = "anonymous") {
    const { requestId, equipmentId } = z.object({ requestId: z.string().uuid(), equipmentId: documentId }).parse(body);
    const { terms: _, ...fields } = bookingSchema.parse(body);
    const bookingId = "web-" + digest(requestId);
    const ref = db.collection("bookings").doc(bookingId);
    const fingerprint = digest(JSON.stringify({ ...fingerprintFields(fields), equipmentId }));
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
      if (fields.quantity > availableQuantity(equipment)) throw new ApiError(409, "จำนวนที่ขอยืมเกินของที่เหลือ กรุณาตรวจจำนวนอีกครั้ง");
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
  async function returnItem(equipmentId, bookingId, options = {}) {
    if (!bookingId) throw new ApiError(400, "กรุณาเลือกรับคืนจากคำขอของผู้ยืม แล้วระบุจำนวนที่ได้รับจริง");
    documentId.parse(bookingId);
    const eq = db.collection("equipment").doc(documentId.parse(equipmentId));
    const partial = options.quantity !== undefined;
    const quantity = partial ? quantitySchema.parse(options.quantity) : undefined;
    const receipt = partial ? db.collection("equipmentReturns").doc(z.string().uuid().parse(options.requestId)) : null;
    await db.runTransaction(async (tx) => {
      if (receipt) {
        const previous = await tx.get(receipt);
        if (previous.exists) {
          const old = previous.data();
          if (old.equipmentId !== equipmentId || old.bookingId !== bookingId || old.quantity !== quantity) throw new ApiError(409, "รายการรับคืนซ้ำมีข้อมูลต่างกัน กรุณาตรวจรายการล่าสุด");
          return;
        }
      }
      const item = await tx.get(eq);
      if (!item.exists) throw new ApiError(404, "ไม่พบอุปกรณ์");
      const active = await activeLoans(tx, db, equipmentId);
      if (!active.some((d) => d.id === bookingId)) throw new ApiError(409, "รายการนี้รับคืนแล้วหรือไม่ได้อยู่ระหว่างยืม");
      const selected = active.filter((d) => d.id === bookingId);
      const received = partial ? quantity : loanTotal(selected);
      if (partial && quantity > remainingQuantity(selected[0].data())) throw new ApiError(409, "จำนวนที่รับคืนเกินจำนวนค้างคืน กรุณาตรวจรายการล่าสุด");
      const borrowed = loanTotal(active) - received;
      for (const snap of selected) {
        const booking = snap.data();
        const returned = partial ? returnedQuantity(booking) + quantity : bookingQuantity(booking);
        const complete = returned === bookingQuantity(booking);
        const changes = { status: complete ? "returned" : "approved", returnedQuantity: returned, lastReturnedAt: now(), ...(complete ? { returnedAt: now() } : {}) };
        tx.update(db.collection("bookings").doc(snap.id), changes);
        if (complete) tx.delete(db.collection("publicCalendar").doc(snap.id));
        else tx.set(db.collection("publicCalendar").doc(snap.id), publicBooking(snap.id, { ...booking, ...changes }));
      }
      tx.update(eq, { ...stockFields(totalQuantity(item.data()), borrowed, item.data().status), ...(borrowed === 0 ? { returnDate: null } : {}) });
      if (receipt) tx.create(receipt, { equipmentId, bookingId, quantity, receivedAt: now() });
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
  const { equipmentId, equipmentName, assetCode, startDay, endDay, status, quantity = 1, returnedQuantity = 0 } = value;
  return { equipmentId, equipmentName, assetCode, startDay, endDay, status, quantity, returnedQuantity };
}
export { publicBooking };
