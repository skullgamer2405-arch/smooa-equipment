export interface Equipment {
  id: string;
  title: string;
  assetCode: string;
  category: string;
  description?: string;
  imageUrl?: string;
  status: "available" | "unavailable" | "maintenance";
  createdAt?: unknown;
  returnDate?: unknown;
}
export interface Booking {
  id: string;
  equipmentId: string;
  equipmentName: string;
  assetCode: string;
  fullName: string;
  studentId: string;
  faculty: string;
  department: string;
  affiliation: string;
  applicantEmail: string;
  applicantPhone: string;
  startDate: unknown;
  endDate: unknown;
  activityName: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "returned";
  createdAt?: unknown;
  adminNote?: string;
  requestId?: string;
  lineLinked?: boolean;
}
export interface CalendarEntry {
  id: string;
  date: unknown;
  activityName: string;
  startTime?: string;
  endTime?: string;
  equipmentId?: string;
  equipmentName?: string;
}
export type CollectionName = "equipment" | "bookings" | "calendarEntries";
export type PublicEvent = { id: string; equipmentId: string; equipmentName: string; assetCode: string; startDay: string; endDay: string; status: Booking["status"] };
export type MyBooking = PublicEvent & { activityName: string; adminNote: string; createdAt: string };
export type BookingFilter = "all" | Booking["status"] | "due" | "overdue";
export type WatchOptions = { filter?: BookingFilter; cursor?: unknown; from?: string; to?: string; size?: number };
