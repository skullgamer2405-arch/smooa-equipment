# การนำ UI และการป้องกันข้อมูลขึ้นใช้งานจริง

สถานะ: โค้ดใน branch สำหรับตรวจทาน ยังไม่เปิดบริการ production และยังไม่ได้ทดสอบกับข้อมูลผู้ยืมจริง เอกสารนี้เป็นลำดับการตรวจและย้ายข้อมูลสำหรับผู้ดูแลระบบ ไม่ใช่คำสั่งให้รันกับ production โดยอัตโนมัติ

## สิ่งที่เปลี่ยน

ผู้ยืมค้นหาอุปกรณ์จากหน้าแรก ส่งคำขอในฟอร์มหน้าเดียว ร่างแบบฟอร์มอยู่ใน `sessionStorage` 24 ชั่วโมงและคง `requestId` เดิมเมื่อโหลดหน้าใหม่ ระบบไม่เก็บ LINE token ในร่าง แบบฟอร์มแสดงสถานะรออนุมัติและใบรับคำขอ หน้ารายการของฉันใช้ LINE ID token ที่เซิร์ฟเวอร์ตรวจซ้ำกับ LINE แล้วคืนเฉพาะรายการที่ `lineBookingRecipients.userId` ตรงกัน คำขอเก่าที่ไม่มี mapping ไม่ถูกจับคู่จากชื่อหรืออีเมล

`bookings` เป็นข้อมูลส่วนตัวของผู้ดูแล ปฏิทินสาธารณะอ่านเฉพาะ `publicCalendar` ที่มีรหัสอุปกรณ์ ชื่ออุปกรณ์ วันยืมคืน และสถานะ ไม่มีชื่อผู้ยืม เบอร์ อีเมล หรือกิจกรรม ผู้ดูแลต้องมี Firebase custom claim `admin=true` และอีเมลยืนยันแล้วทั้งใน Firestore rules, Storage rules, API และหน้าแอดมิน การอัปโหลดภาพใช้ API ผู้ดูแล ภาพ PNG/JPEG/WebP ถูกแปลงเป็น PNG ในเบราว์เซอร์ จากนั้น API ตรวจ PNG อย่างเข้มงวดและสร้าง PNG ใหม่ก่อนส่งจากเซิร์ฟเวอร์ไป Cloudinary โดยไม่เชื่อ MIME หรือชื่อไฟล์ การแจ้งเตือนใช้อีเมลปลายทางจาก booking ที่บันทึกไว้ มีงานส่งแบบ dedup และแสดง `needs_review` เมื่อผลส่งไม่ชัดเจน

## ก่อนสลับ production

