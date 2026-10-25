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
