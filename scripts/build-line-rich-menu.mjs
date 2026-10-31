import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Package, CalendarDays, BookOpen } from "lucide-react";

const root = new URL("../", import.meta.url);
const font = await readFile(
  new URL("static/fonts/chulabhornlikittext-regular.woff2", root),
);
const icons = [Package, CalendarDays, BookOpen].map((icon) =>
  renderToStaticMarkup(createElement(icon, { size: 152, strokeWidth: 1.6 })),
);
const sections = [
  ["ยืมอุปกรณ์", "ค้นหาอุปกรณ์และส่งคำขอ"],
  ["ปฏิทิน", "เช็กวันใช้งานและวันคืน"],
  ["วิธีใช้งาน", "ดูขั้นตอนการยืมอุปกรณ์"],
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 2500, height: 843 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html><html lang="th"><meta charset="utf-8"><style>
    @font-face{font-family:Chulabhorn;src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:400}
    *{box-sizing:border-box}body{margin:0;background:#112c44;color:#fff;font-family:Chulabhorn,sans-serif;font-synthesis:none}
    main{display:grid;grid-template-columns:833px 833px 834px;height:843px;border-top:14px solid #d3b476}
    section{padding:110px 48px 64px;display:flex;align-items:center;flex-direction:column;text-align:center}
    section+section{border-left:2px solid #4b6172} .icon{width:230px;height:230px;display:grid;place-items:center;background:#1e3c57;border:2px solid #597082;border-radius:52px;color:#e5c78c}
    h1{font-size:112px;line-height:1.5;font-weight:400;margin:40px 0 8px}p{font-size:38px;color:#d6e0e9;margin:0;line-height:1.6}
    .tag{font-size:26px;letter-spacing:4px;color:#e5c78c;margin-top:36px}
    </style><main>${sections.map(([title], i) => `<section><div class="icon">${icons[i]}</div><h1>${title}</h1><p class="tag">SMO.CRA · EQUIPMENT</p></section>`).join("")}</main></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: new URL("static/line-rich-menu.png", root).pathname,
  });
  const template = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: "SMO.CRA Equipment",
    chatBarText: "ยืมอุปกรณ์",
    areas: ["/equipment.html", "/calendar.html", "/"].map((path, i) => ({
      bounds: { x: i * 833, y: 0, width: i === 2 ? 834 : 833, height: 843 },
      action: {
        type: "uri",
        label: sections[i][0],
        uri: `https://liff.line.me/YOUR_LIFF_ID${path}`,
      },
    })),
  };
  await writeFile(
    new URL("docs/line-rich-menu.template.json", root),
    JSON.stringify(template, null, 2) + "\n",
  );
  console.log(
    "Created static/line-rich-menu.png (2500×843) and the Rich Menu URL template. Nothing published to LINE.",
  );
} finally {
  await browser.close();
}