1. สำรอง Firestore และภาพเดิมที่ยังใช้งาน ตรวจ project ID กับเจ้าของระบบและแยก test project จาก production อย่านำข้อมูลผู้ยืมจริงเข้าการทดสอบ
2. ตั้ง Cloudinary Free ตาม [คู่มือภาพอุปกรณ์](../cloudinary-setup.md) ใน Production ของ Vercel project ทดสอบแยก ใช้ Firebase fixture แยกและบัญชีที่เจ้าของอนุมัติ `CLOUDINARY_CLOUD_NAME` เป็น Config ส่วน API key/secret เป็น Secret เฉพาะ `api` พร้อม `FIREBASE_SERVICE_ACCOUNT_JSON` ที่ยังต้องใช้กับ Firestore/Auth (Cloud Datastore User และ Firebase Authentication Viewer เท่านั้น) ไม่ต้องสร้าง Storage bucket ให้สิทธิ์ Storage หรือเปิด Blaze ค่า `FIREBASE_STORAGE_BUCKET` เลิกใช้แล้ว ตรวจ URL เดิมและ `/uploads/*` จากแหล่งเดิมก่อน rollout เพราะไฟล์เก่าถูกตัดออกจาก Vercel และไม่มีการย้ายหรือลบอัตโนมัติ
3. ให้สิทธิ์ admin เฉพาะ UID ที่เจ้าของยืนยันแล้ว: `node scripts/admin-claim.mjs --project PROJECT --uid UID` เป็น dry run; เมื่อพร้อมจึงใช้ `--apply` ในขั้นตอน deploy ที่มีสิทธิ์จริง บัญชีต้องยืนยันอีเมลแล้ว หลังตั้ง claim ให้ออกและเข้าระบบใหม่เพื่อรับ ID token ใหม่
4. Deploy `firestore.indexes.json` แล้วรอ index พร้อม ตรวจ index สำหรับคำขอ, ปฏิทินสาธารณะ และ LINE recipient ผ่าน project ทดสอบก่อน คิว `submissionLimits` มี `expiresAt`; ตั้ง Firestore TTL policy ภายหลังเพื่อลบเอกสารเก่า
5. ตรวจ booking วันยืมคืนและสถานะในข้อมูลเดิม ทำ dry run ของ `node scripts/project-public-calendar.mjs --project PROJECT` แล้วค่อย `--apply` บน project ที่สำรองแล้ว ตรวจ sample ว่า projection ไม่มีข้อมูลส่วนตัวและจำนวนรายการอนุมัติตรงก่อนเปิดปฏิทินใหม่
6. ตั้ง `APPS_SCRIPT_SHARED_SECRET` ยาวอย่างน้อย 32 ตัวใน API และ `SMO_WEBHOOK_SECRET` ค่าเดียวกันใน Google Apps Script Properties ก่อนเปิด URL Web App; หรือใช้ SMTP ที่ตั้งค่าไว้ ระบบ Apps Script ปฏิเสธ payload ที่ไม่มีลายเซ็น ถ้าผลส่งไม่แน่นอนให้ตรวจงาน `needs_review` ก่อนตัดสินใจส่งใหม่ งานส่งที่จองสิทธิ์แล้วจะไม่ส่งซ้ำอัตโนมัติ
7. ตั้ง LINE Login/LIFF กับ Messaging API ตาม `docs/line-oa-setup.md` และตรวจ OAuth, เพื่อน OA, แจ้งอนุมัติ, เตือนวันก่อนครบและวันครบกำหนดช่วง 09:00–09:59 น. เวลาไทยด้วยบัญชีทดสอบเท่านั้น อย่าเปิด `LINE_ENABLED=true` จนตรวจครบ
8. ตรวจ Firebase rules ใน emulator/project ทดสอบก่อน deploy: บุคคลทั่วไปอ่าน `equipment`, `calendarEntries`, `publicCalendar` ได้ แต่ถูกปฏิเสธ `bookings`, mapping LINE และ settings; admin ที่ไม่มี claim หรือยังไม่ยืนยันอีเมลต้องถูกปฏิเสธทั้ง API และ Firestore
9. ทดสอบ `/api/*` same-origin บนโดเมนจริงหรือ Staging พร้อม Firebase Admin และ LIFF origin ตรงกัน Vercel services ใน `vercel.json` ต่อ `app` กับ `api` ผ่าน public rewrite อยู่แล้ว Firebase Hosting config ปัจจุบันเสิร์ฟ frontend เท่านั้น; ต้องมี same-origin API routing แยกก่อนใช้เป็นโดเมนจริงของ workflow นี้

เจ้าของเลือก Vercel เป็นเว็บทางการแล้ว CI จึงตรวจโค้ดและ rules emulator โดยไม่ deploy Firebase Hosting อัตโนมัติ ใช้คู่มือ `docs/production-setup.md` สำหรับการตั้งค่าและเปิด Production อย่าสลับไป legacy Hosting หรือ rules เพื่อให้ขั้นตอนผ่าน

Preview บน Vercel ใช้ข้อมูลจำลองและบล็อก API จริงโดยตั้งใจ จึงใช้ตรวจ UI และการนำทางได้ แต่พิสูจน์การเข้าสู่ระบบ Firebase, rules, Cloudinary, อีเมล หรือ LINE จริงไม่ได้ การทดสอบอัตโนมัติใน checkout นี้รันใน container ปิดเครือข่ายและใช้ fixtures; รอบ hardening นี้เพิ่มและทดสอบ Firestore/Storage rules กับ emulator แล้ว แต่ยังต้องตรวจนโยบายที่ deploy จริงและ staging ที่ไม่ใช้ข้อมูลจริงก่อนขึ้น production

ตรวจรับด้วยแอดมินที่ยืนยันอีเมลแล้ว: อัปโหลดภาพใหม่ เปลี่ยนภาพ บันทึกและโหลดหน้าใหม่ ตรวจ catalog และ fallback เมื่อภาพโหลดไม่ได้ ตาม checklist ในคู่มือ Cloudinary รวมถึงอีเมลและ LINE ก่อนเปิดใช้จริง โควตา/ขนาดไฟล์ของ Free ต้องให้เจ้าของตรวจจากบัญชีปัจจุบัน ไม่เปิด paid upgrade อัตโนมัติและไม่มีการรับประกัน uptime SLA ของ Free ส่วน Storage ใน [PDF เดิม 27 หน้า](../../static/manuals/setup-guide-th.pdf) เลิกใช้สำหรับภาพใหม่แล้ว
