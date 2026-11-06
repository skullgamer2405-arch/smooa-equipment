import { test, expect, type Page } from "@playwright/test";
import { fixtureState } from "../src/lib/fixtures";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("smo-line-notifications-v2-demo", "declined"));
  await page.route(/^https?:\/\//, route => new URL(route.request().url()).origin === "http://127.0.0.1:5174" ? route.continue() : route.abort("blockedbyclient"));
});
async function borrow(page: Page, id: string, quantity: number, name: string) {
  await page.goto("/booking.html?id=" + id);
  await page.getByLabel("จำนวนที่ขอยืม", { exact: true }).fill(String(quantity));
  for (const [key, value] of Object.entries({ fullName: name, studentId: "TEST", faculty: "คณะ", department: "สาขา", applicantEmail: "test@example.invalid", activityName: "กิจกรรมทดสอบจำนวน", reason: "ทดสอบ", startDate: "2035-06-10", endDate: "2035-06-11" })) await page.locator("#" + key).fill(value);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ส่งคำขอยืมสำเร็จ" })).toBeVisible();
  await expect(page.getByText(`จำนวน ${quantity} ชิ้น`, { exact: true })).toBeVisible();
}
async function approve(page: Page) {
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "อนุมัติ", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
}

test("quantities flow from admin creation through two loans, sold-out hiding, and one return", async ({ page }) => {
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "เข้าสู่ระบบทดลอง", exact: true }).click();
  await page.getByRole("tab", { name: "จัดการอุปกรณ์", exact: true }).click();
  await page.getByRole("button", { name: "เพิ่มอุปกรณ์", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออุปกรณ์").fill("เก้าอี้สำหรับทดสอบจำนวน");
  await dialog.getByLabel("รหัสอุปกรณ์").fill("QTY-TEST");
  await expect(dialog.getByRole("button", { name: "ลดจำนวนทั้งหมด" })).toBeDisabled();
  for (let i = 0; i < 4; i++) await dialog.getByRole("button", { name: "เพิ่มจำนวนทั้งหมด" }).click();
  await expect(dialog.getByLabel("จำนวนทั้งหมด", { exact: true })).toHaveValue("5");
  await dialog.getByRole("button", { name: "บันทึกอุปกรณ์" }).click();
  await expect(dialog).not.toBeVisible();
  const id = await page.evaluate(() => JSON.parse(sessionStorage.getItem("smo-demo-state")!).equipment.find((item: { assetCode: string }) => item.assetCode === "QTY-TEST").id);
  await borrow(page, id, 3, "ผู้ยืมชุดแรก");
  await approve(page);
  await page.goto("/equipment.html?search=QTY-TEST");
  await expect(page.getByText("เหลือ 2 จาก 5 ชิ้น", { exact: true })).toBeVisible();
  await borrow(page, id, 2, "ผู้ยืมชุดสอง");
  await approve(page);
  await page.goto("/equipment.html?search=QTY-TEST");
  await expect(page.getByRole("heading", { name: "เก้าอี้สำหรับทดสอบจำนวน" })).toHaveCount(0);
  await page.goto("/admin.html?filter=approved");
  const row = page.getByRole("row").filter({ hasText: "ผู้ยืมชุดแรก" });
  await row.getByRole("button", { name: "รับคืน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("3 ชิ้น");
  await page.getByLabel("จำนวนที่รับคืนครั้งนี้", { exact: true }).fill("1");
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(row).toContainText("คืนแล้ว 1 ชิ้น · ค้างคืน 2 ชิ้น");
  await page.goto("/equipment.html?search=QTY-TEST");
  await expect(page.getByText("เหลือ 1 จาก 5 ชิ้น", { exact: true })).toBeVisible();
  await page.goto("/admin.html?filter=approved");
  await page.getByRole("row").filter({ hasText: "ผู้ยืมชุดแรก" }).getByRole("button", { name: "รับคืน", exact: true }).click();
  await expect(page.getByLabel("จำนวนที่รับคืนครั้งนี้", { exact: true })).toHaveValue("2");
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await page.goto("/equipment.html?search=QTY-TEST");
  await expect(page.getByText("เหลือ 3 จาก 5 ชิ้น", { exact: true })).toBeVisible();
});

test("borrower sees partial return counts and final returned status", async ({ page }) => {
  const state = fixtureState();
  Object.assign(state.equipment[1], { quantity: 5, borrowedQuantity: 3, status: "available" });
  Object.assign(state.bookings[0], { quantity: 5, returnedQuantity: 2 });
  await page.addInitScript(value => { if (!sessionStorage.getItem("smo-demo-state")) sessionStorage.setItem("smo-demo-state", JSON.stringify(value)); }, state);
  await page.goto("/my-bookings.html");
  await expect(page.getByText("คืนแล้ว 2 ชิ้น · ค้างคืน 3 ชิ้น", { exact: true })).toBeVisible();
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "เข้าสู่ระบบทดลอง", exact: true }).click();
  await page.goto("/admin.html?filter=approved");
  await page.getByRole("button", { name: "รับคืน", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await page.goto("/my-bookings.html");
  await expect(page.locator(".status-returned")).toBeVisible();
  await expect(page.getByText("คืนแล้ว 5 ชิ้น · ค้างคืน 0 ชิ้น", { exact: true })).toBeVisible();
});

test("mobile quantity controls have keyboard access, touch targets and stock limits", async ({ page }) => {
  const state = fixtureState();
  Object.assign(state.equipment[0], { quantity: 3, borrowedQuantity: 0 });
  await page.addInitScript(value => sessionStorage.setItem("smo-demo-state", JSON.stringify(value)), state);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/booking.html?id=eq-0");
  const minus = page.getByRole("button", { name: "ลดจำนวนที่ขอยืม" });
  const plus = page.getByRole("button", { name: "เพิ่มจำนวนที่ขอยืม" });
  const input = page.getByLabel("จำนวนที่ขอยืม", { exact: true });
  await expect(minus).toBeDisabled();
  await plus.focus(); await page.keyboard.press("Enter");
  await expect(input).toHaveValue("2");
  await plus.click(); await expect(plus).toBeDisabled();
  await minus.click(); await expect(input).toHaveValue("2");
  for (const button of [minus, plus]) { const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44); }
  await input.fill("4");
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(page.locator("#quantity-error")).toContainText("เหลือ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
