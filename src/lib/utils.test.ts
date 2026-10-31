import { describe, it, expect } from "vitest";
import {
  asDate,
  qrBookingPath,
  parseInputDate,
  inputDate,
  dateLabel,
} from "./utils";
import { mapRows } from "./import-equipment";
import { bookingSchema } from "../pages/booking";
describe("untrusted stored data", () => {
  it("does not execute or call malformed timestamp properties", () => {
    expect(asDate({ toDate: "not-callable" })).toBeNull();
    expect(asDate("invalid")).toBeNull();
  });
  it("accepts only same-origin booking links or bounded plain IDs", () => {
    const origin = "https://equipment.example";
    expect(qrBookingPath(origin + "/booking.html?id=eq-1", origin)).toBe(
      "/booking.html?id=eq-1",
    );
    expect(qrBookingPath("eq-1", origin)).toBe("/booking.html?id=eq-1");
    for (const bad of [
      "javascript:alert(1)//booking.html",
      "https://evil.example/booking.html?id=x",
      "//evil.example/booking.html?id=x",
      "data:text/html,booking.html",
    ])
      expect(qrBookingPath(bad, origin)).toBeNull();
  });
  it("preserves local calendar days", () => {
    expect(inputDate(parseInputDate("2026-12-31"))).toBe("2026-12-31");
  });
  it("reuses Thai date formatting across the Bangkok year boundary", () => {
    expect(dateLabel("2026-12-31T16:59:00Z")).toBe("31 ธ.ค. 2569");
    expect(dateLabel("2026-12-31T17:00:00Z")).toBe("1 ม.ค. 2570");
    expect(dateLabel({ toDate: () => new Date("2026-12-31T16:59:00Z") })).toBe(
      "31 ธ.ค. 2569",
    );
    expect(dateLabel("invalid")).toBe("ไม่ระบุวันที่");
  });
  it("rejects imported rows without required fields or with executable image URLs", () => {
    const rows = mapRows([
      { ชื่ออุปกรณ์: "บอล", รหัสอุปกรณ์: "BALL-1" },
      { title: "", assetCode: "x" },
      { title: "x", assetCode: "y", imageUrl: "javascript:alert(1)" },
    ]);
    expect(rows.map((r) => !!r.error)).toEqual([false, true, true]);
  });
  it("keeps unknown metadata out of equipment writes", () => {
    const row = mapRows([
      { title: "บอล", assetCode: "BALL-1", id: "spoof", status: "unavailable" },
    ])[0];
    expect(row.data).not.toHaveProperty("id");
    expect(row.data.status).toBe("available");
  });
  it("validates date order, terms and required borrower fields", () => {
    const input = {
      fullName: "นักศึกษาทดสอบ",
      studentId: "DEMO-1",
      faculty: "คณะทดสอบ",
      department: "สาขาทดสอบ",
      affiliation: "",
      applicantEmail: "test@example.invalid",
      applicantPhone: "",
      activityName: "กิจกรรม",
      reason: "ใช้งานกิจกรรม",
      startDate: "2099-01-02",
      endDate: "2099-01-01",
      terms: false,
    };
    const result = bookingSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((i) => i.path[0])).toEqual(
        expect.arrayContaining(["terms", "endDate"]),
      );
  });
});
