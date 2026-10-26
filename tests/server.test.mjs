import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const mode of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'production', SMO_DEMO_MODE: 'true' }]) {
  test(`demo API blocks real side effects (${JSON.stringify(mode)})`, () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'smooa-demo-api-'));
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
        import path from 'node:path';
        import { tmpdir } from 'node:os';
        import { getApps } from 'firebase-admin/app';
        import nodemailer from 'nodemailer';
        nodemailer.createTransport = () => { throw Error('SMTP must stay disabled'); };
        const uploads = path.join(tmpdir(), 'smooa-equipment-uploads');
        mkdirSync(uploads);
        writeFileSync(path.join(uploads, 'fixture.png'), 'private fixture');
        const app = (await import('./server.js')).default;
        assert.equal(getApps().length, 0, 'demo must not initialize Firebase Admin');
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const origin = 'http://127.0.0.1:' + server.address().port;
        try {
          for (const route of ['upload-image', 'notify-admin-booking', 'notify-borrower-approved', 'notify-borrower-rejected', 'line/bookings', 'line/bookings/fixture/approve']) {
            const response = await fetch(origin + '/api/' + route, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'invalid JSON',
            });
            assert.equal(response.status, 403);
            assert.equal((await response.json()).code, 'DEMO_MODE');
          }
          const form = new FormData();
          form.append('image', new Blob(['must not be stored'], { type: 'image/png' }), 'new.png');
          assert.equal((await fetch(origin + '/api/upload-image', { method: 'POST', body: form })).status, 403);
          for (const route of ['/api/admin/notifications', '/api/line/reminders', '/api/not-found', '/uploads/fixture.png']) {
            const response = await fetch(origin + route);
            assert.equal(response.status, 403);
            assert.equal((await response.json()).code, 'DEMO_MODE');
          }
          assert.deepEqual(readdirSync(uploads), ['fixture.png']);
        } finally {
          await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        }
      `], {
        cwd: root,
        timeout: 20_000,
        env: {
          PATH: process.env.PATH,
          TMPDIR: scratch,
          VERCEL: '1',
          SMO_DEMO_MODE: 'false',
          VITE_DEMO_MODE: 'false',
          ...mode,
          DOTENV_CONFIG_PATH: path.join(scratch, 'missing.env'),
          SMTP_HOST: 'smtp.example.invalid',
          SMTP_USER: 'fixture@example.invalid',
          SMTP_PASS: 'fixture-only',
        },
        stdio: 'pipe',
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}

import { createApp } from "../server.js";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { memoryDb } from "./fixtures/memory-db.mjs";
import { createBookingService } from "../server/bookings.mjs";
import { canonicalImage } from "../server/images.mjs";
import { createNotifications, escapeHtml } from "../server/notifications.mjs";

const payload = { requestId:"c8ed05f3-76b1-4f51-83bf-1581bbb82591",equipmentId:"fixture",fullName:"<b>ผู้ทดสอบ</b>",studentId:"TEST-01",faculty:"คณะทดสอบ",department:"สาขาทดสอบ",affiliation:"",applicantEmail:"borrower@example.invalid",applicantPhone:"",activityName:"กิจกรรม",reason:"ทดสอบ",startDate:"2035-06-10",endDate:"2035-06-11",terms:true };
function fixture() {
 const db=memoryDb(), mails=[],images=[];
 db.rows.set("equipment/fixture",{title:"ลำโพง <img src=x>",assetCode:"EQ-01",status:"available"});
 const env={PUBLIC_APP_URL:"https://equipment.example.invalid",ADMIN_NOTIFICATION_EMAIL:"admin@example.invalid"};
 const app=createApp({env,getDb:()=>db,verifyAdmin:async token=>({uid:token,email_verified:token!=="unverified",admin:token==="admin"}),transport:{sendMail:async mail=>mails.push(mail)},bucket:async()=>({name:"fixture-bucket",file:name=>({save:async(bytes,options)=>images.push({name,bytes,options})})})});
 return {db,mails,images,app,env};
}
async function serve(app,run) {
 const server=app.listen(0,"127.0.0.1"); await new Promise(resolve=>server.once("listening",resolve));
 const origin="http://127.0.0.1:"+server.address().port;
 try{await run((route,options={})=>fetch(origin+route,options));}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
}
const json=(body,token)=>({method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});

test("admin claim is required for every protected operation, including upload and legacy email URLs",async()=>{
 const f=fixture();
 await serve(f.app,async request=>{
  for(const token of [undefined,"ordinary","unverified"]){
   for(const route of ["/api/upload-image","/api/notify-admin-booking","/api/notify-borrower-approved","/api/notify-borrower-rejected","/api/admin/equipment/fixture/return"]){
    const response=await request(route,json({bookingId:"any"},token));assert.equal(response.status,token?403:401,route);
   }
  }
  assert.equal((await request("/api/admin/notifications",{headers:{Authorization:"Bearer admin"}})).status,200);
 });
 assert.equal(f.mails.length,0);assert.equal(f.images.length,0);
});

test("missing Firebase Admin configuration never bypasses authentication",async()=>{
 const app=createApp({env:{},verifyAdmin:async()=>{const error=Error("unavailable");error.status=503;throw error;},getDb:()=>{throw Error("must not read database");}});
 await serve(app,async request=>{
  assert.equal((await request("/api/admin/notifications")).status,401);
  assert.equal((await request("/api/admin/notifications",{headers:{Authorization:"Bearer fixture"}})).status,503);
 });
});

test("booking retries create one record and one email, using canonical equipment fields and escaped content",async()=>{
 const f=fixture();
 await serve(f.app,async request=>{
  const [a,b]=await Promise.all([request("/api/bookings",json({...payload,equipmentName:"forged"})),request("/api/bookings",json(payload))]);
  assert.equal(a.status,200);assert.equal(b.status,200);
  const left=await a.json(),right=await b.json();assert.equal(left.bookingId,right.bookingId);
  assert.equal(f.db.rows.get("bookings/"+left.bookingId).equipmentName,"ลำโพง <img src=x>");
  assert.equal((await request("/api/bookings",json({...payload,reason:"different"}))).status,409);
 });
 assert.equal(f.mails.length,1);assert(f.mails[0].html.includes("&lt;b&gt;"));assert(!f.mails[0].html.includes("<img src=x>"));
 assert.equal(escapeHtml("<>&\"'"),"&lt;&gt;&amp;&quot;&#39;");
});

test("public calendar exposes only the projection; approval and return update it transactionally",async()=>{
 const f=fixture();
 await serve(f.app,async request=>{
  const created=await (await request("/api/bookings",json(payload))).json();
  const path="/api/admin/bookings/"+created.bookingId+"/decision";
  assert.equal((await request(path,json({action:"approved"},"admin"))).status,200);
  const response=await request("/api/public/calendar?from=2035-06-01&to=2035-06-30");assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.items.length,1);
  assert.deepEqual(Object.keys(result.items[0]).sort(),["id","equipmentId","equipmentName","assetCode","startDay","endDay","status"].sort());
  assert(!JSON.stringify(result).includes(payload.studentId));assert(!JSON.stringify(result).includes(payload.fullName));
  assert.equal((await request("/api/admin/equipment/fixture/return",json({bookingId:created.bookingId},"admin"))).status,200);
  assert.equal((await (await request("/api/public/calendar?from=2035-06-01&to=2035-06-30")).json()).items.length,0);
 });
 assert(f.db.reads.filter(r=>r.name==="publicCalendar").every(r=>r.size===100));
});

test("decision emails cannot be redirected or fabricated from request body",async()=>{
 const f=fixture(),service=createBookingService({db:f.db});
 const key=await service.create(payload);
 const notifications=createNotifications({db:f.db,env:f.env,transport:{sendMail:async mail=>f.mails.push(mail)}});
 await assert.rejects(()=>notifications.dispatch(key,"approved"),e=>e.status===409);
 await serve(f.app,async request=>{
  await request("/api/admin/bookings/"+key+"/decision",json({action:"approved"},"admin"));
  await request("/api/notify-borrower-approved",json({bookingId:key,applicantEmail:"attacker@example.invalid"},"admin"));
 });
 assert.equal(f.mails.length,1);assert.equal(f.mails[0].to,payload.applicantEmail);
});

test("ambiguous email delivery is recorded for review and not blindly resent",async()=>{
 const f=fixture(),key=await createBookingService({db:f.db}).create(payload);let attempts=0;
 const notifications=createNotifications({db:f.db,env:f.env,transport:{sendMail:async()=>{attempts++;throw Error("lost response");}}});
 assert.equal((await notifications.dispatch(key,"pending")).notification,"needs_review");
 await notifications.dispatch(key,"pending");assert.equal(attempts,1);
 assert.equal(f.db.rows.get("emailNotifications/"+key+"_pending").status,"needs_review");
});

test("a retried Firestore transaction that loses the notification claim never sends duplicate mail",async()=>{
 const db=memoryDb(), id="claim-retry", sent=[];
 db.rows.set("bookings/"+id,{status:"pending",equipmentName:"Fixture",applicantEmail:"borrower@example.invalid"});
 db.runTransaction=async callback=>{
  await callback({get:async()=>({exists:false}),create:()=>{}});
  return callback({get:async()=>({exists:true}),create:()=>{throw Error("duplicate claim");}});
 };
 const notifications=createNotifications({db,env:{ADMIN_NOTIFICATION_EMAIL:"admin@example.invalid"},transport:{sendMail:async m=>sent.push(m)}});
 assert.equal((await notifications.dispatch(id,"pending")).notification,"already_queued");
 assert.equal(sent.length,0);
});

test("images are decoded and re-encoded as PNG, stored through persistent storage with generated names",async()=>{
 const f=fixture();const valid=PNG.sync.write({width:1,height:1,data:Buffer.from([0,0,0,255])});
 for(const bytes of [Buffer.from("<svg onload=alert(1)>"),Buffer.from("not an image"),valid.subarray(0,28)])assert.throws(()=>canonicalImage(bytes));
 const huge=Buffer.from(valid);huge.writeUInt32BE(100000,16);assert.throws(()=>canonicalImage(huge));
 await serve(f.app,async request=>{
  const upload=async bytes=>{const data=new FormData();data.append("image",new Blob([bytes],{type:"image/png"}),"evil.html");return request("/api/upload-image",{method:"POST",headers:{Authorization:"Bearer admin"},body:data});};
  assert.equal((await upload(Buffer.from("html"))).status,400);
  const response=await upload(valid);assert.equal(response.status,200);
  const body=await response.json();assert(body.imageUrl.startsWith("https://firebasestorage.googleapis.com/"));
 });
 assert.equal(f.images.length,1);assert.match(f.images[0].name,/^equipment\/[a-f0-9-]+\.png$/);assert.equal(f.images[0].options.metadata.contentType,"image/png");
});

test("calendar range is bounded and projection pagination preserves all records",async()=>{
 const f=fixture(),service=createBookingService({db:f.db});
 for(let i=0;i<105;i++)f.db.rows.set("publicCalendar/p"+String(i).padStart(3,"0"),{equipmentId:"fixture",equipmentName:"test",assetCode:"EQ",startDay:"2035-06-10",endDay:"2035-06-11",status:"approved"});
 const first=await service.calendar({from:"2035-06-01",to:"2035-06-30"});assert.equal(first.items.length,100);
 const second=await service.calendar({from:"2035-06-01",to:"2035-06-30",after:first.nextCursor});assert.equal(second.items.length,5);assert.equal(second.nextCursor,null);
 await assert.rejects(()=>service.calendar({from:"2035-01-01",to:"2035-12-31"}),e=>e.status===400);
});
