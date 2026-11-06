import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, documentId } from "./http.mjs";
import { remainingQuantity, quantitySchema, stockFields } from "../shared/inventory.js";

export async function activeLoans(tx, db, equipmentId) {
  const result = await tx.get(db.collection("bookings").where("equipmentId", "==", equipmentId).where("status", "==", "approved").limit(101));
  if (result.docs.length > 100) throw new ApiError(409, "คำขอที่ยังไม่คืนมีจำนวนมาก กรุณาติดต่อผู้ดูแลระบบ");
  return result.docs;
}
export const loanTotal = loans => loans.reduce((sum, row) => sum + remainingQuantity(row.data()), 0);

const equipmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  assetCode: z.string().trim().min(1).max(50),
  category: z.string().trim().max(200).default("ครุภัณฑ์"),
  description: z.string().max(5000).default(""),
  imageUrl: z.string().max(2048).refine(value => !value || /^https?:\/\/[^\s]+$/i.test(value), "URL รูปภาพไม่ถูกต้อง").default(""),
  status: z.enum(["available", "unavailable", "maintenance"]),
  quantity: quantitySchema.default(1),
});

export function createInventoryService({ db, now = () => new Date() }) {
  async function save(body, id) {
    const data = equipmentSchema.parse(body);
    const ref = db.collection("equipment").doc(id ? documentId.parse(id) : randomUUID());
    await db.runTransaction(async tx => {
      const current = await tx.get(ref);
      if (id && !current.exists) throw new ApiError(404, "ไม่พบอุปกรณ์");
      const borrowed = id ? loanTotal(await activeLoans(tx, db, id)) : 0;
      if (data.quantity < borrowed) throw new ApiError(409, `ยังมีอุปกรณ์ที่ไม่คืน ${borrowed} ชิ้น จำนวนทั้งหมดต้องไม่น้อยกว่านี้`);
      const value = { ...data, ...stockFields(data.quantity, borrowed, data.status), updatedAt: now() };
      if (id) tx.update(ref, value);
      else tx.create(ref, { ...value, createdAt: now() });
    });
    return ref.id;
  }
  async function remove(id) {
    const ref = db.collection("equipment").doc(documentId.parse(id));
    await db.runTransaction(async tx => {
      const item = await tx.get(ref);
      if (!item.exists) throw new ApiError(404, "ไม่พบอุปกรณ์");
      if ((await activeLoans(tx, db, id)).length) throw new ApiError(409, "อุปกรณ์นี้ยังมีผู้ยืม กรุณารับคืนให้ครบก่อนลบ");
      tx.delete(ref);
    });
  }
  return { save, remove };
}
