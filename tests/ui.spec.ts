import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as XLSX from "@e965/xlsx";
import QRCode from "qrcode";
import { fixtureState } from "../src/lib/fixtures";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("smo-line-notifications-v2-demo", "declined");
    } catch {}
  });
  await page.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:5174"
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
});
async function login(page: Page) {
  await page.goto("/admin.html");
  await page.getByLabel("อีเมลผู้ดูแล").fill("admin@example.invalid");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "จัดการคำขอและอุปกรณ์" }),
  ).toBeVisible();
}
for (const blocked of [false, true])
  test(`demo login rejects wrong credentials and supports storage ${blocked ? "blocked" : "available"}`, async ({
    page,
  }) => {
    if (blocked)
      await page.addInitScript(() => {
        Object.defineProperty(window, "sessionStorage", {
          get() {
            throw new DOMException("Storage blocked", "SecurityError");
          },
        });
      });
    await page.goto("/admin.html");
    await page.getByLabel("อีเมลผู้ดูแล").fill("admin@example.invalid");
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill("incorrect");
    await page
      .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("เข้าสู่ระบบไม่สำเร็จ");
    await page
      .getByRole("button", { name: "เข้าสู่ระบบทดลอง", exact: true })
      .click();
    const dashboard = page.getByRole("heading", {
      name: "จัดการคำขอและอุปกรณ์",
    });
    await expect(dashboard).toBeVisible();
    // Demo mutations must also work when browser storage is unavailable.
    await page.getByRole("tab", { name: "จัดการอุปกรณ์", exact: true }).click();
    await page
      .getByRole("button", { name: "รับคืน", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await page.reload();
    if (blocked) {
      await expect(
        page.getByRole("heading", { name: "เข้าสู่ระบบจัดการ" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "เข้าสู่ระบบทดลอง", exact: true })
        .click();
    }
    await expect(dashboard).toBeVisible();
    await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "เข้าสู่ระบบจัดการ" }),
    ).toBeVisible();
  });
