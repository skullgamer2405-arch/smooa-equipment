# เปิดใช้งานเว็บทางการ SMO OA บน Vercel

คู่มือนี้ใช้ Vercel โปรเจกต์เดิมเป็นเว็บและ API โดยคง Firebase เป็นฐานข้อมูล ผู้ใช้ยืนยันว่าปัจจุบันมีเฉพาะข้อมูลทดสอบ งานนี้ไม่ลบข้อมูลเดิม ไม่เปลี่ยนแพ็กเกจ และไม่ใช้ `smo-eq` เป็นระบบทางการ

โค้ดมีตัวตรวจค่าก่อน build Production แต่การตรวจนี้ดูรูปแบบ/ความครบถ้วนเท่านั้น ไม่ได้ล็อกอินหรือยืนยันว่ารหัสลับใช้ได้จริง บัญชี อีเมล LINE และสิทธิ์บนคลาวด์ยังต้องตั้งและทดสอบตามด้านล่าง

> ส่วน Firebase Storage ในคู่มือ PDF เดิม 27 หน้า [`setup-guide-th.pdf`](../static/manuals/setup-guide-th.pdf) เลิกใช้กับการอัปโหลดภาพใหม่แล้ว ให้ทำตาม [คู่มือ Cloudinary](cloudinary-setup.md) โดยไม่ต้องเปิด Storage หรือ Blaze ตาม PDF ไฟล์ PDF เดิมคงไว้เป็นเอกสารอ้างอิง

## 1. เลือกโดเมนและทดสอบแยกก่อน

1. ใน Vercel เลือกโปรเจกต์ `smooa-equipment` → **Settings → Domains** คัดลอกโดเมนถาวรของโปรเจกต์ เช่น `https://ชื่อโปรเจกต์.vercel.app` ใช้โดเมนเดียวกันใน `PUBLIC_APP_URL`, Firebase Authorized Domains และ LIFF Endpoint อย่าใช้ URL หน้า dashboard หรือ URL Preview ชั่วคราว
2. **Root Directory** ต้องเป็นราก repository ไม่ใช่ `smo-eq` ใช้ Node **24.x** และไฟล์ `vercel.json` ของโค้ดชุดนี้ ซึ่งมี `app` สำหรับหน้าเว็บ และ `api` สำหรับ `/api/*` ไม่มีบริการภายในที่ต้องตั้ง binding
3. Preview ของโปรเจกต์หลักตั้งใจใช้ข้อมูลจำลองและปิด API จริงเสมอ ใช้ตรวจหน้าตาได้ แต่ทดสอบส่งอีเมล/LINE จริงไม่ได้
4. สำหรับทดสอบเชื่อมต่อจริง ให้ใช้ Firebase project ทดสอบและ Vercel project ทดสอบแยก โดย deploy แบบ Production **ของโปรเจกต์ทดสอบนั้น** ผูก branch ทดสอบเฉพาะโปรเจกต์ทดสอบ ใช้บัญชี/อุปกรณ์/ผู้รับทดสอบเท่านั้น ไม่ปิด guard ของ Preview หลักและไม่ใช้ข้อมูลผู้ยืมจริง
5. เมื่อทดสอบผ่านแล้ว จึงใช้ค่า Production ของโปรเจกต์หลักและโดเมนถาวร อย่าเปิด Rich Menu ให้ผู้ใช้ทั่วไปก่อนขั้นตอนตรวจรับผ่าน

## 2. เชื่อม Firebase

**ค่าฝั่งหน้าเว็บเป็นข้อมูลสาธารณะ**: เข้า Firebase Console → เลือก project → รูปเฟือง **Project settings → General → Your apps → Web app → SDK setup and configuration → Config** แล้วจับคู่ค่าดังนี้

| ตัวแปรใน Vercel | ค่าจาก Firebase config |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

ใน Vercel เลือกโปรเจกต์ที่ต้องการให้ถูกก่อน แล้วไป **Settings → Environment Variables** เลือก **Production ของโปรเจกต์นั้น** ตั้งสี่ค่าข้างต้นเป็น **Config** (ข้อมูลสาธารณะ ไม่ใช่ Secret) ให้ `app` ใช้ตอน build และ `api` ใช้เทียบ project ค่า `VITE_FIREBASE_STORAGE_BUCKET` เป็น Config ทางเลือก จะคงค่าเดิมหรือเว้นว่างก็ได้ ส่วน `FIREBASE_STORAGE_BUCKET` เดิมไม่ถูกใช้แล้ว ค่า `VITE_*` ต้อง build ใหม่จึงเปลี่ยนตาม อย่านำค่าจาก project ทดสอบไปใส่โปรเจกต์หลัก

