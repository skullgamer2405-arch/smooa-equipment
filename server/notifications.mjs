import { createHmac, randomUUID } from "node:crypto";
import { ApiError, documentId } from "./http.mjs";
import { asDay } from "../shared/calendar.js";

export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const validWebhook = (url) => !url || /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
export function createNotifications({ db, transport, env = process.env, request = fetch, now = () => new Date() }) {
  const settingsRef = db.collection("settings").doc("notifications");
  async function settings() {
    const snap = await settingsRef.get();
    return { webhookUrl: snap.data()?.webhookUrl || "", smtpConfigured: Boolean(transport), webhookReady: (env.APPS_SCRIPT_SHARED_SECRET?.length || 0) >= 32 };
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
    const to = kind === "pending" ? env.ADMIN_NOTIFICATION_EMAIL : booking.applicantEmail;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ApiError(503, "ยังไม่ได้ตั้งค่าอีเมลผู้รับที่ถูกต้อง");
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
    const html = `<html lang="th"><body style="font-family:Tahoma,sans-serif;color:#173459"><h1>${label}</h1><p>อุปกรณ์: ${escapeHtml(booking.equipmentName)}</p><p>รหัส: ${escapeHtml(booking.assetCode)}</p><p>ผู้ยืม: ${escapeHtml(booking.fullName)}</p><p>กิจกรรม: ${escapeHtml(booking.activityName)}</p>${days}<p>หมายเหตุ: ${escapeHtml(booking.adminNote || "—")}</p><p>รหัสคำขอ: ${escapeHtml(booking.bookingId)}</p><p>ดูรายละเอียดจากเว็บ SMO OA หรือติดต่อผู้ดูแลตามช่องทางที่ตกลงกัน</p></body></html>`;
    try {
      if (config.webhookUrl) {
        if (!validWebhook(config.webhookUrl) || !config.webhookReady) throw Error("WEBHOOK_NOT_CONFIGURED");
        const payload = JSON.stringify({ to, subject, html, bookingId: booking.bookingId, kind, requestId: jobId, timestamp: +now() });
        const signature = createHmac("sha256", env.APPS_SCRIPT_SHARED_SECRET).update(payload).digest("hex");
        const response = await request(config.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload, signature }), signal: AbortSignal.timeout(10000) });
        if (!response.ok || (await response.json()).success !== true) throw Error("WEBHOOK_NOT_ACCEPTED");
      } else {
        await transport.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, html });
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
    return send({ bookingId: "test-" + randomUUID(), equipmentName: "ทดสอบการแจ้งเตือน", fullName: "ผู้ดูแลระบบ", assetCode: "TEST", activityName: "ตรวจการตั้งค่า" }, "pending", "test-" + randomUUID());
  }
  return { settings, configure, dispatch, test };
}
