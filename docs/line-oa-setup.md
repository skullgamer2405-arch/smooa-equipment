# เชื่อมเว็บยืมอุปกรณ์กับ LINE OA

โค้ดรองรับแล้ว แต่ **ยังไม่ได้เปิดการส่งข้อความจริง** เพราะบัญชีนี้มี LINE OA แล้ว แต่ยังไม่มี LINE Developers/LIFF และยังไม่ได้ใส่ credentials ใน Vercel เว็บ Preview ใช้ข้อมูลจำลองและปิด API จริงเสมอ

## ผู้ยืมจะใช้อย่างไร

1. เพิ่มเพื่อน LINE OA แล้วแตะ Rich Menu “ยืมอุปกรณ์”
2. เว็บเปิดใน LINE เลือกอุปกรณ์ เชื่อมบัญชี LINE และกดยินยอมรับแจ้งเตือนสำหรับคำขอนั้น
3. ส่งคำขอยืม ผู้ดูแลตรวจและอนุมัติผ่านเว็บ
4. ระบบส่งข้อความอนุมัติถึงผู้จอง และเตือนคืนก่อนกำหนด 1 วันกับวันครบกำหนด เป้าหมายเวลา **09:00 น. เวลาไทย** เฉพาะรายการที่ยังอยู่ในสถานะอนุมัติ/ยังไม่คืน

การจองโดยไม่เชื่อม LINE ยังใช้ได้ตามเดิม คำขอเก่าที่ไม่ได้ผูก LINE จะไม่ถูกจับคู่จากชื่อหรืออีเมลเอง ผู้ใช้ต้องเพิ่มเพื่อน OA และไม่บล็อกบัญชีจึงจะรับข้อความได้ การตอบรับจาก API ของ LINE ไม่ได้ยืนยันว่าข้อความถูกอ่านหรือส่งถึงโทรศัพท์แล้ว

## สิ่งที่เจ้าของ LINE OA ต้องตั้งค่า

### 1. เปิด Messaging API ให้ OA ที่มีอยู่

