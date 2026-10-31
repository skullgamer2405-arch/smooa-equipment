import type { Equipment, Booking, CalendarEntry } from "./types";
const names = [
  "ชุดไมโครโฟนไร้สาย",
  "ลำโพงพกพา",
  "ลูกบาสเกตบอล",
  "ชุดแบดมินตัน",
  "เก้าอี้จัดกิจกรรม",
  "โต๊ะพับอเนกประสงค์",
  "สายไฟพร้อมรางปลั๊ก",
  "ลูกฟุตบอล",
];
export function fixtureState() {
  const now = new Date(),
    end = new Date(now);
  end.setDate(end.getDate() + 2);
  const equipment: Equipment[] = names.map((title, i) => ({
    id: "eq-" + i,
    title,
    assetCode: "SMO-" + String(i + 1).padStart(3, "0"),
    category: i < 2 ? "ครุภัณฑ์" : i < 4 || i === 7 ? "กีฬา" : "อุปกรณ์จิปาถะ",
    description:
      "อุปกรณ์สำหรับกิจกรรมของนักศึกษา กรุณาตรวจสภาพก่อนรับและส่งคืน",
    status: i === 1 ? "unavailable" : i === 6 ? "maintenance" : "available",
    createdAt: now.toISOString(),
  }));
  const bookings: Booking[] = [
    {
      id: "booking-sample",
      equipmentId: "eq-1",
      equipmentName: names[1],
      assetCode: "SMO-002",
      fullName: "นักศึกษาตัวอย่าง",
      studentId: "DEMO-001",
      faculty: "คณะพยาบาลศาสตร์",
      department: "สาขาพยาบาลศาสตร์",
      affiliation: "สโมสรนักศึกษา",
      applicantEmail: "student@example.invalid",
      applicantPhone: "0000000000",
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      activityName: "กิจกรรมต้อนรับนักศึกษา",
      reason: "ใช้ประกอบกิจกรรมส่วนกลาง",
      status: "approved",
      createdAt: now.toISOString(),
    },
  ];
  return { equipment, bookings, calendarEntries: [] as CalendarEntry[] };
}
