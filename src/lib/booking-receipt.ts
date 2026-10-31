import { z } from "zod";
import { validDay } from "../../shared/booking-schema.js";

const receiptSchema = z.object({
  bookingId: z.string().min(1).max(150),
  equipmentName: z.string().max(200).optional(),
  assetCode: z.string().max(200).optional(),
  startDate: z.string().refine(validDay).optional(),
  endDate: z.string().refine(validDay).optional(),
  lineRequested: z.boolean().default(false),
}).refine(value => Boolean(value.startDate) === Boolean(value.endDate));

export function bookingReceipt(value: unknown) {
  const result = receiptSchema.safeParse(value);
  return result.success ? result.data : null;
}
