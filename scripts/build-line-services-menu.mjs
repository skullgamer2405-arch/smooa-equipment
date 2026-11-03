// Three-service LINE menu. Rebuild offline with the project's supplied font.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const font = await readFile(new URL("static/fonts/chulabhornlikittext-regular.woff2", root));
const navy = "#112c44";
const ivory = "#f3efe5";
const gold = "#d7ba7e";
const symbols = [
  '<rect x="42" y="64" width="156" height="148" rx="16"/><path d="M86 64V42a14 14 0 0 1 14-14h40a14 14 0 0 1 14 14v22M88 113h64l-18-18m18 18-18 18M152 164H88l18-18m-18 18 18 18"/>',
  '<path d="M48 120h144"/><circle cx="32" cy="120" r="28" fill="var(--surface)"/><circle cx="120" cy="120" r="28" fill="var(--surface)"/><circle cx="208" cy="120" r="28" fill="var(--surface)"/><circle cx="32" cy="120" r="5" fill="currentColor" stroke="none"/><circle cx="120" cy="120" r="5" fill="currentColor" stroke="none"/><path d="m195 120 9 9 18-20"/>',
  '<path d="M58 40h124a24 24 0 0 1 24 24v108a24 24 0 0 1-24 24H98l-40 30v-30a24 24 0 0 1-24-24V64a24 24 0 0 1 24-24Z"/><path d="M74 90h92M74 124h92M74 158h54"/>',
];
const labels = [
  ["ยืม–คืน", "อุปกรณ์"],
  ["ติดตาม", "โครงการ"],
  ["Voice Box", "ส่งความคิดเห็น"],
];
const html = `<!doctype html><html lang="th"><meta charset="utf-8"><title>SMO OA — เมนูบริการ</title>
<style>
@font-face{font-family:Chulabhorn;src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:400;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:2500px;height:843px}
body{font-family:Chulabhorn,sans-serif;font-synthesis:none;font-weight:400}
main{display:grid;grid-template-columns:833px 833px 834px;height:843px}
section{--surface:${navy};background:var(--surface);color:${ivory};display:flex;align-items:center;flex-direction:column;padding:72px 36px 64px}
section:nth-child(2){--surface:${ivory};color:${navy}}
section:nth-child(3){--surface:${gold};color:${navy}}
.symbol{height:310px;display:flex;align-items:center;justify-content:center}
svg{width:300px;height:300px;overflow:visible}
.tracking svg{width:410px;height:310px}
h1{font-size:132px;line-height:1.32;font-weight:400;text-align:center;margin:38px 0 0;white-space:nowrap}
h1 span{display:block}.voice h1{font-size:132px}.voice h1 span:last-child{font-size:112px;line-height:1.56}
</style><main>${labels.map((lines, index) => `<section class="${["equipment", "tracking", "voice"][index]}"><div class="symbol"><svg aria-hidden="true" viewBox="0 0 240 240" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${symbols[index]}</svg></div><h1><span>${lines[0]}</span><span>${lines[1]}</span></h1></section>`).join("")}</main></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 2500, height: 843 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const layout = await page.evaluate(() => ({
    fontLoaded: document.fonts.check('132px Chulabhorn', 'ยืม–คืน อุปกรณ์ ติดตาม โครงการ Voice Box ส่งความคิดเห็น'),
    panels: [...document.querySelectorAll('section')].map((panel) => {
      const bounds = panel.getBoundingClientRect();
      const heading = panel.querySelector('h1');
      const text = heading.getBoundingClientRect();
      return { x: bounds.x, width: bounds.width, height: bounds.height,
        fits: text.left >= bounds.left && text.right <= bounds.right && text.bottom <= bounds.bottom,
        weight: getComputedStyle(heading).fontWeight, synthesis: getComputedStyle(heading).fontSynthesis };
    }),
  }));
  assert(layout.fontLoaded, "The supplied Thai font must load before export");
  assert.deepEqual(layout.panels.map(({ x, width, height }) => [x, width, height]), [[0, 833, 843], [833, 833, 843], [1666, 834, 843]]);
  assert(layout.panels.every(({ fits, weight, synthesis }) => fits && weight === "400" && synthesis === "none"));
  const png = await page.screenshot();
  assert(png.length < 1024 * 1024, "LINE menu PNG must be under 1 MB");
  await writeFile(new URL("static/line-services-menu.png", root), png);
  console.log(JSON.stringify({ bytes: png.length, ...layout }));
  if (process.env.EXPORT_MENU_ARTIFACTS === "true") {
    console.log(`SCREENSHOT_menu=${png.toString("base64")}`);
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: Math.round(width * 843 / 2500) });
      await page.setContent(`<style>body{margin:0}img{width:100%;height:auto;display:block}</style><img alt="เมนูบริการ SMO OA" src="data:image/png;base64,${png.toString("base64")}">`);
      await page.locator("img").evaluate((img) => img.decode());
      console.log(`SCREENSHOT_mobile${width}=${(await page.screenshot()).toString("base64")}`);
    }
  }
} finally {
  await browser.close();
}
