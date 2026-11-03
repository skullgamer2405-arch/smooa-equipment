import { bangkokDay } from "./booking-schema.js";
export const asDay = (value) => bangkokDay(value?.toDate ? value.toDate() : new Date(value));
export function publicBooking(id, value) {
  return { id, equipmentId: value.equipmentId, equipmentName: value.equipmentName, assetCode: value.assetCode, startDay: asDay(value.startDate), endDay: asDay(value.endDate), status: value.status };
}
