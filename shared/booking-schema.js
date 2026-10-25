import { z } from "zod";

export function bangkokDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function validDay(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
/** @param {string} label */
const required = (label, max = 200) =>
  z
    .string()
    .trim()
    .min(1, "กรุณากรอก" + label)
    .max(max, "ข้อความยาวเกินกำหนด");
export const bookingSchema = z
  .object({
    fullName: required("ชื่อ–นามสกุล"),
    studentId: required("รหัสนักศึกษา", 20),
    faculty: required("คณะ"),
    department: required("สาขา"),
    affiliation: z.string().max(200),
    applicantEmail: z.string().email("กรุณากรอกอีเมลให้ถูกต้อง"),
    applicantPhone: z.string().max(30),
    activityName: required("ชื่อกิจกรรม", 300),
    reason: required("วัตถุประสงค์", 1000),
    startDate: required("วันยืม"),
    endDate: required("วันคืน"),
    terms: z.boolean().refine(Boolean, "กรุณายอมรับเงื่อนไขก่อนส่งคำขอ"),
  })
  .superRefine((d, ctx) => {
    for (const key of ["startDate", "endDate"]) {
      if (!validDay(d[key]))
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "วันที่ไม่ถูกต้อง",
        });
    }
    if (d.startDate < bangkokDay())
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "วันยืมต้องไม่อยู่ในอดีต",
      });
    if (d.endDate < d.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "วันคืนต้องไม่ก่อนวันยืม",
      });
  });
