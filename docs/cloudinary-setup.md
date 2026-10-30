# ตั้งค่าภาพอุปกรณ์ด้วย Cloudinary Free

ภาพใหม่อัปโหลดผ่าน API ของเว็บไป Cloudinary ส่วน Firebase ยังใช้เข้าสู่ระบบและเก็บข้อมูล Firestore คู่มือนี้ยังไม่ได้ยืนยันการเชื่อมต่อบัญชีจริง เจ้าของต้องตั้งค่าและตรวจรับบนระบบทดสอบก่อนเปิดใช้จริง

ส่วน Firebase Storage ใน [คู่มือ PDF เดิม 27 หน้า](../static/manuals/setup-guide-th.pdf) เลิกใช้สำหรับภาพใหม่แล้ว ไม่ต้องทำขั้นตอนสร้าง bucket เปิด Blaze หรือให้สิทธิ์ Storage ตาม PDF ไฟล์ PDF เดิมยังเก็บไว้เป็นเอกสารอ้างอิง

## 1. เตรียมระบบทดสอบ

1. ใช้บัญชี Cloudinary ที่เจ้าของอนุมัติ เตรียม Firebase project แยกที่มีเฉพาะข้อมูลทดสอบ และ Vercel project ทดสอบแยกจากโปรเจกต์หลัก
2. ใน Vercel เปิด project ทดสอบ ตรวจชื่อ project ด้านบนก่อนทุกครั้ง จากนั้นไป Settings เลือก branch ทดสอบเป็น Production Branch ของ project ทดสอบเท่านั้น ไม่เปลี่ยน Production Branch ของ project หลัก
3. ตั้ง environment เป็น **Production ของ project ทดสอบ** สำหรับทดสอบเชื่อมต่อจริง Preview ของโปรเจกต์หลักใช้ demo และบล็อก API จริงเสมอ จึงใช้พิสูจน์ Cloudinary/Firebase/อีเมล/LINE ไม่ได้ อย่าปิด guard นี้
4. ใช้บัญชีแอดมินและผู้รับทดสอบที่เจ้าของอนุมัติ ห้ามนำข้อมูลผู้ยืมจริงเข้าระบบทดสอบ

## 2. สมัครและตรวจแพ็กเกจ Cloudinary