**ค่าลับฝั่ง API**: ตั้ง `FIREBASE_SERVICE_ACCOUNT_JSON` เป็น JSON ของ service account สำหรับ project เดียวกัน ใน Vercel โดยตรง เลือกชนิด Secret และ scope เฉพาะ `api` ห้ามตั้งชื่อขึ้นต้น `VITE_` ห้ามส่ง JSON ในแชตหรือ commit

หาก build หยุดที่ Firebase ให้ดูบรรทัด `Firebase credential:` ใน Build Logs:

- `missing in API build environment`: ตรวจชื่อตัวแปร, environment Production และ service `api` ของโปรเจกต์ที่กำลัง deploy
- `invalid JSON`: วางเนื้อหาไฟล์ JSON ทั้งหมดตั้งแต่ `{` ถึง `}` โดยตรง ไม่ใช่ชื่อไฟล์หรือพาธ
- `expected a JSON object`: ค่าที่วางเป็นข้อความที่ถูกครอบซ้ำ, array หรือ null ให้ใช้เนื้อหาไฟล์ service account ต้นฉบับ
- `missing/non-string fields`: ไฟล์ขาดฟิลด์ที่ระบุ หรือค่าไม่ใช่ข้อความ ตรวจว่าเป็นไฟล์ service account ไม่ใช่ Firebase web config
- `Firebase server/client project matches`: เมื่อ JSON อ่านได้แล้ว ต้องให้ `project_id` ในไฟล์ตรงกับ `VITE_FIREBASE_PROJECT_ID`

ตัวตรวจไม่แสดงค่า credential หรือรายละเอียดจาก JSON parser และไม่ตรวจ project ซ้ำเมื่อ credential ยังอ่านไม่ได้ ส่งเฉพาะบรรทัดเหตุผลเพื่อขอความช่วยเหลือได้ โดยเก็บไฟล์ต้นฉบับไว้นอกแชต การผ่านขั้นตอนนี้ยังไม่ยืนยันว่า private key ใช้ล็อกอิน Firebase ได้จริง

ให้ผู้ดูแล Google Cloud สร้าง service account ผ่าน **IAM & Admin → Service Accounts** และให้สิทธิ์เท่าที่ API ใช้: `Cloud Datastore User`, `Firebase Authentication Viewer` เท่านั้น ไม่ต้องให้สิทธิ์ Firebase Storage จากนั้น **Keys → Add key → Create new key → JSON** คัดลอก JSON จากไฟล์ที่ดาวน์โหลดไปวางใน Vercel โดยตรง เก็บไฟล์ในที่ปลอดภัยนอก repository และไม่ส่ง private key ในแชต การให้สิทธิ์แอดมินแก่ผู้ใช้เป็นงาน operator แยก ไม่ต้องให้ API runtime มีสิทธิ์จัดการบัญชีทุกอย่าง

ใน Firebase Console:

- **Authentication → Sign-in method** เปิด Email/Password สำหรับผู้ดูแล
- **Authentication → Settings → Authorized domains** เพิ่มเฉพาะ hostname เว็บจริงและเว็บทดสอบที่ใช้ ไม่ใส่ `https://` ในช่องนี้
- ตรวจว่า Firestore พร้อมใช้และสิทธิ์ตรงกับ project การอัปโหลดภาพใหม่ใช้ Cloudinary จึงไม่ต้องสร้าง Firebase Storage bucket หรือเปิด Blaze หากหน้าตั้งค่า Storage ขอ billing ให้หยุดขั้นตอนนั้น
- บัญชีแอดมินต้องยืนยันอีเมลและมี custom claim `admin=true` บัญชี Firebase ที่ล็อกอินได้เฉย ๆ ไม่ได้เป็นแอดมิน

สำหรับผู้ดูแล Firebase ที่มีสิทธิ์จัดการบัญชี: เลือก UID ที่เจ้าของยืนยันจาก Authentication → Users แล้วใช้ Terminal ที่เก็บ credentials แบบปลอดภัย:

```bash
node scripts/admin-claim.mjs --project YOUR_PROJECT_ID --uid VERIFIED_ADMIN_UID
# คำสั่งด้านบนเป็น dry run หลังตรวจ project/บัญชีแล้วจึงใช้:
node scripts/admin-claim.mjs --project YOUR_PROJECT_ID --uid VERIFIED_ADMIN_UID --apply
```