test("booking, guarded approval, calendar and return stay functional", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5174") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/booking.html?id=eq-0");
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(page.getByText("กรุณากรอกชื่อ–นามสกุล")).toBeVisible();
  for (const [id, value] of Object.entries({
    fullName: "ผู้ยืมทดสอบ",
    studentId: "TEST-001",
    faculty: "คณะทดสอบ",
    department: "สาขาทดสอบ",
    applicantEmail: "student@example.invalid",
    activityName: "กิจกรรมทดสอบ UI",
    reason: "ใช้สำหรับทดสอบระบบ",
  }))
    await page.locator("#" + id).fill(value);
  const date = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  await page.locator("#startDate").fill(date);
  await page.locator("#endDate").fill(date);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ส่งคำขอยืมสำเร็จ" }),
  ).toBeVisible();
  await login(page);
  await page
    .getByRole("button", { name: "อนุมัติ", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "ชุดไมโครโฟนไร้สาย",
  );
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await page.goto("/calendar.html");
  await expect(
    page.getByRole("heading", { name: "มีการยืมอุปกรณ์" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "กิจกรรมทดสอบ UI" })).toHaveCount(0);
  await page.goto("/admin.html?tab=equipment");
  await page
    .getByRole("button", { name: "รับคืน", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  expect(external).toEqual([]);
});
test("calendar dates carry into booking and a reloaded draft keeps its request ID", async ({ page }) => {
  await page.goto("/calendar.html?equipmentId=eq-0&date=2099-01-01");
  await page.getByRole("link", { name: "ขอยืมอุปกรณ์นี้" }).click();
  await expect(page.locator("#startDate")).toHaveValue("2099-01-01");
  await expect(page.locator("#endDate")).toHaveValue("2099-01-01");
  await page.locator("#fullName").fill("ผู้ยืมร่างทดสอบ");
  await page.locator("#activityName").fill("กิจกรรมร่างทดสอบ");
  const readDraftId = () => page.evaluate(() => {
    const raw = sessionStorage.getItem("smo-booking-draft-v1-demo:eq-0");
    return raw ? JSON.parse(raw).requestId : null;
  });
  await expect.poll(readDraftId).toMatch(/^[0-9a-f-]{36}$/);
  const savedId = await readDraftId();
  expect(savedId).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByText("กลับมากรอกต่อจากร่าง")).toBeVisible();
  await expect(page.locator("#fullName")).toHaveValue("ผู้ยืมร่างทดสอบ");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("smo-booking-draft-v1-demo:eq-0") || "{}").requestId)).toBe(savedId);
  for (const [id,value] of Object.entries({studentId:"DRAFT-001",faculty:"คณะทดสอบ",department:"สาขาทดสอบ",applicantEmail:"student@example.invalid",reason:"ใช้ทดสอบฟอร์ม"})) await page.locator("#"+id).fill(value);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ส่งคำขอยืมสำเร็จ" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("smo-booking-draft-v1-demo:eq-0"))).toBeNull();
  const created = await page.evaluate(() => JSON.parse(sessionStorage.getItem("smo-demo-state") || "{}").bookings?.find((item: {fullName:string})=>item.fullName==="ผู้ยืมร่างทดสอบ"));
  expect(created?.requestId).toBe(savedId);
  await page.goto("/my-bookings.html");
  await expect(page.getByText("รายการตัวอย่างสำหรับทดลองใช้งาน")).toBeVisible();
  await expect(page.getByText(created.id, { exact: true })).toHaveCount(0);
});
test("search URL, filters, image fallback and mobile menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/equipment.html?search=บาส");
  await expect(
    page.getByRole("heading", { name: "ลูกบาสเกตบอล", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await page.getByRole("combobox", { name: "สถานะอุปกรณ์" }).click();
  await page.getByRole("option", { name: "พร้อมให้ยืม", exact: true }).click();
  expect(page.url()).toContain("status=available");
  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const closeSize = await page
    .getByRole("button", { name: "ปิด", exact: true })
    .boundingBox();
  expect(closeSize?.width).toBeGreaterThanOrEqual(44);
  expect(closeSize?.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "เปิดเมนู" })).toBeFocused();
});
for (const width of [320, 375, 768, 1024, 1440])
  test(`all pages fit and load the supplied font at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/equipment.html",
      "/booking.html?id=eq-0",
      "/calendar.html",
      "/success.html",
      "/my-bookings.html",
      "/admin.html",
    ]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() =>
          document.fonts.check('16px "Chulabhorn Likit Text"'),
        ),
      ).toBe(true);
      expect(
        await page
          .locator("h1")
          .evaluate((e) => getComputedStyle(e).fontWeight),
      ).toBe("400");
      expect(
        await page
          .locator("h1")
          .evaluate((e) => getComputedStyle(e).fontFamily),
      ).toContain("Chulabhorn Likit Text");
      expect(
        await page.evaluate(() =>
          Array.from(document.fonts).some(
            (f) =>
              f.family.includes("Chulabhorn Likit Text") &&
              f.status === "loaded",
          ),
        ),
      ).toBe(true);
    }
    if (width === 1440) {
      await login(page);
      await page.goto("/admin.html?tab=equipment");
      await page.screenshot({
        path: "test-results/admin-desktop.png",
        fullPage: true,
      });
    }
    await page.goto("/");
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  });
test("six surfaces pass accessibility checks", async ({ page }) => {
  for (const path of [
    "/",
    "/equipment.html",
    "/booking.html?id=eq-0",
    "/calendar.html",
    "/success.html",
    "/my-bookings.html",
    "/admin.html",
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  await expect(
    page.getByRole("heading", { name: "จัดการคำขอและอุปกรณ์" }),
  ).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
test("Excel XLSX and legacy XLS imports preview and save safely", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  for (const type of ["xlsx", "biff8"] as const) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([
        {
          ชื่ออุปกรณ์: "อุปกรณ์นำเข้า " + type,
          รหัสอุปกรณ์: "IMPORT-" + type,
          หมวดหมู่: "ครุภัณฑ์",
        },
      ]),
      "Equipment",
    );
    await page.getByLabel("ไฟล์นำเข้าอุปกรณ์").setInputFiles({
      name: "equipment." + (type === "xlsx" ? "xlsx" : "xls"),
      mimeType: "application/octet-stream",
      buffer: XLSX.write(book, { bookType: type, type: "buffer" }),
    });
    await expect(page.getByText("พร้อมนำเข้า 1 / 1 รายการ")).toBeVisible();
    await page
      .getByRole("button", { name: "ยืนยันนำเข้ารายการที่ผ่าน" })
      .click();
    await expect(
      page.getByRole("heading", { name: "อุปกรณ์นำเข้า " + type, exact: true }),
    ).toBeVisible();
  }
});
test("stored HTML-looking borrower content remains inert", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const state = {
      equipment: [
        {
          id: "safe-id",
          title: "อุปกรณ์",
          assetCode: "SAFE",
          category: "กีฬา",
          status: "available",
        },
      ],
      calendarEntries: [],
      bookings: [
        {
          id: 'quote-"-id',
          equipmentId: "safe-id",
          equipmentName: "อุปกรณ์",
          assetCode: "SAFE",
          fullName: '<img src=x onerror="window.compromised=1">',
          studentId: "X",
          faculty: "คณะ",
          activityName: "ทดสอบ",
          reason: "ทดสอบ",
          status: "pending",
          createdAt: { toDate: "not-callable" },
        },
      ],
    };
    sessionStorage.setItem("smo-demo-state", JSON.stringify(state));
    sessionStorage.setItem("smo-demo-admin", "1");
  });
  await page.goto("/admin.html");
  await expect(
    page
      .getByText('<img src=x onerror="window.compromised=1">', { exact: true })
      .first(),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, "compromised"))).toBe(
    false,
  );
  expect(await page.locator('img[src="x"]').count()).toBe(0);
});

test("equipment create/edit/delete and Word import stay functional", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  await page.getByRole("button", { name: "เพิ่มอุปกรณ์", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออุปกรณ์").fill("อุปกรณ์สร้างใหม่");
  await dialog.getByLabel("รหัสอุปกรณ์").fill("NEW-1");
  await dialog
    .getByRole("button", { name: "บันทึกอุปกรณ์", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const row = page
    .locator("div.rounded-lg")
    .filter({
      has: page.getByRole("heading", { name: "อุปกรณ์สร้างใหม่", exact: true }),
    })
    .last();
  await row.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("ชื่ออุปกรณ์")
    .fill("อุปกรณ์แก้ไขแล้ว");
  await page
    .getByRole("button", { name: "บันทึกอุปกรณ์", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "อุปกรณ์แก้ไขแล้ว", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "ลบ อุปกรณ์แก้ไขแล้ว", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "ยืนยัน", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "อุปกรณ์แก้ไขแล้ว", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("ไฟล์นำเข้าอุปกรณ์")
    .setInputFiles("tests/fixtures/equipment.docx");
  await expect(page.getByText("พร้อมนำเข้า 1 / 1 รายการ")).toBeVisible();
  await page.getByRole("button", { name: "ยืนยันนำเข้ารายการที่ผ่าน" }).click();
  await expect(
    page.getByRole("heading", { name: "อุปกรณ์จาก Word", exact: true }),
  ).toBeVisible();
});
test("JPEG equipment upload is converted to the PNG contract in the browser", async ({ page }) => {
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  await page.getByRole("button", { name: "เพิ่มอุปกรณ์", exact: true }).click();
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2; canvas.height = 2;
    canvas.getContext("2d")!.fillRect(0,0,2,2);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  });
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({name:"fixture.jpg",mimeType:"image/jpeg",buffer:Buffer.from(jpeg,"base64")});
  const preview = page.getByRole("img", { name: "ตัวอย่างรูปอุปกรณ์" });
  await expect(preview).toHaveAttribute("src", /^blob:/);
  expect(await preview.evaluate(async image => (await (await fetch((image as HTMLImageElement).src)).blob()).type)).toBe("image/png");
});

test("QR download and image scanning use safe local booking links", async ({
  page,
}) => {
  const qrRequests: string[] = [];
  page.on("request", (r) => {
    if (/\/(qrcode|jsqr)\.js\b/i.test(new URL(r.url()).pathname))
      qrRequests.push(r.url());
  });
  await page.goto("/equipment.html");
  await expect(
    page.getByRole("heading", { name: "เลือกอุปกรณ์สำหรับกิจกรรม" }),
  ).toBeVisible();
  expect(qrRequests).toEqual([]);
  await page
    .getByRole("button", { name: "QR ของ ชุดไมโครโฟนไร้สาย", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("img")).toBeVisible();
  expect(qrRequests.some((url) => /\/qrcode\.js\b/i.test(url))).toBe(true);
  expect(qrRequests.some((url) => /\/jsqr\.js\b/i.test(url))).toBe(false);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "บันทึก", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("QR-SMO-001.png");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "สแกน QR", exact: true }).click();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "qr.png",
      mimeType: "image/png",
      buffer: await QRCode.toBuffer(
        "http://127.0.0.1:5174/booking.html?id=eq-0",
      ),
    });
  await expect(page).toHaveURL(/booking.html\?id=eq-0/);
  expect(qrRequests.some((url) => /\/jsqr\.js\b/i.test(url))).toBe(true);
  await expect(
    page.getByRole("heading", { name: "ชุดไมโครโฟนไร้สาย", exact: true }),
  ).toBeVisible();
});

test("request pagination keeps canonical equipment and missing-item guards on both layouts", async ({
  page,
}) => {
  const state = fixtureState();
  state.bookings = Array.from({ length: 11 }, (_, i) => ({
    ...state.bookings[0],
    id: `pending-${i}`,
    equipmentId: i === 10 ? "missing-equipment" : "eq-0",
    equipmentName: "ชื่อจากคำขอที่ต้องไม่ใช้แทนข้อมูลอุปกรณ์",
    fullName: `ผู้ยืมลำดับ ${i + 1}`,
    status: "pending",
    createdAt: new Date(2026, 0, 11 - i).toISOString(),
  }));
  await page.addInitScript((data) => {
    sessionStorage.setItem("smo-demo-state", JSON.stringify(data));
    sessionStorage.setItem("smo-demo-admin", "1");
  }, state);
  await page.goto("/admin.html");
  for (const width of [1024, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText("หน้า 1 · 10 รายการในชุดนี้")).toBeVisible();
    await page
      .getByRole("button", { name: "อนุมัติ", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByRole("alertdialog")).toContainText(
      "ชุดไมโครโฟนไร้สาย · SMO-001",
    );
    await page.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await page.getByRole("button", { name: "หน้าถัดไป" }).click();
    await expect(page.getByText("หน้า 2 · 1 รายการในชุดนี้")).toBeVisible();
    await expect(
      page
        .getByText("ผู้ยืมลำดับ 11", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: "อนุมัติ", exact: true })
        .filter({ visible: true }),
    ).toBeDisabled();
    await expect(
      page
        .getByRole("button", { name: "ไม่อนุมัติ", exact: true })
        .filter({ visible: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "หน้าก่อนหน้า" }).click();
  }
});
test("an admin can approve an item outside the first equipment page", async ({ page }) => {
  const state = fixtureState();
  state.equipment = Array.from({length:27},(_,index)=>({
    ...state.equipment[0], id:`item-${index}`, title:`อุปกรณ์ลำดับ ${index}`,assetCode:`CODE-${index}`,status:"available" as const,
  }));
  state.bookings = [{ ...state.bookings[0], id:"off-page-booking", equipmentId:"item-26", equipmentName:"ชื่อที่ผู้ขอยืมระบุ", assetCode:"FORGED", status:"pending", createdAt:new Date().toISOString() }];
  await page.addInitScript(data=>{sessionStorage.setItem("smo-demo-state",JSON.stringify(data));sessionStorage.setItem("smo-demo-admin","1");},state);
  await page.goto("/admin.html");
  const approve = page.getByRole("button", { name:"อนุมัติ", exact:true }).filter({visible:true}).first();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByRole("alertdialog")).toContainText("อุปกรณ์ลำดับ 26 · CODE-26");
});

test("QR module download failure is reported without navigating away", async ({
  page,
}) => {
  await page.route(/\/qrcode\.js\b/, (route) => route.abort("failed"));
  await page.goto("/equipment.html");
  await page
    .getByRole("button", { name: "QR ของ ชุดไมโครโฟนไร้สาย", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("สร้าง QR ไม่สำเร็จ");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/equipment\.html$/);
});

test("closing the scanner releases camera permission that resolves late", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () =>
        new Promise((resolve) => {
          Object.assign(window, {
            releaseCamera: () =>
              resolve({
                getTracks: () => [
                  {
                    stop: () => Object.assign(window, { cameraStopped: true }),
                  },
                ],
              }),
          });
        }),
    });
  });
  await page.goto("/equipment.html");
  await page.getByRole("button", { name: "สแกน QR", exact: true }).click();
  await page.getByRole("button", { name: "เปิดกล้อง", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => typeof Reflect.get(window, "releaseCamera")),
    )
    .toBe("function");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.evaluate(() => Reflect.get(window, "releaseCamera")());
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "cameraStopped")))
    .toBe(true);
});

test("rejection is confirmed and UI reflows at doubled text scale", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const raw = sessionStorage.getItem("smo-demo-state");
    const state = raw ? JSON.parse(raw) : null;
    if (state) {
      state.bookings[0].status = "pending";
      sessionStorage.setItem("smo-demo-state", JSON.stringify(state));
    }
  });
  // Create a dummy pending request through the actual form in this context.
  await page.goto("/booking.html?id=eq-0");
  for (const [id, value] of Object.entries({
    fullName: "ผู้ยืมตรวจเหตุผล",
    studentId: "REJECT-1",
    faculty: "คณะ",
    department: "สาขา",
    applicantEmail: "test@example.invalid",
    activityName: "กิจกรรมตรวจเหตุผล",
    reason: "ตรวจการปฏิเสธ",
    startDate: "2099-01-01",
    endDate: "2099-01-02",
  }))
    await page.locator("#" + id).fill(value);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ส่งคำขอยืมสำเร็จ" }),
  ).toBeVisible();
  await login(page);
  await page
    .getByRole("button", { name: "ไม่อนุมัติ", exact: true })
    .first()
    .click();
  await page.getByLabel("เหตุผล / หมายเหตุ").fill("วันใช้งานไม่เหมาะสม");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "ยืนยัน", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await page.goto("/equipment.html");
  await page.setViewportSize({ width: 640, height: 900 });
  await page.addStyleTag({ content: "html{font-size:200% !important}" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("notification settings validate URL and demo test never sends mail", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin.html?tab=settings");
  await expect(page.getByRole("region", { name: "สถานะการเชื่อมต่ออีเมล" })).toContainText("โหมดตัวอย่าง — ไม่ส่งอีเมลจริง");
  await expect(page.getByText("เมื่อมีคำขอยืมใหม่", { exact: false })).toBeVisible();
  await page
    .getByLabel("URL ของ Google Apps Script")
    .fill("javascript:alert(1)");
  await page
    .getByRole("button", { name: "บันทึกการตั้งค่า", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("กรุณาใช้ URL");
  await page
    .getByLabel("URL ของ Google Apps Script")
    .fill("https://script.google.com/macros/s/DUMMY-NOT-REAL/exec");
  await page
    .getByRole("button", { name: "บันทึกการตั้งค่า", exact: true })
    .click();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("script.google.com")) requests.push(r.url());
  });
  await page
    .getByRole("button", { name: "ส่งอีเมลทดสอบ", exact: true })
    .click();
  await expect(
    page.getByText("บันทึกการทดสอบแล้ว ยังไม่ได้ส่งอีเมลจริง", { exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});

test("unavailable equipment prevents wasted entry and clean aliases keep navigation active", async ({
  page,
}) => {
  await page.goto("/booking?id=eq-1");
  await expect(page.locator("#booking-unavailable")).toBeVisible();
  await expect(page.getByLabel("ชื่อ–นามสกุล")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "ส่งคำขอยืม", exact: true }),
  ).toHaveCount(0);
  await page.goto("/calendar");
  await expect(
    page
      .getByRole("navigation", { name: "เมนูหลัก" })
      .getByRole("link", { name: "ปฏิทิน", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("image preparation blocks duplicate editor actions and recovers without losing URL", async ({ page }) => {
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  await page.getByRole("button", { name: "เพิ่มอุปกรณ์", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("URL รูปภาพ").fill("https://example.invalid/original.png");
  await page.evaluate(() => {
    const original = window.createImageBitmap;
    Object.assign(window, { restoreBitmap: () => { window.createImageBitmap = original; } });
    window.createImageBitmap = (() => new Promise((_, reject) => {
      Reflect.set(window, "decodeCalls", (Reflect.get(window, "decodeCalls") || 0) + 1);
      Object.assign(window, { failBitmap: () => reject(Error("fixture decode failed")) });
    })) as typeof createImageBitmap;
  });
  const input = dialog.locator('input[type="file"]');
  await input.setInputFiles({name:"broken.png",mimeType:"image/png",buffer:Buffer.from("broken")});
  await expect(dialog.getByRole("status")).toContainText("กำลังเตรียมภาพ");
  await expect(input).toBeDisabled();
  await input.evaluate(element => {
    const transfer = new DataTransfer(); transfer.items.add(new File(["duplicate"],"duplicate.png",{type:"image/png"}));
    (element as HTMLInputElement).files=transfer.files;
    element.dispatchEvent(new Event("change",{bubbles:true}));
  });
  expect(await page.evaluate(() => Reflect.get(window,"decodeCalls"))).toBe(1);
  await dialog.getByRole("status").scrollIntoViewIfNeeded();
  if (process.env.SCREENSHOT_EVIDENCE) console.log("SCREENSHOT_DESKTOP_BUSY=" + (await page.screenshot()).toString("base64"));
  await page.setViewportSize({ width: 375, height: 900 });
  await dialog.getByRole("status").scrollIntoViewIfNeeded();
  if (process.env.SCREENSHOT_EVIDENCE) console.log("SCREENSHOT_MOBILE_BUSY=" + (await page.screenshot()).toString("base64"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dialog.getByRole("button",{name:"บันทึกอุปกรณ์",exact:true})).toBeDisabled();
  await expect(dialog.getByLabel("URL รูปภาพ")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.evaluate(() => Reflect.get(window,"failBitmap")());
  await expect(dialog.getByRole("alert")).toContainText("เปิดไฟล์ภาพไม่ได้ กรุณาเลือกภาพใหม่");
  await expect(dialog.getByLabel("URL รูปภาพ")).toHaveValue("https://example.invalid/original.png");
  await expect(input).toBeEnabled();
  await dialog.getByRole("alert").scrollIntoViewIfNeeded();
  if (process.env.SCREENSHOT_EVIDENCE) console.log("SCREENSHOT_MOBILE_ERROR=" + (await page.screenshot()).toString("base64"));
  expect(await input.inputValue()).toBe("");
  await page.evaluate(() => Reflect.get(window,"restoreBitmap")());
  const png = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width=7;canvas.height=5;return canvas.toDataURL().split(",")[1]; });
  await input.setInputFiles({name:"small.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await expect(dialog.getByRole("img",{name:"ตัวอย่างรูปอุปกรณ์"})).toHaveAttribute("src",/^blob:/);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("saved demo image remains fetchable after editor close and reopen", async ({ page }) => {
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  await page.getByRole("button",{name:"เพิ่มอุปกรณ์",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("ชื่ออุปกรณ์").fill("ภาพที่บันทึกไว้");
  await dialog.getByLabel("รหัสอุปกรณ์").fill("SAVED-IMAGE");
  const png=await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=7;canvas.height=5;return canvas.toDataURL().split(",")[1];});
  await dialog.locator('input[type="file"]').setInputFiles({name:"saved.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  const preview=dialog.getByRole("img",{name:"ตัวอย่างรูปอุปกรณ์"});
  await expect(preview).toHaveAttribute("src",/^blob:/);
  const url=await preview.getAttribute("src");
  await dialog.getByRole("button",{name:"บันทึกอุปกรณ์",exact:true}).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(async url=>{try{return (await fetch(url!)).ok;}catch{return false;}},url)).toBe(true);
  const row=page.locator("div.rounded-lg").filter({has:page.getByRole("heading",{name:"ภาพที่บันทึกไว้",exact:true})}).last();
  await row.getByRole("button",{name:"แก้ไข",exact:true}).click();
  await expect(dialog.getByLabel("URL รูปภาพ")).toHaveValue(url!);
  await expect(dialog.getByRole("img",{name:"ตัวอย่างรูปอุปกรณ์"})).toHaveJSProperty("naturalWidth",7);
});

test("preparation finishing after route unmount creates no object URL or upload request", async ({ page }) => {
  await login(page);
  await page.goto("/admin.html?tab=equipment");
  await page.getByRole("button",{name:"เพิ่มอุปกรณ์",exact:true}).click();
  const png=await page.evaluate(()=>{
    const canvas=document.createElement("canvas");canvas.width=7;canvas.height=5;
    const original=window.createImageBitmap;
    const createURL=URL.createObjectURL;
    Reflect.set(window,"lateURLs",0);
    URL.createObjectURL=(blob)=>{Reflect.set(window,"lateURLs",Reflect.get(window,"lateURLs")+1);return createURL(blob);};
    window.createImageBitmap=((file:Blob)=>new Promise(resolve=>{
      Reflect.set(window,"finishPreparation",async()=>{
        const bitmap=await original(file);
        const close=bitmap.close.bind(bitmap);
        bitmap.close=()=>{close();Reflect.set(window,"lateBitmapClosed",true);};
        resolve(bitmap);
      });
    })) as typeof createImageBitmap;
    return canvas.toDataURL().split(",")[1];
  });
  const uploads:string[]=[];
  page.on("request",request=>{if(request.url().includes("/api/upload-image"))uploads.push(request.url());});
  await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({name:"pending.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("กำลังเตรียมภาพ");
  await page.evaluate(()=>{history.pushState({},"","/equipment.html");dispatchEvent(new PopStateEvent("popstate"));});
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/equipment\.html$/);
  await expect(page.getByRole("heading",{level:1})).toBeVisible();
  await page.evaluate(()=>Reflect.get(window,"finishPreparation")());
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"lateBitmapClosed"))).toBe(true);
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await page.evaluate(()=>Reflect.get(window,"lateURLs"))).toBe(0);
  expect(uploads).toEqual([]);
});