1. เปิด [Cloudinary](https://cloudinary.com/) เลือกสมัครบัญชีและแพ็กเกจ **Free** ยืนยันอีเมลแล้วเข้าสู่ Console ด้วยบัญชีของเจ้าของ
2. เปิดหน้าข้อมูลแผนและ Usage/Quota ของบัญชี ตรวจว่าบัญชีที่เลือกเป็น Free ตรวจพื้นที่เก็บภาพ bandwidth/credits และขนาดภาพสูงสุดที่อัปโหลดได้ ชื่อเมนูอาจเปลี่ยนตาม Console ให้ตรวจค่าจากบัญชีปัจจุบัน
3. ระบบสร้าง PNG ใหม่ฝั่งเซิร์ฟเวอร์ได้ถึง **10 MiB (10,485,760 bytes)** เจ้าของต้องยืนยันว่าแผนปัจจุบันรับขนาดนี้ได้ครบ อย่าใช้เพียงตัวเลข “10 MB” จากหน้าราคาแทนการตรวจข้อจำกัดจริง หากไม่รองรับให้หยุด rollout เพื่อทบทวนขนาดภาพกับผู้ดูแล
4. ไม่เปิด automatic paid upgrade ไม่ผูกบริการเสียเงินแทนเจ้าของ หากหน้าจอขอเปลี่ยนแผนหรือชำระเงินให้หยุดและให้เจ้าของตัดสินใจ Free ไม่มี uptime SLA ที่รับประกันบริการ ตรวจโควตาเป็นระยะและเตรียมรับกรณีอัปโหลดไม่พร้อม

## 3. คัดลอกค่าจาก Console ไป Vercel

1. ใน Cloudinary Console เลือก product environment ที่จะใช้ เปิด Settings แล้วหา API Keys (บางหน้ามีทางเข้าจาก Dashboard)
2. จด **Cloud name** และเลือก API key ของ product environment เดียวกัน เปิดดู **API secret** เฉพาะเวลาที่จะคัดลอก
3. เปิด Vercel ในอีกแท็บ เลือก project เป้าหมาย ตรวจชื่ออีกครั้ง ไป **Settings → Environment Variables → Add** เลือก **Production** ของ project นั้น และ scope เฉพาะ service **`api`** เพิ่มทีละค่า:

| ชื่อตัวแปร | ค่าที่คัดลอก | ชนิด | service |
| --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloud name | Config | `api` เท่านั้น |
| `CLOUDINARY_API_KEY` | API key | Secret | `api` เท่านั้น |
| `CLOUDINARY_API_SECRET` | API secret | Secret | `api` เท่านั้น |

4. บันทึกค่าโดยคัดลอกจาก Console ลง Vercel โดยตรง หากหน้าจอมี Sensitive ให้เปิดสำหรับ Secret ไม่ส่งค่าในแชต ไม่ใส่ใน Git หรือภาพหน้าจอ และไม่ใส่ทั้งสามค่าใน `app` หรือชื่อที่ขึ้นต้น `VITE_`
5. ไม่ต้องสร้าง unsigned upload preset เบราว์เซอร์ไม่ใช้ Cloudinary credentials และไม่อัปโหลดตรงไป Cloudinary API ของเว็บเป็นผู้ลงลายเซ็นและส่งภาพไป endpoint ประเภท image/upload ที่กำหนดไว้แล้ว จึงไม่ต้องขยาย CSP เพื่อเปิด Cloudinary API ให้เบราว์เซอร์
6. กลับไป Deployments แล้ว Redeploy **Production ของ project ทดสอบ** หลังตั้งค่าครบ การเปลี่ยน environment จะยังไม่แก้ deployment เก่าที่ทำงานอยู่

## 4. ตั้ง Firebase และช่องทางแจ้งเตือนที่ยังจำเป็น

Cloudinary แทนที่การเก็บภาพใหม่เท่านั้น การเข้าสู่ระบบ สิทธิ์แอดมิน Firestore อีเมลและ LINE ยังต้องตั้งตาม [คู่มือเปิดใช้งานจริง](production-setup.md)

1. Firebase Console เลือก project ทดสอบ ไป **Project settings → General → Your apps → Web app → Config** นำ `apiKey`, `authDomain`, `projectId`, `appId` ใส่ `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` ตามลำดับ ทั้งสี่เป็น **Config สาธารณะ ไม่ใช่ Secret** ให้ `app` ใช้ตอน build และ `api` ใช้ตรวจ project ค่า `VITE_FIREBASE_STORAGE_BUCKET` เป็น Config ทางเลือก จะคงไว้หรือเว้นว่างได้ ส่วน `FIREBASE_STORAGE_BUCKET` เดิมไม่ถูกใช้แล้ว
2. ให้ผู้ดูแล Google Cloud เปิด **IAM & Admin → Service Accounts → Create service account** ของ project เดียวกัน ให้เฉพาะ **Cloud Datastore User** และ **Firebase Authentication Viewer** ไม่ต้องให้ Storage role หรือ Owner/Editor แก่ API runtime
3. เลือก service account นั้น เปิด **Keys → Add key → Create new key → JSON** ดาวน์โหลดไฟล์ลงเครื่องที่เจ้าของควบคุม เก็บนอก repository เปิดไฟล์ด้วย editor บนเครื่อง แล้วคัดลอก JSON ทั้งก้อนไป Vercel ตัวแปร `FIREBASE_SERVICE_ACCOUNT_JSON` ชนิด **Secret**, Production, scope เฉพาะ `api` เก็บไฟล์ต้นฉบับตามนโยบายกุญแจขององค์กร ห้ามส่ง JSON หรือ private key ในแชต/Git/ภาพหน้าจอ หากองค์กรห้ามสร้าง key ให้ผู้ดูแลสิทธิ์จัดเตรียมตามนโยบาย ไม่ข้ามข้อจำกัดเอง
4. เปิด Email/Password และเพิ่ม hostname เว็บทดสอบใน Authentication Authorized domains บัญชีแอดมินต้องยืนยันอีเมลและมี custom claim `admin=true` ให้ operator จัดการ claim ตามคู่มือ Production; runtime แบบ Viewer ไม่มีหน้าที่เพิ่มสิทธิ์ผู้ใช้
5. ตั้ง Gmail SMTP/App Password, ผู้รับแจ้งเตือน, `PUBLIC_APP_URL` และ LINE Login/LIFF/Messaging API/cron ตามคู่มือเดิมให้ครบ ค่าลับเหล่านี้ยังเป็นเงื่อนไขก่อนปล่อย Production การผ่าน release check ยืนยันเพียงการตั้งค่าตามรูปแบบ ไม่ยืนยันการส่งจริง

## ขนาดภาพและภาพเดิม

เลือกไฟล์ PNG, JPEG หรือ WebP ต้นฉบับได้ไม่เกิน **10 MiB**, กว้างและสูงด้านละไม่เกิน **4096 px** และรวมไม่เกิน **16 ล้านพิกเซล** เบราว์เซอร์แปลงเป็น PNG และลดขนาดภาพจนส่งเข้า API ได้ไม่เกิน **3 MiB** API `/api/upload-image` เดิมตรวจ PNG อย่างเข้มงวด แล้วสร้าง canonical PNG ใหม่ไม่เกิน **10 MiB** ก่อนอัปโหลด ดังนั้นไฟล์ต้นฉบับกับไฟล์ส่งเข้า API มีข้อจำกัดต่างกัน

ค่า `imageUrl` เดิม URL aliases และ route `/uploads/*` ยังคงอยู่ ไม่มีการย้ายหรือลบภาพอัตโนมัติ แต่ `.vercelignore` ตัดไฟล์ uploads เก่าออกจาก deployment จึงรับประกันไม่ได้ว่า `/uploads` มีไฟล์บน Vercel เจ้าของต้องเปิดตรวจภาพจากแหล่งเดิมที่ใช้อยู่ให้ได้ก่อน rollout หากต้องย้ายภาพ ให้จัดทำงานย้ายแยกพร้อมสำรองและตรวจ URL ก่อนแก้ข้อมูล

## แก้ปัญหาเบื้องต้น

| อาการ | ตรวจและแก้ |
| --- | --- |
| Build แจ้ง missing config | ตรวจชื่อ env, project, Production และ scope ของ service ให้ตรง คู่ key/secret ต้องมาจาก Cloudinary environment เดียวกัน Firebase project ฝั่งเว็บและ API ต้องตรงกัน ตั้งค่าครบแล้ว Redeploy ไม่ปิด release guard |
| อัปโหลดตอบ 503 | ตรวจ Cloudinary ทั้งสามค่าและ Firebase JSON ใน `api` ตรวจสิทธิ์บัญชีและ Usage/Quota ใน Console ตรวจ runtime log โดยไม่เผย secrets บริการภายนอกหรือโควตาอาจไม่พร้อม อย่ากดส่งซ้ำรัว ๆ |
| ตอบ 413 | ไฟล์ส่งเข้า API ใหญ่เกิน 3 MiB แม้ต้นฉบับยังไม่เกิน 10 MiB ใช้หน้าอัปโหลดปัจจุบันให้เตรียมภาพ หรือลดความละเอียดต้นฉบับแล้วเลือกใหม่ |
| Preview ตอบ 403 | เป็น guard ป้องกัน API จริงตามที่ออกแบบ ใช้ Preview ตรวจ UI ส่วนเชื่อมต่อจริงใช้ Production ของ project ทดสอบแยก |
| Production ตอบ 403 | ตรวจว่าเข้าสู่ระบบด้วยแอดมินที่ยืนยันอีเมลและมี `admin=true` แล้ว ออกและเข้าใหม่หลังเปลี่ยน claim อย่าเพิ่มสิทธิ์ Storage เพื่อแก้ |
| โควตา Cloudinary เต็ม/ขออัปเกรด | หยุดอัปโหลด ตรวจ Usage และแผนกับเจ้าของ ไม่เปิดอัปเกรดอัตโนมัติ ไม่ลบภาพเดิมเพื่อคืนโควตาโดยไม่ได้วางแผน |
| ภาพเก่าไม่ขึ้น | เปิด URL เดิมโดยตรง ตรวจต้นทางและ `/uploads` ที่ไม่ได้บรรจุใน Vercel อย่าสรุปว่าภาพย้ายไป Cloudinary แล้ว |

## ตรวจรับก่อนเปิดใช้จริง

ให้เจ้าของบันทึกผลบน Production ของ project ทดสอบแยกด้วยข้อมูล fixture และบัญชีที่อนุมัติ การตรวจนี้มีการใช้งานโควตาจริง ทำเมื่อยืนยันว่าอยู่ในแผน Free และโควตาที่มีเท่านั้น ไม่ทำการทดสอบที่ต้องจ่ายเงิน

- ล็อกอินแอดมิน Firebase ที่ยืนยันอีเมลและมี claim ได้ บัญชีทั่วไปหรือยังไม่ยืนยันอีเมลถูกปฏิเสธ
- เพิ่มอุปกรณ์และอัปโหลดภาพใหม่ บันทึกแล้ว reload ภาพยังอยู่ เปิด URL ภาพ HTTPS ได้
- เปลี่ยนภาพในรายการเดิม บันทึกและ reload อีกครั้ง รายการอ้างภาพใหม่ ไม่มีการลบภาพเก่าอัตโนมัติ
- ตรวจ catalog หน้ารายละเอียดและภาพเดิมที่ยังใช้ รวมถึง fallback เมื่อภาพโหลดไม่ได้บนมือถือ
- ส่งคำขอทดสอบและตรวจอีเมลแจ้งผู้ดูแล อนุมัติ/ปฏิเสธแล้วอีเมลถึงผู้รับทดสอบที่ถูกต้อง
- เปิด LIFF/Rich Menu ทดสอบการผูกบัญชี LINE และข้อความอนุมัติ/เตือนคืนตามคู่มือ LINE ไม่ใช้ข้อมูลหรือผู้รับจริง
- ตรวจ Usage หลังทดสอบและยืนยันไม่มี paid upgrade จากนั้นให้เจ้าของตรวจรายการ Production ทั้งหมดก่อนเปิดโปรเจกต์หลัก ใช้ env ของโปรเจกต์หลักและ Redeploy แยกจากระบบทดสอบ

ผล unit/API/browser แบบ fixtures และ release check ไม่ยืนยันว่า Cloudinary, Firebase, Gmail หรือ LINE ของเจ้าของเชื่อมต่อได้จริง