สคริปต์ไม่ยกระดับบัญชีที่ยังไม่ยืนยันอีเมล หากเป็นบัญชีใหม่ให้ทำขั้นตอนยืนยันอีเมลของ Firebase ก่อน ให้ผู้ดูแลระบบใช้ Firebase Admin SDK สร้าง email verification link ให้เจ้าของบัญชีเปิดในช่องทางส่วนตัว ไม่ส่งลิงก์ยืนยัน/รหัสในแชตนี้ หลังตั้ง claim ให้ออกจากระบบและเข้าระบบใหม่ บัญชี runtime แบบ Viewer ไม่ใช่ credential สำหรับคำสั่งเพิ่มสิทธิ์นี้

**Deploy policy แยกจากหน้าเว็บ**: ให้ operator ตรวจ project เป้าหมายและสำรองข้อมูล/กฎเดิม จากนั้นใช้ Firebase CLI รุ่นที่กำหนด:

```bash
npx --yes firebase-tools@15.34.1 deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

รอ indexes พร้อมก่อนเปิดจอง สคริปต์ `project-public-calendar.mjs --project YOUR_PROJECT_ID` เป็น dry run; ใช้ `--apply` หลังตรวจข้อมูล approved เดิมเพื่อสร้างปฏิทินที่ไม่มีข้อมูลผู้ยืม ตรวจว่าข้อมูลเก่าใน `publicCalendar` มีเฉพาะ equipment/date/status ด้วย ตั้ง Firestore TTL ของ collection group `submissionLimits` บน field `expiresAt` เพื่อล้างเอกสารโควตาเก่า ไม่ใช้ TTL เป็นกลไกอนุญาตการส่งคำขอ

## ภาพอุปกรณ์ผ่าน Cloudinary

ทำตาม [คู่มือตั้งค่า Cloudinary Free](cloudinary-setup.md) ก่อนตรวจรับจริง ตั้ง `CLOUDINARY_CLOUD_NAME` เป็น Config และ `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` เป็น Secret เฉพาะ `api` ใน Production ของโปรเจกต์ที่เลือก ไม่ใช้ `VITE_` และไม่ใส่ใน `app` เจ้าของต้องตรวจแพ็กเกจ/โควตาปัจจุบัน รวมถึงรองรับ PNG ที่เซิร์ฟเวอร์สร้างใหม่ได้ถึง 10 MiB ห้ามอัปเกรดเสียเงินอัตโนมัติ ผลตรวจ release ไม่ยืนยันว่าบัญชีใช้งานได้จริง

## 3. เชื่อมอีเมลผู้ดูแล

แนะนำ Gmail SMTP ไม่ต้องใช้ Google AI Studio API key หรือ Apps Script

1. เลือก Gmail **ผู้ส่ง** และอีเมล **ผู้ดูแลผู้รับ** จะเป็นบัญชีเดียวกันก็ได้
2. บัญชีผู้ส่งเปิด [2-Step Verification](https://myaccount.google.com/security) แล้วสร้าง [App Password](https://myaccount.google.com/apppasswords) ชื่อ `SMO OA email`
3. ตั้งค่าใน Vercel ฝั่ง `api`:

| ตัวแปร | ค่า |
| --- | --- |
| `ADMIN_NOTIFICATION_EMAIL` | อีเมลผู้ดูแลหนึ่งหรือสองที่อยู่คั่นด้วยจุลภาค เช่น `first@example.invalid,second@example.invalid` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` — ระบบบังคับ STARTTLS อยู่แล้ว |
| `SMTP_USER` | Gmail ผู้ส่ง |
| `SMTP_PASS` | App Password 16 ตัว ไม่ใช่รหัสผ่าน Google ปกติ |
| `PUBLIC_APP_URL` | HTTPS URL หลักของเว็บ |

ค่า `ADMIN_NOTIFICATION_EMAIL` เดิมยังใช้ที่อยู่เดียวได้ ระบบตัดช่องว่าง รวมที่อยู่ซ้ำแบบไม่แยกตัวพิมพ์ และปฏิเสธรายการผิดรูปแบบ/เกินสองที่อยู่/บรรทัดใหม่ ผู้รับไม่ผูกกับ UID หรือสิทธิ์ `admin=true` ต้องตั้ง custom claim ให้บัญชีผู้ดูแลแต่ละบัญชีแยกกัน เจ้าของใส่อีเมลจริงใน Vercel ไม่ส่งข้อมูลบัญชีหรือรหัสผ่านในแชต