เข้า [LINE Official Account Manager](https://manager.line.biz/) เลือกบัญชี → ตั้งค่า → Messaging API → เปิดใช้งาน และเลือก Provider ขององค์กร จดชื่อ Provider ไว้ ขั้นตอนนี้ต้องทำด้วยบัญชีเจ้าของ/ผู้ดูแล OA

จากนั้นเข้า [LINE Developers Console](https://developers.line.biz/console/) จะเห็น Messaging API channel ของ OA ภายใต้ Provider นั้น เปิดแท็บ Messaging API เพื่อออก **Channel access token** เก็บลง Vercel Environment Variables โดยตรง ไม่ส่งในแชตหรือใส่ใน Git

ไม่ใช้ LINE Notify ซึ่งยุติบริการแล้ว และงานนี้ไม่จำเป็นต้องเปิด webhook รับข้อความหรือปิดแชทของเจ้าหน้าที่

### 2. สร้าง LINE Login และ LIFF

ใน **Provider เดียวกับ Messaging API** สร้าง LINE Login channel สำหรับ Web app แล้วเชื่อม Linked LINE Official Account ให้เป็น OA เดิม เปิดตัวเลือกเพิ่มเพื่อน OA เมื่อเข้าสู่ระบบ

ในแท็บ LIFF เพิ่มแอป:

| รายการ | ค่า |
| --- | --- |
| ชื่อ | SMO.CRA Equipment |
| Size | Full |
| Endpoint URL | URL HTTPS ถาวรของเว็บที่พร้อมใช้งาน เช่น `https://<โดเมนจริง>/` โดยใส่ `/` ท้าย URL |
| Scopes | `openid` และ `profile` |
| Add friend option | เปิดให้ผู้ใช้เพิ่มเพื่อน OA ที่เชื่อมไว้ |

Endpoint ต้องเปิดจากมือถือได้โดยไม่มีหน้าล็อกอิน Vercel ขวาง และต้องเป็นรากเว็บเพื่อให้ `/equipment.html`, `/booking.html?id=...` และ `/calendar.html` อยู่ใต้ endpoint เดียวกัน ห้ามใช้ URL Preview ชั่วคราวเป็น endpoint จริง

เก็บ **LINE Login Channel ID**, **LIFF ID** และ **ลิงก์เพิ่มเพื่อน OA** ค่าทั้งสามนี้เป็นข้อมูลตั้งค่าสาธารณะ ส่งให้ผู้พัฒนาได้ ส่วน Channel secret/access token ต้องอยู่ในระบบเก็บความลับเท่านั้น โปรเจกต์นี้ไม่ต้องใช้ Channel secret สำหรับเส้นทางที่ทำไว้

ช่วงพัฒนา ให้บัญชีทดสอบมีสิทธิ์ใน LINE Login channel ก่อน เมื่อทดสอบครบจึงเปลี่ยน channel เป็น Published เพื่อให้ผู้ใช้งานทั่วไปเข้าถึง

### 3. ตั้งค่าฝั่ง Vercel/Firebase

เจ้าของระบบ/ผู้ดูแลตั้งค่าตาม `.env.example` ใน Environment Variables ของ environment ที่ใช้จริง การเปลี่ยน `VITE_*` ต้อง build ใหม่ ส่วน token ของ LINE เป็นค่าฝั่งเซิร์ฟเวอร์เท่านั้น

| ตัวแปร | ใส่อะไร |
| --- | --- |
| `VITE_LINE_LIFF_ID` | LIFF ID จากข้อ 2 |
| `VITE_LINE_OA_URL` | ลิงก์เพิ่มเพื่อนที่ขึ้นต้น `https://lin.ee/` หรือ `https://line.me/` |
| `LINE_LOGIN_CHANNEL_ID` | Channel ID ของ **LINE Login** |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Access token ของ **Messaging API** |
| `LINE_ADMIN_EMAILS` | อีเมลผู้ดูแล Firebase ที่อนุญาตให้อนุมัติ คั่นหลายบัญชีด้วย comma และต้องยืนยันอีเมลแล้ว |
| `CRON_SECRET` | ค่าสุ่มลับอย่างน้อย 32 ตัวอักษร Vercel Cron ใช้ค่านี้ใน Authorization header |
| `PUBLIC_APP_URL` | โดเมน HTTPS ถาวรของเว็บ |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account ของ Firebase ฝั่งเซิร์ฟเวอร์ เก็บเป็น Secret เท่านั้น |
| `LINE_ENABLED` | ตั้ง `true` เมื่อทดสอบการตั้งค่าและสิทธิ์ครบแล้ว ค่าเริ่มต้นคือ `false` |

ห้ามนำ access token, service account หรือ cron secret ไปใส่ตัวแปรที่ขึ้นต้น `VITE_` เพราะผู้ใช้เว็บจะอ่านได้ `LINE_ENABLED=false` ไม่ใช่การตั้งค่าหน้าเว็บ: ให้เว้น LIFF ID ไว้ด้วยจนกว่าฝั่งเซิร์ฟเวอร์พร้อม

มีคำสั่งตรวจรูปแบบ/การมีอยู่ของค่าโดยไม่แสดงความลับหรือเรียกบริการจริง:

```bash
npm run line:check
```

ก่อนเปิดจริงต้องตรวจ Firebase Admin credentials, บัญชีผู้ดูแล และใช้ rules/index ที่เตรียมใน `firestore.rules` / `firestore.indexes.json` กับ environment ทดสอบก่อน **รอบนี้ยังไม่ได้ deploy rules/index หรือแก้ข้อมูล production** ไม่ใช้ Preview fixture เป็นหลักฐานว่าบัญชี Firebase จริงใช้งานได้

### 4. ใส่ Rich Menu

ไฟล์ภาพพร้อมใช้: [`static/line-rich-menu.png`](../static/line-rich-menu.png) ขนาด 2500×843 ใช้ Chulabhorn Likit Text Regular และโทนเดียวกับเว็บ

ใน OA Manager → Rich Menu สร้างเมนูแบบสั้น 3 ช่องเท่ากัน อัปโหลดภาพ แล้วตั้ง Action ของแต่ละช่องเป็น Link:

| ช่อง | ลิงก์ — เปลี่ยน `YOUR_LIFF_ID` เป็นค่าจริง |
| --- | --- |
| ยืมอุปกรณ์ | `https://liff.line.me/YOUR_LIFF_ID/equipment.html` |
| ปฏิทิน | `https://liff.line.me/YOUR_LIFF_ID/calendar.html` |
| วิธีใช้งาน | `https://liff.line.me/YOUR_LIFF_ID/` |

ตั้งข้อความแถบเปิดเมนูเป็น “ยืมอุปกรณ์” มี JSON template สำหรับผู้พัฒนาที่ [`line-rich-menu.template.json`](line-rich-menu.template.json) แต่ยังไม่มีการอัปโหลดหรือผูกเมนูกับ OA ของจริง ใช้ช่องทาง OA Manager หรือ API ช่องทางเดียวในการจัดการเมนูเพื่อไม่ให้เมนูทับกัน

หากแก้ภาพภายหลัง สร้างใหม่ได้ด้วย `npm run line:menu` โดยต้องมี Chromium สำหรับ Playwright

## เวลาแจ้งเตือนและโควตา

`vercel.json` ตั้ง cron `0 2 * * *` ที่ `/api/line/reminders` ซึ่งเท่ากับ 09:00 น. เวลาไทย Vercel Cron ทำงานบน production deployment เท่านั้น จึงยังไม่มีงานประจำส่งข้อความเกิดขึ้นจาก Preview นี้

**Vercel Hobby รับประกันระดับชั่วโมง ไม่ใช่นาที** งานเวลา 09:00 อาจเริ่มระหว่าง 09:00–09:59 ถ้าต้องการระดับนาที ต้องเลือก scheduler/แพ็กเกจที่รองรับก่อนเปิดจริง ไม่มีการอัปเกรดแพ็กเกจหรือเปิดบริการเสียเงินในงานนี้

ข้อความ push ใช้โควตาแพ็กเกจ LINE OA ของเจ้าของบัญชี ต้องตรวจจำนวนข้อความก่อนเปิดให้ผู้ใช้ทั้งหมด ระบบไม่เพิ่มแพ็กเกจให้เอง หากส่งไม่สำเร็จ งานจะอยู่ใน `lineNotifications` และ cron ครั้งถัดไป/การสั่งรันซ้ำอย่างปลอดภัยจะตรวจงานนั้น ไม่ควรถือว่า cron วันละครั้งเป็นระบบ retry ทันที

## หลักฐานและการทดสอบก่อนเปิดจริง

ทดสอบด้วยบัญชี LINE/Firebase สำหรับทดสอบ และฐานข้อมูลแยกจาก production:

- เปิด Rich Menu ทั้งสามปุ่มบน iOS และ Android และทดสอบเปิดด้วย browser ภายนอก; login กลับมาที่หน้า/รหัสอุปกรณ์เดิม
- ลองไม่เพิ่มเพื่อน/บล็อก OA/หมดอายุ login และไม่ยินยอมรับข้อความ ต้องไม่อ้างว่าผูกบัญชีสำเร็จ
- จองจากบัญชี A และอนุมัติจากแอดมิน ข้อความต้องไป A; บัญชี B หรือตัวระบุผู้ใช้ที่ส่งปลอมต้องรับข้อความแทนไม่ได้
- แอดมินที่ไม่ได้อยู่ใน allowlist และ cron ที่ไม่มี secret ต้องถูกปฏิเสธ
- บันทึกคืนก่อนรอบเตือน ต้องไม่ส่ง; ทดสอบก่อนคืน 1 วัน/วันครบกำหนด/เปลี่ยนวันคืนตามเวลาไทย
- ทดสอบ cron ซ้ำ และ LINE 429/5xx ใน mock ก่อนทำจริง ตรวจว่าใช้ retry key เดิมและไม่สร้าง booking ซ้ำเมื่อ response หาย
- ตรวจ index, Firestore rules และสิทธิ์อ่าน/เขียน private collections ด้วย emulator หรือ project ทดสอบ

คำสั่งอัตโนมัติที่ใช้ข้อมูลจำลอง: `npm run typecheck`, `npm test`, `npm run test:server`, `npm run test:e2e`, `npm run build -- --mode demo` ผลทดสอบจำลองไม่แทนการทดสอบส่ง LINE หรือเวลา cron จริง

## รายละเอียดสำหรับผู้ดูแลระบบ/ผู้พัฒนาต่อ

- `server/line.mjs`: ตรวจ ID token กับ LINE โดยใช้ Login Channel ID และตรวจ issuer/audience/expiry/subject ซ้ำ ไม่รับ LINE user ID จาก client เป็นหลักฐาน
- สร้าง booking และ `lineBookingRecipients/{bookingId}` ใน transaction เดียว เก็บ LINE user ID/ความยินยอมแยกจาก booking ที่ browser อ่านได้ ไม่เก็บ ID token ไว้ใน Firestore
- อนุมัติผ่าน `/api/line/bookings/:id/approve`: ตรวจ Firebase ID token ที่ไม่ถูก revoke, verified email และ allowlist แล้วบันทึกการอนุมัติ/สถานะอุปกรณ์/งานแจ้งเตือนใน transaction เดียว ไม่มี fallback ให้ผ่านเมื่อ credentials หาย
- มี lease 90 วินาทีและ `X-Line-Retry-Key` ที่เก็บถาวร ป้องกันการรันซ้ำ/ชนกัน เก็บข้อความ/ผู้รับตอนเริ่มส่งและใช้ payload เดิมกับ key เดิมเมื่อ retry หากข้อมูลเปลี่ยนระหว่างผลส่งที่กำกวมจะหยุดเป็น `needs_review` แทนส่งข้อมูลใหม่ด้วย key เก่า เมื่อคำตอบ LINE หายจะใช้ key เดิม ภายในช่วง deduplication 24 ชั่วโมงของ LINE เท่านั้น งานกำกวมเกิน 23 ชั่วโมงจะเป็น `needs_review` ไม่สุ่ม key ใหม่แล้วส่งซ้ำเอง
- `sent` หมายถึง LINE API รับคำขอหรือยืนยันว่ารับ key นั้นก่อนแล้ว ไม่ยืนยัน delivery/read; ผู้รับที่บล็อก OA อาจไม่เห็นข้อความแม้ API รับคำขอ
- cron คืน HTTP 503 พร้อม `incomplete` เมื่อมีงานค้าง/เกิน batch/ต้องตรวจเอง; ตรวจ Vercel logs และ `lineNotifications.status` ไม่มี automatic retry ของ Vercel Cron ที่รับประกันไว้ ใช้ secret ในระบบ secret store เพื่อเรียก endpoint ซ้ำ ห้ามใส่ secret ใน URL
- cron ส่งครั้งละไม่เกิน 100 งานด้วย concurrency 5 และงบเริ่มงาน 45 วินาทีภายใต้ function 60 วินาที หากคิว/การสแกนมากจนไม่ครบ ต้องติดตามและรันซ้ำในวันเดียวกันหรือย้ายไป worker/queue ที่เหมาะสมก่อนขยายปริมาณใช้งาน ไม่มีการอ้างว่าส่งได้ไม่จำกัด
- ตรวจ status/due date/consent อีกครั้งก่อนส่ง หากรับคืน/เปลี่ยนกำหนดแล้วจะข้ามงานเก่า ยังมีช่วงสั้นระหว่างตรวจฐานข้อมูลกับส่งไป LINE ซึ่งไม่ใช่ transaction เดียวกัน
- ไม่ส่งเตือนเกินกำหนดรายวันตามตัวเลือกของเจ้าของระบบ และยังไม่ส่งแจ้งเตือนปฏิเสธผ่าน LINE (อีเมลเดิมยังทำงานตามการตั้งค่า)
- คำขอเก่าหรือการอนุมัติจาก legacy frontend ไม่ได้รับการผูก LINE ย้อนหลังโดยอัตโนมัติ ต้องใช้หน้าแอดมินใหม่ที่ build พร้อม LIFF ID; QR/URL เดิมยังใช้งานได้
- ถ้าถอนความยินยอม ให้ผู้ดูแลปิด `lineBookingRecipients.enabled` หรือลบ mapping ตามนโยบายเก็บข้อมูลขององค์กร บล็อก OA จะหยุดการรับข้อความฝั่งผู้ใช้ แต่ยังไม่มี webhook ซิงก์สถานะบล็อกกลับมา

**ข้อจำกัดก่อน production:** Firestore rules เดิมเปิดอ่าน bookings สาธารณะและถือว่า Firebase user ที่ login แล้วเป็น admin; API อัปโหลด/อีเมลเดิมยังมีประเด็นจาก security audit ต้องแก้ในงาน hardening ก่อนเปิดใช้กับข้อมูลผู้ยืมจริง LINE endpoints ใหม่ปิดตามค่าเริ่มต้นและไม่แก้ปัญหาเก่าทั้งหมดแทนกัน การโหลด Firebase Auth เป็นแบบ lazy เพื่อไม่ให้ปัญหา dependency ของ auth ทำให้ Preview/API ที่ปิดอยู่ล่ม แต่การยืนยัน Firebase จริงบน Vercel ยังต้องตรวจแยกหลังตั้ง credentials

เอกสารอ้างอิง: [LIFF development](https://developers.line.biz/en/docs/liff/developing-liff-apps/), [verify ID token](https://developers.line.biz/en/reference/line-login/#verify-id-token), [Messaging API push](https://developers.line.biz/en/reference/messaging-api/#send-push-message), [retrying API requests](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/), [Rich menus](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/), [Vercel Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
