import { bangkokDay } from "./booking-schema.js";
import { bookingQuantity, returnedQuantity } from "./inventory.js";
export const asDay = (value) => bangkokDay(value?.toDate ? value.toDate() : new Date(value));
export function publicBooking(id, value) {
  return { id, equipmentId: value.equipmentId, equipmentName: value.equipmentName, assetCode: value.assetCode, quantity: bookingQuantity(value), returnedQuantity: returnedQuantity(value), startDay: asDay(value.startDate), endDay: asDay(value.endDate), status: value.status };
}
