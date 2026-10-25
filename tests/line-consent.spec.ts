import { test, expect, type Page } from "@playwright/test";

const fixture = "/tests/fixtures/line-consent.html";
// The Vite test server uses the demo storage namespace. Only the provider's
// connection branch is made live, with all identity responses mocked locally.
const key = "smo-line-notifications-v2-demo";
const account = {
  idToken: "fixture-only-token",
  displayName: "ผู้ทดสอบ",
  friend: true,
};
const title = "รับแจ้งเตือนจาก SMO OA ผ่าน LINE";
async function mockConnection(
  page: Page,
  reply: () => Promise<Response> | Response,
) {
  await page.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:5174"
      ? route.continue()
      : route.abort(),
  );
  await page.route(/\/src\/lib\/data\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const demo = false;",
    }),
  );
  await page.route(/\/src\/lib\/line\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
      export const lineEnabled = true;
      export const lineFriendUrl = () => "https://line.me/R/ti/p/@474ezowf";
      export async function lineSession(login = false) {
        const response = await fetch("/__fixture/line-session?login=" + login);
        if (!response.ok) throw Error("FIXTURE_FAILURE");
        return response.json();
      }
    `,
    }),
  );
  await page.route("**/__fixture/line-session?*", async (route) => {
    const response = await reply();
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: await response.text(),
    });
  });
}

test("an unfinished login is confirmed after the redirect before consent becomes persistent", async ({
  page,
}) => {
  let completed = false;
  await mockConnection(page, () => Response.json(completed ? account : null));
  await page.goto(fixture);
  await page
    .getByRole("button", { name: "ยินยอมและเชื่อมต่อ LINE", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), key))
    .toBe("pending");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  await expect(page.getByTestId("consent")).toHaveText("unlinked");
  completed = true;
  // Simulate returning from the official login redirect with the session restored.
  await page.reload();
  await expect(page.getByTestId("consent")).toHaveText("linked");
  await expect(page.getByRole("dialog", { name: title })).not.toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    "accepted",
  );
  expect(
    await page.evaluate(() => JSON.stringify([localStorage, sessionStorage])),
  ).not.toContain(account.idToken);
});

test("connection errors and a missing OA friendship are not recorded as a successful connection", async ({
  page,
}) => {
  let result = new Response(null, { status: 503 });
  await mockConnection(page, () => result.clone());
  await page.goto(fixture);
  const accept = page.getByRole("button", {
    name: "ยินยอมและเชื่อมต่อ LINE",
    exact: true,
  });
  await accept.click();
  await expect(page.getByRole("alert")).toContainText(
    "เชื่อมต่อ LINE ไม่สำเร็จ",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  result = Response.json({ ...account, friend: false });
  await accept.click();
  await expect(
    page.getByText("เชื่อมกับ ผู้ทดสอบ แล้ว", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("consent")).toHaveText("unlinked");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
  result = Response.json(account);
  await page
    .getByRole("button", {
      name: "เพิ่มเพื่อนแล้ว ตรวจสอบอีกครั้ง",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog", { name: title })).not.toBeVisible();
  await expect(page.getByTestId("consent")).toHaveText("linked");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    "accepted",
  );
});

test("returning users are not prompted again or silently opted out when LINE is unavailable", async ({
  page,
}) => {
  let connectionChecks = 0;
  await mockConnection(page, () => {
    connectionChecks++;
    return new Response(null, { status: 503 });
  });
  await page.addInitScript((key) => localStorage.setItem(key, "accepted"), key);
  await page.goto(fixture);
  await expect(page.getByTestId("ready")).toHaveText("true");
  await expect(page.getByTestId("consent")).toHaveText("linked");
  await expect(page.getByRole("dialog", { name: title })).not.toBeVisible();
  expect(connectionChecks).toBe(0);
  // Booking's fresh identity check still must succeed (covered in line.test.ts).
});

test("dismissing during a slow connection does not allow its late response to save consent", async ({
  page,
}) => {
  let finish!: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  await mockConnection(page, () => response);
  await page.goto(fixture);
  const request = page.waitForRequest("**/__fixture/line-session?login=true");
  await page
    .getByRole("button", { name: "ยินยอมและเชื่อมต่อ LINE", exact: true })
    .click();
  await request;
  await page.getByRole("button", { name: "ไว้ภายหลัง", exact: true }).click();
  const returned = page.waitForResponse("**/__fixture/line-session?login=true");
  finish(Response.json(account));
  await returned;
  await expect(page.getByRole("dialog", { name: title })).not.toBeVisible();
  await expect(page.getByTestId("consent")).toHaveText("unlinked");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(
    "declined",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).toBeNull();
});