4. หลัง Redeploy เข้าแอดมิน → **การตั้งค่า → อีเมลแจ้งเตือน** ตรวจผู้รับ/ช่องทางให้เป็น SMTP เว้นช่อง Apps Script ว่างแล้วบันทึก กดส่งทดสอบหนึ่งครั้ง ตรวจ Inbox และ Spam
5. ส่งคำขอทดสอบจากเว็บและ LINE ต้องถึงผู้ดูแล ส่วนการอนุมัติ/ปฏิเสธต้องส่งไปที่อีเมลผู้ยืมในคำขอ ไม่ใช่อีเมลที่แนบมาเพื่อเปลี่ยนปลายทาง

อีเมลที่บริการตอบรับแล้วอาจยังไม่เข้ากล่องรับ งานที่ผลส่งกำกวมจะเป็น `needs_review` และไม่ส่งซ้ำเอง ตรวจกล่องเมลของผู้รับทั้งสอง/ผู้ให้บริการก่อนส่งใหม่ รวมถึงกรณีรับเพียงหนึ่งที่อยู่ ระบบไม่ส่งซ้ำอัตโนมัติ คำขอก่อนตั้งค่าอีเมลไม่ถูกส่งย้อนหลังอัตโนมัติ รายละเอียดและวิธีแก้ปัญหา: [คู่มืออีเมล](admin-email-setup.md)

หากเลือก Apps Script แทน SMTP ต้องตั้ง **ทั้ง** `APPS_SCRIPT_WEBHOOK_URL` แบบ `/exec` และ `APPS_SCRIPT_SHARED_SECRET` อย่างน้อย 32 ตัวให้ตรงกับ Script Properties ค่าในหน้าแอดมินที่บันทึกไว้มีสิทธิ์ทับ URL เริ่มต้นนี้ รวมถึงการบันทึกช่องว่างเพื่อปิด ดูขั้นตอนในคู่มืออีเมล

## 4. เชื่อม LINE Developers และ Rich Menu

ใช้ OA เดิม **`@474ezowf`** ไม่ใช้ LINE Notify

