import { createHmac, randomUUID } from "node:crypto";
import { ApiError, documentId } from "./http.mjs";
import { asDay } from "../shared/calendar.js";
import { validEmail, validWebhook } from "../shared/notification-config.js";
export { validWebhook };

export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function adminUrl(env) {
  try {
    const url = new URL(env.PUBLIC_APP_URL || "");
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return new URL("/admin.html", url).href;
  } catch { return ""; }
}
export function createNotifications({ db, transport, env = process.env, request = fetch, now = () => new Date() }) {
  const settingsRef = db.collection("settings").doc("notifications");
  async function settings() {
    const snap = await settingsRef.get();
    const webhookUrl = snap.data()?.webhookUrl ?? env.APPS_SCRIPT_WEBHOOK_URL ?? "";
    const webhookReady = (env.APPS_SCRIPT_SHARED_SECRET?.length || 0) >= 32;
    const adminEmail = env.ADMIN_NOTIFICATION_EMAIL?.trim() || "";
    const issues = [];
    if (!validEmail(adminEmail)) issues.push("ตั้งค่า ADMIN_NOTIFICATION_EMAIL เป็นอีเมลผู้ดูแลหนึ่งที่อยู่ใน Vercel");
    if (webhookUrl) {
      if (!validWebhook(webhookUrl) || !webhookReady) issues.push("ตรวจ URL ของ Apps Script และ APPS_SCRIPT_SHARED_SECRET อย่างน้อย 32 ตัวอักษร");
    } else if (!transport) issues.push("ตั้งค่า SMTP_HOST, SMTP_PORT, SMTP_USER และ SMTP_PASS ใน Vercel");
    return { webhookUrl, smtpConfigured: Boolean(transport), webhookReady, adminEmail,
      provider: webhookUrl ? "apps_script" : transport ? "smtp" : "none",
      adminUrl: adminUrl(env), ready: issues.length === 0, issues };
  }
  async function configure(url) {
    if (typeof url !== "string" || !validWebhook(url)) throw new ApiError(400, "กรุณาใช้ URL Web App ของ Google Apps Script แบบ HTTPS");
    if (url && (env.APPS_SCRIPT_SHARED_SECRET?.length || 0) < 32) throw new ApiError(503, "ตั้งค่า secret ของ Apps Script ฝั่งเซิร์ฟเวอร์อย่างน้อย 32 ตัวอักษรก่อนใช้งาน");
    await settingsRef.set({ webhookUrl: url });
  }
  async function dispatch(bookingId, kind) {
    documentId.parse(bookingId);
    if (!["pending", "approved", "rejected"].includes(kind)) throw new ApiError(400, "ชนิดแจ้งเตือนไม่ถูกต้อง");
    const snap = await db.collection("bookings").doc(bookingId).get();
    if (!snap.exists || snap.data().status !== kind) throw new ApiError(409, "สถานะคำขอไม่ตรงกับการแจ้งเตือน");
    const booking = snap.data();
    return send({ ...booking, bookingId }, kind, bookingId + "_" + kind);
  }
  async function send(booking, kind, jobId) {
    const config = await settings();
    if (!transport && !config.webhookUrl) return { success: true, deliveredToSMTP: false, notification: "not_configured" };
    const to = kind === "pending" ? config.adminEmail : booking.applicantEmail;
    if (!validEmail(to)) throw new ApiError(503, "ยังไม่ได้ตั้งค่าอีเมลผู้รับที่ถูกต้อง");
    const job = db.collection("emailNotifications").doc(jobId);
    const claimed = await db.runTransaction(async (tx) => {
      const existing = await tx.get(job);
      if (existing.exists) return false;
      tx.create(job, { bookingId: booking.bookingId, kind, status: "sending", createdAt: now() });
      return true;
    });
    if (!claimed) return { success: true, deliveredToSMTP: false, notification: "already_queued" };
    const label = { pending: "ได้รับคำขอยืมใหม่", approved: "คำขอยืมได้รับอนุมัติ", rejected: "คำขอยืมไม่ได้รับอนุมัติ" }[kind];
    const subject = `[SMO.CRA] ${label} — ${booking.equipmentName}`.replace(/[\r\n]/g, " ");
    const days = booking.startDate && booking.endDate ? `<p>วันยืม–คืน (เวลาไทย): ${escapeHtml(asDay(booking.startDate))} – ${escapeHtml(asDay(booking.endDate))}</p>` : "";
    const action = kind === "pending" && config.adminUrl
      ? `<p><a href="${escapeHtml(config.adminUrl)}">เปิดหน้าผู้ดูแลเพื่อตรวจคำขอ</a></p><p>เข้าสู่ระบบก่อนค้นหารหัสคำขอด้านบน การเปิดลิงก์ยังไม่อนุมัติคำขอ</p>` : "";
    const html = `<html lang="th"><body style="font-family:Tahoma,sans-serif;color:#173459"><h1>${label}</h1><p>อุปกรณ์: ${escapeHtml(booking.equipmentName)}</p><p>รหัส: ${escapeHtml(booking.assetCode)}</p><p>ผู้ยืม: ${escapeHtml(booking.fullName)}</p><p>กิจกรรม: ${escapeHtml(booking.activityName)}</p>${days}<p>หมายเหตุ: ${escapeHtml(booking.adminNote || "—")}</p><p>รหัสคำขอ: ${escapeHtml(booking.bookingId)}</p>${action}<p>ดูรายละเอียดจากเว็บ SMO OA หรือติดต่อผู้ดูแลตามช่องทางที่ตกลงกัน</p></body></html>`;
    const text = [label, `อุปกรณ์: ${booking.equipmentName}`, `รหัส: ${booking.assetCode || "—"}`, `ผู้ยืม: ${booking.fullName}`, `กิจกรรม: ${booking.activityName || "—"}`, booking.startDate && booking.endDate ? `วันยืม–คืน (เวลาไทย): ${asDay(booking.startDate)} – ${asDay(booking.endDate)}` : "", `หมายเหตุ: ${booking.adminNote || "—"}`, `รหัสคำขอ: ${booking.bookingId}`, kind === "pending" && config.adminUrl ? `ตรวจคำขอ (ต้องเข้าสู่ระบบ): ${config.adminUrl}` : ""].filter(Boolean).join("\n");
    try {
      if (config.webhookUrl) {
        if (!validWebhook(config.webhookUrl) || !config.webhookReady) throw Error("WEBHOOK_NOT_CONFIGURED");
        const payload = JSON.stringify({ to, subject, html, bookingId: booking.bookingId, kind, requestId: jobId, timestamp: +now() });
        const signature = createHmac("sha256", env.APPS_SCRIPT_SHARED_SECRET).update(payload).digest("hex");
        const response = await request(config.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, signature }), signal: AbortSignal.timeout(10000) });
        if (!response.ok || (await response.json()).success !== true) throw Error("WEBHOOK_NOT_ACCEPTED");
      } else {
        const result = await transport.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, html, text, disableFileAccess: true, disableUrlAccess: true });
        if (result?.rejected?.length || (Array.isArray(result?.accepted) && !result.accepted.length)) throw Error("SMTP_NOT_ACCEPTED");
      }
      await job.update({ status: "sent", acceptedAt: now() });
      return { success: true, deliveredToSMTP: !config.webhookUrl, notification: "accepted" };
    } catch {
      // A provider may have accepted before the response was lost. Never resend blindly.
      await job.update({ status: "needs_review", checkedAt: now() });
      return { success: true, deliveredToSMTP: false, notification: "needs_review" };
    }
  }
  async function test() {
    const config = await settings();
    if (!config.ready) throw new ApiError(503, config.issues.join(" · "));
    return send({ bookingId: "test-" + randomUUID(), equipmentName: "ทดสอบการแจ้งเตือน", fullName: "ผู้ดูแลระบบ", assetCode: "TEST", activityName: "ตรวจการตั้งค่า" }, "pending", "test-" + randomUUID());
  }
  return { settings, configure, dispatch, test };
}
