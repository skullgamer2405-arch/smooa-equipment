/**
 * email-service.js
 * ระบบจัดการส่งอีเมลแจ้งเตือนแบบ Serverless (ฟรี 100% ไม่ต้องใช้ Cloud Run)
 * รองรับ:
 *   1. Google Apps Script Web App (แนะนำ - ฟรี 100 ฉบับ/วัน ส่งจาก Gmail โดยตรง)
 *   2. Custom Backend /api/... (fallback หากมีเซิร์ฟเวอร์)
 */

// URL ของ Google Apps Script Web App
// แอดมินสามารถนำ URL ที่ได้จาก Google Apps Script มาใส่ที่นี่ หรือตั้งค่าผ่านหน้า Admin Settings
export const DEFAULT_EMAIL_WEBHOOK_URL = '';

/**
 * ดึง URL ของ Webhook ที่ตั้งค่าไว้ (จาก localStorage หรือค่า default)
 */
export function getEmailWebhookUrl() {
  return localStorage.getItem('smo_email_webhook_url') || DEFAULT_EMAIL_WEBHOOK_URL;
}

/**
 * บันทึก URL ของ Webhook
 */
export function setEmailWebhookUrl(url) {
  if (url) {
    localStorage.setItem('smo_email_webhook_url', url.trim());
  } else {
    localStorage.removeItem('smo_email_webhook_url');
  }
}

/**
 * ส่งอีเมลแจ้งเตือน Admin เมื่อมีคำขอยืมใหม่
 */
export async function sendAdminBookingNotification(data) {
  const webhookUrl = getEmailWebhookUrl();
  const payload = {
    action: 'notify-admin-booking',
    ...data
  };

  try {
    if (webhookUrl) {
      // ยิงตรงไปที่ Google Apps Script Web App (โหมด no-cors หรือ cors)
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Google Apps Script รับ text/plain เพื่อเลี่ยง preflight CORS
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      console.log('[EmailService] Sent admin notification via Webhook');
      return { success: true };
    } else {
      // Fallback ไปยัง local/backend endpoint
      const res = await fetch('/api/notify-admin-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
  } catch (err) {
    console.warn('[EmailService] Failed to send admin notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * ส่งอีเมลแจ้งเตือนผู้ยืมเมื่อคำขอได้รับการ "อนุมัติ"
 */
export async function sendBorrowerApprovalNotification(data) {
  const webhookUrl = getEmailWebhookUrl();
  const payload = {
    action: 'notify-borrower-approved',
    ...data
  };

  try {
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      console.log('[EmailService] Sent approval notification via Webhook');
      return { success: true };
    } else {
      const res = await fetch('/api/notify-borrower-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
  } catch (err) {
    console.warn('[EmailService] Failed to send approval notification:', err);
    return { success: false, error: err.message };
  }
}

/**
 * ส่งอีเมลแจ้งเตือนผู้ยืมเมื่อคำขอถูก "ปฏิเสธ"
 */
export async function sendBorrowerRejectionNotification(data) {
  const webhookUrl = getEmailWebhookUrl();
  const payload = {
    action: 'notify-borrower-rejected',
    ...data
  };

  try {
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      console.log('[EmailService] Sent rejection notification via Webhook');
      return { success: true };
    } else {
      const res = await fetch('/api/notify-borrower-rejected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
  } catch (err) {
    console.warn('[EmailService] Failed to send rejection notification:', err);
    return { success: false, error: err.message };
  }
}
