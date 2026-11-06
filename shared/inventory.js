import { z } from "zod";

export const MAX_QUANTITY = 10000;
export const quantitySchema = z.number({ error: "กรุณาระบุจำนวนเป็นตัวเลข" }).int("กรุณาระบุจำนวนเต็ม").min(1, "จำนวนต้องไม่น้อยกว่า 1 ชิ้น").max(MAX_QUANTITY, "จำนวนต้องไม่เกิน 10,000 ชิ้น");
const validCount = value => Number.isInteger(value) && value >= 0 && value <= MAX_QUANTITY;
export const totalQuantity = item => item.quantity === undefined ? 1 : validCount(item.quantity) ? item.quantity : 0;
export const bookingQuantity = booking => booking.quantity === undefined ? 1 : quantitySchema.parse(booking.quantity);
export const returnedQuantity = booking => booking.returnedQuantity === undefined ? booking.status === "returned" ? bookingQuantity(booking) : 0 : z.number().int().min(0).max(bookingQuantity(booking)).parse(booking.returnedQuantity);
export const remainingQuantity = booking => bookingQuantity(booking) - returnedQuantity(booking);
export const borrowedQuantity = item => item.borrowedQuantity === undefined
  ? item.status === "unavailable" ? totalQuantity(item) : 0
  : validCount(item.borrowedQuantity) ? item.borrowedQuantity : totalQuantity(item);
export const availableQuantity = item => item.status === "available" ? Math.max(0, totalQuantity(item) - borrowedQuantity(item)) : 0;

/** @returns {{quantity: number, borrowedQuantity: number, status: "maintenance" | "unavailable" | "available"}} */
export function stockFields(quantity, borrowed, status) {
  return { quantity, borrowedQuantity: borrowed, status: status === "maintenance" ? "maintenance" : borrowed >= quantity ? "unavailable" : "available" };
}

// Keep fingerprints for old one-piece request retries compatible across deployment.
export function fingerprintFields(fields) {
  const { quantity, ...rest } = fields;
  return quantity === 1 ? rest : { ...rest, quantity };
}
