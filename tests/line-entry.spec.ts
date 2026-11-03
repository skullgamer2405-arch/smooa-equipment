import { test, expect, type Page } from "@playwright/test";
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
const preferenceKey = "smo-line-notifications-v2-demo";
async function noConnectionControls(page: Page) {
  await expect(page.locator("#line-connection-toggle")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /เชื่อม.*LINE/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "รับแจ้งเตือนผ่าน LINE" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: /ยินยอมรับผลอนุมัติ/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "เพิ่มเพื่อน SMO OA" }),
  ).toHaveCount(0);
}
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
    await expect(
      dialog.getByRole("link", { name: "เพิ่มเพื่อน SMO OA", exact: true }),
    ).toHaveAttribute("href", "https://line.me/R/ti/p/@474ezowf");
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
    await expect(page.locator("#main")).toBeFocused();
    await page.goto("/equipment.html");
    await expect(dialog).not.toBeVisible();
    await noConnectionControls(page);
    await page.goto("/booking.html?id=eq-0");
    await expect(page.locator("#fullName")).toBeVisible();
    await expect(dialog).not.toBeVisible();
    await noConnectionControls(page);
  });

test("entry consent carries into booking without extra controls or real LINE requests in demo", async ({
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
  await noConnectionControls(page);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe("accepted");
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
  const day = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
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
  await expect(page.locator("#fullName")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(page.url()).toContain("id=eq-0&from=qr");
  await noConnectionControls(page);
});

test("blocked browser storage still allows consent and navigation; admin entry is exempt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const name of ["sessionStorage", "localStorage"])
      Object.defineProperty(window, name, {
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
  await noConnectionControls(page);
});

test("completed consent survives closing the browser and reopening the Rich Menu URL", async ({
  page,
  browser,
}) => {
  await page.goto("/equipment.html");
  await page.getByRole("button", { name: accept, exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  // storageState preserves localStorage, but deliberately excludes sessionStorage.
  const state = await page.context().storageState();
  await page.close();
  const reopened = await browser.newContext({ storageState: state });
  try {
    await reopened.route(/^https?:\/\//, (route) =>
      new URL(route.request().url()).origin === "http://127.0.0.1:5174"
        ? route.continue()
        : route.abort(),
    );
    const next = await reopened.newPage();
    for (const path of [
      "/",
      "/equipment.html",
      "/booking.html?id=eq-0",
      "/calendar.html",
      "/success.html",
      "/admin.html",
    ]) {
      await next.goto(`http://127.0.0.1:5174${path}`);
      await expect(next.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await next.evaluate(
          (key) => sessionStorage.getItem(key),
          preferenceKey,
        ),
      ).toBeNull();
      await expect(next.getByRole("dialog", { name: title })).not.toBeVisible();
      await noConnectionControls(next);
    }
  } finally {
    await reopened.close();
  }
});

test("dismissing the first prompt does not nag during navigation and can be tried next session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ไว้ภายหลัง", exact: true }).click();
  await page.goto("/calendar.html");
  await expect(page.getByRole("dialog", { name: title })).not.toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBeNull();
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole("dialog", { name: title })).toBeVisible();
});

test("the previous session preference migrates without another demo permission dialog", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("smo-line-notifications-v1-demo", "accepted"),
  );
  await page.goto("/booking.html?id=eq-0");
  await expect(page.locator("#fullName")).toBeVisible();
  await expect(page.getByRole("dialog", { name: title })).not.toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe("accepted");
  await noConnectionControls(page);
});
