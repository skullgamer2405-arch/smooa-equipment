/**
 * Google Apps Script: ระบบส่งอีเมลแจ้งเตือน SMO.CRA Equipment
 * 
 * 📌 วิธีติดตั้ง (ทำเพียง 1 ครั้งใน 1 นาที):
 * 1. เปิดเว็บ https://script.google.com/
 * 2. กดปุ่ม "+ โครงการใหม่" (New Project)
 * 3. ลบโค้ดเดิมทั้งหมดออก แล้ววางโค้ดในไฟล์นี้ลงไป
 * 4. เปลี่ยน ADMIN_EMAIL ด้านล่างเป็นอีเมลของคุณ
 * 5. กดปุ่ม "ทำให้ใช้งานได้" (Deploy) ด้านขวาบน -> "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 6. เลือกประเภทเป็น "เว็บแอป" (Web app)
 * 7. ตั้งค่า:
 *    - ดำเนินการในฐานะ: ตัวฉัน (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน (Anyone)  <-- สำคัญมาก!
 * 8. กด "ทำให้ใช้งานได้" (Deploy) -> อนุญาตสิทธิ์การเข้าถึง (Authorize access)
 * 9. คัดลอก "URL เว็บแอป" (Web app URL) ที่ได้ มาใส่ในระบบ SMO Equipment
 */

// ─── การตั้งค่า ──────────────────────────────────────────
const ADMIN_EMAIL = 'skullgamer2405@gmail.com';
const SENDER_NAME = 'สโมสรนักศึกษา SMO.CRA (ระบบยืม-คืนอุปกรณ์)';

function doPost(e) {
  try {
    const jsonString = e.postData.contents;
    const data = JSON.parse(jsonString);
    const action = data.action;

    if (action === 'notify-admin-booking') {
      sendAdminNotification(data);
    } else if (action === 'notify-borrower-approved') {
      sendBorrowerApproval(data);
    } else if (action === 'notify-borrower-rejected') {
      sendBorrowerRejection(data);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('SMO Equipment Mail Service is online ✅');
}

// ─── 1. อีเมลแจ้งเตือนแอดมินเมื่อมีคำขอใหม่ ─────────────────
function sendAdminNotification(data) {
  const subject = `🔔 [คำขอยืมอุปกรณ์ใหม่] ${data.equipmentName || 'อุปกรณ์'} (${data.equipmentCode || '-'}) โดย ${data.fullName || '-'}`;
  
  const htmlBody = `
    <div style="font-family: 'Prompt', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); color: #ffffff; padding: 24px 30px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h2>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">มีคำขอยืมอุปกรณ์ใหม่ในระบบ</p>
      </div>
      <div style="padding: 24px 30px;">
        <h3 style="color: #1a365d; border-bottom: 2px solid #edf2f7; padding-bottom: 8px;">รายละเอียดคำขอยืม</h3>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #718096; width: 35%;">อุปกรณ์:</td><td style="padding: 8px 0; font-weight: bold; color: #2d3748;">${data.equipmentName || '-'} (${data.equipmentCode || '-'})</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">ผู้ยืม:</td><td style="padding: 8px 0; color: #2d3748;">${data.fullName || '-'} (รหัส: ${data.studentId || '-'})</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">อีเมล:</td><td style="padding: 8px 0; color: #2d3748;">${data.applicantEmail || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">เบอร์โทร:</td><td style="padding: 8px 0; color: #2d3748;">${data.applicantPhone || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">คณะ / สาขา:</td><td style="padding: 8px 0; color: #2d3748;">${data.faculty || '-'} / ${data.department || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">ช่วงเวลายืม:</td><td style="padding: 8px 0; color: #2b6cb0; font-weight: bold;">${data.startDate || '-'} ถึง ${data.endDate || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">โครงการ / กิจกรรม:</td><td style="padding: 8px 0; color: #2d3748;">${data.activityName || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">เหตุผลการใช้งาน:</td><td style="padding: 8px 0; color: #2d3748;">${data.reason || '-'}</td></tr>
        </table>
      </div>
      <div style="background: #f7fafc; padding: 16px 30px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7;">
        ส่งโดยระบบอัตโนมัติ SMO.CRA Equipment Lending System
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: subject,
    htmlBody: htmlBody,
    name: SENDER_NAME
  });
}

// ─── 2. อีเมลแจ้งผู้ยืมเมื่อได้รับการ "อนุมัติ" ─────────────────
function sendBorrowerApproval(data) {
  if (!data.applicantEmail) return;

  const subject = `✅ [อนุมัติแล้ว] คำขอยืม ${data.equipmentName || 'อุปกรณ์'} ได้รับการอนุมัติ — SMO.CRA`;

  const htmlBody = `
    <div style="font-family: 'Prompt', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); color: #ffffff; padding: 24px 30px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h2>
        <div style="display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: bold; padding: 4px 14px; border-radius: 9999px; margin-top: 10px;">✅ คำขอได้รับการอนุมัติ</div>
      </div>
      <div style="padding: 24px 30px;">
        <div style="background: #ecfdf5; border: 1px solid #6ee7b7; padding: 16px 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0 0 6px; color: #065f46; font-size: 18px;">คำขอยืมอุปกรณ์ของคุณได้รับการอนุมัติแล้ว! 🎉</h3>
          <p style="margin: 0; color: #047857; font-size: 13px;">สามารถมารับอุปกรณ์ได้ตามวันเวลาที่กำหนด</p>
        </div>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #718096; width: 35%;">ผู้ยืม:</td><td style="padding: 8px 0; font-weight: bold;">${data.fullName || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">อุปกรณ์:</td><td style="padding: 8px 0; color: #065f46; font-weight: bold;">${data.equipmentName || '-'} (${data.equipmentCode || '-'})</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">โครงการ:</td><td style="padding: 8px 0;">${data.activityName || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #718096;">ช่วงเวลายืม:</td><td style="padding: 8px 0; font-weight: bold;">${data.startDate || '-'} ถึง ${data.endDate || '-'}</td></tr>
        </table>
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #78350f; margin-top: 20px;">
          📌 <strong>ข้อควรปฏิบัติ:</strong> กรุณานำบัตรนักศึกษามาแสดงเมื่อรับอุปกรณ์ และส่งคืนอุปกรณ์ตามวันที่กำหนดในสภาพสมบูรณ์
        </div>
      </div>
      <div style="background: #f7fafc; padding: 16px 30px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7;">
        ส่งโดยระบบอัตโนมัติ SMO.CRA Equipment Lending System
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: data.applicantEmail,
    subject: subject,
    htmlBody: htmlBody,
    name: SENDER_NAME
  });
}