1. เข้า [LINE Official Account Manager](https://manager.line.biz/) เลือก OA → **Settings → Messaging API → Enable** เลือก Provider ขององค์กร
2. เข้า [LINE Developers Console](https://developers.line.biz/console/) ภายใต้ Provider เดียวกัน เปิด Messaging API channel ของ OA → แท็บ **Messaging API** → ออก Channel access token เก็บใน Vercel เท่านั้น
3. ใน Provider เดียวกันสร้าง **LINE Login channel → Web app** เชื่อม **Linked LINE Official Account** กับ OA เดิม เปิดตัวเลือกเพิ่มเพื่อน
4. แท็บ **LIFF → Add** ตั้ง Size `Full`, Endpoint URL เป็น `https://โดเมนเว็บจริง/` มี `/` ท้าย URL, scopes `openid` และ `profile` เปิด Add friend option Endpoint ต้องเปิดได้บนมือถือโดยไม่มีหน้า sign-in ของ Vercel ขวาง
5. ตั้งค่า Vercel:

| ตัวแปร | ค่า |
| --- | --- |
| `VITE_LINE_LIFF_ID` | LIFF ID เช่น `1234567890-AbCdEf` — ข้อมูลสาธารณะ |
| `VITE_LINE_OA_URL` | `https://line.me/R/ti/p/@474ezowf` |
| `LINE_LOGIN_CHANNEL_ID` | Channel ID ของ **LINE Login** ไม่ใช่ Messaging API |
| `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` | Access token ของ **Messaging API** — secret |
| `LINE_ENABLED` | `true` หลังตรวจการตั้งค่าและเตรียมทดสอบ |
| `CRON_SECRET` | ค่าสุ่มอย่างน้อย 32 ตัวจาก password manager — secret |

6. ใน OA Manager → **Rich menu** ใช้ภาพ/ตำแหน่งจาก [คู่มือ LINE](line-oa-setup.md) ปุ่มเข้าเว็บให้เป็น **Link** ไป `https://liff.line.me/YOUR_LIFF_ID` ไม่ใช้ลิงก์ Vercel ตรงเป็นปุ่มหลัก
7. ขณะพัฒนาให้บัญชีทดสอบอยู่ในสิทธิ์ของ LINE Login channel ก่อน ทดสอบครบแล้วจึงเปลี่ยน channel เป็น **Published** และเปิด Rich Menu ให้ผู้ใช้ทั่วไป

ผู้ใช้เปิดครั้งแรกจะเจอคำขอเชื่อม LINE การอนุญาตสำเร็จจะถูกจดจำในเบราว์เซอร์เดิม หน้าอื่นไม่มีแผงเชื่อมซ้ำ หากเปลี่ยนเครื่อง ล้างข้อมูลเว็บ ถอนสิทธิ์ หรือ LINE ขอ scope ใหม่ อาจต้องอนุญาตใหม่ ผู้รับต้องเป็นเพื่อน OA และไม่บล็อกบัญชี

การอนุมัติแจ้ง LINE; การปฏิเสธแจ้งอีเมลตามระบบปัจจุบัน เตือนคืนเฉพาะรายการที่ยังไม่คืน ก่อนครบกำหนดหนึ่งวันและวันครบกำหนด เวลาไทย **09:00–09:59** ตามความแม่นยำของ Vercel Hobby Cron `0 2 * * *` ทำงานเฉพาะ Production ของโปรเจกต์นั้น ต้องตรวจโควตาข้อความ OA ก่อนเปิดใช้จริง API ตอบรับไม่ได้ยืนยันว่าอ่านแล้ว

## 5. ตรวจรับแล้วเปิดเว็บทางการ

หลังตั้ง environment แล้ว การเปลี่ยนค่าทุกครั้งต้อง **Redeploy** Production build จะหยุดเมื่อค่าขาด/ใช้ demo/project ของ browser กับ API ไม่ตรง หากหยุดให้แก้ชื่อที่ระบุ ไม่ปิดตัวตรวจเพื่อให้ build ผ่าน

สำหรับ operator ที่ตั้ง `.env.local` ไว้อย่างปลอดภัย:

```bash
npm run release:check -- --frontend  # ตรวจค่าที่ใช้ build หน้าเว็บ
npm run release:check               # ตรวจค่าฝั่ง API เพิ่ม ไม่ติดต่อบริการจริง
```

ก่อน promote โปรเจกต์หลัก ให้ตรวจด้วยบัญชีทดสอบบน staging แยก:

- ล็อกอินแอดมินจริงได้ บัญชีธรรมดา/ยังไม่ยืนยันอีเมลเข้าไม่ได้
- ส่งคำขอ อนุมัติ ปฏิเสธ รับคืน นำเข้าไฟล์และ QR ใช้งานได้ ตรวจอัปโหลดภาพใหม่ เปลี่ยนภาพ โหลดหน้าใหม่ รายการอุปกรณ์และภาพสำรองตาม [รายการตรวจรับ Cloudinary](cloudinary-setup.md#ตรวจรับก่อนเปิดใช้จริง) รายการส่วนตัวไม่ปรากฏในปฏิทินสาธารณะ
- อีเมลถึงผู้รับที่เลือก LINE ถึงบัญชีที่ผูกไว้ เปิด Rich Menu ซ้ำไม่ถามเชื่อมซ้ำโดยไม่มีเหตุ
- คืนของแล้วไม่เตือนซ้ำ ลองคำขอเดิมซ้ำไม่สร้างรายการ/ข้อความซ้ำ ตรวจคิวที่ต้องทบทวนและผล Cron จากข้อมูลทดสอบ
- เปิดหน้าย่อยโดยตรง/refresh ได้ ตรวจ mobile LINE browser ทั้ง iOS/Android และบัญชีที่บล็อก OA
- ตรวจ Firebase rules/indexes ที่ deploy จริงและสิทธิ์ service account ไม่ใช้ผล emulator อ้างว่าค่าบนคลาวด์เปลี่ยนแล้ว

ให้ CI ของ commit ที่จะปล่อยผ่านก่อน Vercel ใช้ source ชุดเดียวกัน (Production Branch ของโปรเจกต์หลักเป็น `main` ตามที่ตรวจใน Settings) โค้ดรอบนี้ไม่เปลี่ยนโดเมน/แพ็กเกจหรือ promote Production แทนเจ้าของโดยไม่ผ่านการตั้งค่าเหล่านี้ ไม่มีการ deploy Firebase Hosting อัตโนมัติใน CI แล้ว เพราะเลือก Vercel เป็นเว็บหลัก

หากพบปัญหา ให้ซ่อนเมนูเข้าเว็บชั่วคราวหรือใช้หน้าประกาศ และ rollback ไป deployment ที่ผ่านการตรวจด้านสิทธิ์แล้วบน Vercel **ห้ามย้อนกลับไป `smo-eq` หรือคืน rules แบบ public booking** การ rollback เว็บไม่ได้ rollback ฐานข้อมูล/rules/secrets ต้องตรวจแต่ละส่วนแยก เก็บข้อมูลและกฎเดิมที่สำรองไว้ ไม่ล้างข้อมูลเพื่อแก้ deploy
