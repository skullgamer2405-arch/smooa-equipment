import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:5174"
      ? route.continue()
      : route.abort(),
  );
});
const title = "รับแจ้งเตือนจาก SMO OA ผ่าน LINE";
const accept = "ทดลองอนุญาต (ข้อมูลจำลอง)";
for (const width of [320, 375, 1440])
  test(`LINE permission opens on entry and remains usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("นี่คือตัวอย่างหน้าขออนุญาต", { exact: false }),
    ).toBeVisible();
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    const button = dialog.getByRole("button", { name: accept });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    if (width === 375) {
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: "test-results/line-permission-mobile.png",
        fullPage: true,
      });
    }
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("#line-connection-toggle")).toBeFocused();
    await page.goto("/equipment.html");
    await expect(dialog).not.toBeVisible();
    await page.locator("#line-connection-toggle").click();
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "ไว้ภายหลัง", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  });

test("entry consent carries into booking, can be changed and never calls real LINE in demo", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (
      new URL(r.url()).pathname.startsWith("/api/") ||
      /line\.me|line-scdn\.net/.test(r.url())
    )
      calls.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: accept, exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/booking.html?id=eq-0");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(new URL(page.url()).searchParams.get("id")).toBe("eq-0");
  const permission = page.getByRole("checkbox", { name: /ยินยอมรับผลอนุมัติ/ });
  await expect(permission).toBeChecked();
  await permission.uncheck();
  await expect(permission).not.toBeChecked();
  await permission.check();
  for (const [id, value] of Object.entries({
    fullName: "ผู้ยืมทดสอบ",
    studentId: "TEST-001",
    faculty: "คณะทดสอบ",
    department: "สาขาทดสอบ",
    applicantEmail: "student@example.invalid",
    activityName: "กิจกรรมทดสอบ",
    reason: "ใช้ทดสอบ",
  }))
    await page.locator("#" + id).fill(value);
  const day = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.locator("#startDate").fill(day);
  await page.locator("#endDate").fill(day);
  await page
    .getByRole("checkbox", { name: "ฉันจะดูแลอุปกรณ์และส่งคืนตามวันที่กำหนด" })
    .check();
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ส่งคำขอยืมสำเร็จ" }),
  ).toBeVisible();
  await expect(
    page.getByText("ผูกคำขอนี้กับ LINE แล้ว", { exact: false }),
  ).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("a direct booking/QR entry requests permission without changing the equipment or query", async ({
  page,
}) => {
  await page.goto("/booking.html?id=eq-0&from=qr");
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
  await page.getByRole("button", { name: accept, exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "รับแจ้งเตือนผ่าน LINE", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(page.url()).toContain("id=eq-0&from=qr");
  await expect(
    page.getByRole("checkbox", { name: /ยินยอมรับผลอนุมัติ/ }),
  ).toBeChecked();
});

test("blocked browser storage still allows consent and navigation; admin entry is exempt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/admin.html");
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบจัดการ" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: accept, exact: true }).click();
  await page
    .getByRole("navigation", { name: "เมนูหลัก", exact: true })
    .getByRole("link", { name: "อุปกรณ์", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("#line-connection-toggle")).toContainText(
    "ตัวอย่าง: เปิดรับแจ้งเตือน LINE",
  );
});
