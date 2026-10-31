import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createApp } from "../server.js";

test("production security headers preserve demo rendering, QR and printing",async()=>{
  const app=createApp({env:{SMO_DEMO_MODE:"true"}});
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
  const origin="http://127.0.0.1:"+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:["--no-sandbox","--disable-dev-shm-usage"]});
    const context=await browser.newContext();
    await context.addInitScript(()=>sessionStorage.setItem("smo-line-notifications-v2-demo","declined"));
    await context.route(/^https?:\/\//,route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    const page=await context.newPage(),violations=[];
    page.on("console",message=>{if(/content security policy|violates.*directive/i.test(message.text()))violations.push(message.text());});
    const response=await page.goto(origin+"/equipment.html");
    assert.equal(response.headers()["x-frame-options"],"DENY");
    assert(response.headers()["content-security-policy"].includes("frame-ancestors 'none'"));
    await page.getByRole("heading",{name:"เลือกอุปกรณ์สำหรับกิจกรรม"}).waitFor();
    await page.getByRole("button",{name:"QR ของ ชุดไมโครโฟนไร้สาย",exact:true}).click();
    await page.getByRole("dialog").getByRole("img").waitFor();
    const opened=context.waitForEvent("page");
    await page.getByRole("button",{name:"พิมพ์",exact:true}).click();
    const popup=await opened;await popup.getByRole("heading",{name:"ชุดไมโครโฟนไร้สาย"}).waitFor();
    assert.equal(await popup.locator("img").count(),1);
    assert.deepEqual(violations,[]);
  }finally{
    await browser?.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
  }
});