// ─── 3. อีเมลแจ้งผู้ยืมเมื่อคำขอถูก "ปฏิเสธ" ─────────────────
function sendBorrowerRejection(data) {
  if (!data.applicantEmail) return;

  const subject = `❌ [ไม่อนุมัติ] คำขอยืม ${data.equipmentName || 'อุปกรณ์'} — SMO.CRA`;

  const htmlBody = `
    <div style="font-family: 'Prompt', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%); color: #ffffff; padding: 24px 30px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์</h2>
        <div style="display: inline-block; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: bold; padding: 4px 14px; border-radius: 9999px; margin-top: 10px;">❌ ไม่อนุมัติคำขอ</div>
      </div>
      <div style="padding: 24px 30px;">
        <div style="background: #fef2f2; border: 1px solid #fca5a5; padding: 16px 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0 0 6px; color: #991b1b; font-size: 18px;">ขออภัย คำขอยืมอุปกรณ์ไม่ได้รับการอนุมัติ</h3>
          <p style="margin: 0; color: #dc2626; font-size: 13px;">คำขอยืม "${data.equipmentName || 'อุปกรณ์'}" ของคุณ ${data.fullName || ''}</p>
        </div>
        ${data.adminNote ? `
        <div style="background: #fffbeb; border-left: 4px solid #eab308; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #713f12; margin-bottom: 16px;">
          📋 <strong>เหตุผลจากแอดมิน:</strong><br>${data.adminNote}
        </div>` : ''}
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #1e40af;">
          💡 <strong>สามารถทำรายการใหม่ได้:</strong> หากมีอุปกรณ์อื่นที่ต้องการ หรือต้องการเปลี่ยนช่วงเวลา สามารถยื่นคำขอใหม่ได้ที่ระบบ SMO Equipment
        </div>
      </div>
      <div style="background: #f7fafc; padding: 16px 30px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7;">
        ส่งโดยระบบอัตโนมัติ SMO.CRA Equipment Lending System
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: data.applicantEmail,
    subject: subject,
    htmlBody: htmlBody,
    name: SENDER_NAME
  });
}
