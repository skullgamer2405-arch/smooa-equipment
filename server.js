import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import nodemailer from "nodemailer";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createLineRouter, createLineService } from "./server/line.mjs";
import { createBookingService } from "./server/bookings.mjs";
import { createNotifications } from "./server/notifications.mjs";
import { storeImage } from "./server/images.mjs";
import { bangkokDay } from "./shared/booking-schema.js";
import { adminGuard, handle, apiError, ApiError, documentId } from "./server/http.mjs";

function firebase(env) {
  if (getApps().length) return getApps()[0];
  try {
    const json = env.FIREBASE_SERVICE_ACCOUNT_JSON || (env.FIREBASE_SERVICE_ACCOUNT_JSON_B64 ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf8") : "");
    if (json) return initializeApp({ credential: cert(JSON.parse(json)), storageBucket: env.FIREBASE_STORAGE_BUCKET });
    if (env.GOOGLE_APPLICATION_CREDENTIALS || env.FIREBASE_USE_ADC === "true") return initializeApp({ storageBucket: env.FIREBASE_STORAGE_BUCKET });
  } catch { /* fail closed, without exposing credential diagnostics */ }
  throw new ApiError(503, "ยังไม่ได้ตั้งค่าบริการ Firebase ฝั่งเซิร์ฟเวอร์");
}
function mailTransport(env) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === "true" || env.SMTP_PORT === "465", auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
}
export function createApp({ env = process.env, getDb = () => { firebase(env); return getFirestore(); }, verifyAdmin = async (token) => { const app = firebase(env); const { getAuth } = await import("firebase-admin/auth"); return getAuth(app).verifyIdToken(token, true); }, bucket = async () => { const app = firebase(env); const { getStorage } = await import("firebase-admin/storage"); return getStorage(app).bucket(env.FIREBASE_STORAGE_BUCKET); }, transport, request = fetch, now = () => new Date() } = {}) {
  const app = express();
  app.disable("x-powered-by");
  const root = path.dirname(fileURLToPath(import.meta.url));
  const demo = env.VERCEL_ENV === "preview" || env.SMO_DEMO_MODE === "true" || env.VITE_DEMO_MODE === "true";
  if (demo) app.use(["/api", "/uploads"], (_req, res) => res.status(403).json({ success: false, code: "DEMO_MODE", message: "โหมดตัวอย่างใช้ข้อมูลจำลองและปิด API จริง" }));
  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use(express.json({ limit: "16kb" }));
  const guard = adminGuard(verifyAdmin);
  const bookings = () => createBookingService({ db: getDb(), now });
  const line = () => createLineService({ db: getDb(), env, request, now });
  const notifications = () => createNotifications({ db: getDb(), env, request, now, transport: transport === undefined ? mailTransport(env) : transport });
  const notice = async (bookingId, kind) => { try { return await notifications().dispatch(bookingId, kind); } catch { return { success: true, deliveredToSMTP: false, notification: "needs_review" }; } };
  app.use("/api/line", createLineRouter({ getDb, verifyAdmin, env, request, now, onBooking: (id) => notice(id, "pending") }));
  app.post("/api/bookings", handle(async (req, res) => {
    const bookingId = await bookings().create(req.body, req.ip || "unknown");
    res.json({ success: true, bookingId, ...(await notice(bookingId, "pending")) });
  }));
  app.get("/api/public/calendar", handle(async (req, res) => res.json(await bookings().calendar(req.query))));
  app.get("/api/public/equipment-summary", handle(async (_req, res) => {
    const db = getDb();
    const results = await Promise.all(["all", "available", "unavailable", "maintenance"].map(async (status) => {
      let q = db.collection("equipment");
      if (status !== "all") q = q.where("status", "==", status);
      return [status, (await q.count().get()).data().count];
    }));
    res.json(Object.fromEntries(results));
  }));
  app.use("/api/admin", guard);
  app.get("/api/admin/booking-summary", handle(async (_req, res) => {
    const collection = getDb().collection("bookings"), midnight = new Date(bangkokDay(now()) + "T00:00:00+07:00");
    const queries = { pending: collection.where("status", "==", "pending"), approved: collection.where("status", "==", "approved"), due: collection.where("status", "==", "approved").where("endDate", ">=", midnight).where("endDate", "<", new Date(+midnight + 86400000)), overdue: collection.where("status", "==", "approved").where("endDate", "<", midnight) };
    res.json(Object.fromEntries(await Promise.all(Object.entries(queries).map(async ([key, query]) => [key, (await query.count().get()).data().count]))));
  }));
  app.post("/api/admin/bookings/:id/decision", handle(async (req, res) => {
    const id = documentId.parse(req.params.id), note = typeof req.body.note === "string" ? req.body.note : "";
    if (note.length > 1000) throw new ApiError(400, "หมายเหตุยาวเกินกำหนด");
    const action = req.body.action;
    if (!["approved", "rejected"].includes(action)) throw new ApiError(400, "สถานะไม่ถูกต้อง");
    let notification;
    if (action === "approved") notification = await line().approve(id, note, req.adminUser.uid);
    else await bookings().reject(id, note, req.adminUser.uid);
    const email = await notice(id, action);
    res.json({ success: true, notification, emailNotification: email.notification });
  }));
  app.post("/api/admin/equipment/:id/return", handle(async (req, res) => { await bookings().returnItem(documentId.parse(req.params.id), req.body.bookingId ? documentId.parse(req.body.bookingId) : undefined); res.json({ success: true }); }));
  app.get("/api/admin/notification-settings", handle(async (_req, res) => res.json(await notifications().settings())));
  app.put("/api/admin/notification-settings", handle(async (req, res) => { await notifications().configure(req.body.webhookUrl); res.json({ success: true }); }));
  app.post("/api/admin/notifications/test", handle(async (_req, res) => res.json(await notifications().test())));
  app.get("/api/admin/notifications", handle(async (_req, res) => {
    const docs = await getDb().collection("emailNotifications").orderBy("createdAt", "desc").limit(25).get();
    const lineDocs = await getDb().collection("lineNotifications").orderBy("createdAt", "desc").limit(25).get();
    res.json({ notifications: [...docs.docs, ...lineDocs.docs].map((d) => ({ id: d.id, bookingId: d.data().bookingId, kind: d.data().kind, status: d.data().status })) });
  }));
  for (const [route, kind] of [["notify-admin-booking", "pending"], ["notify-borrower-approved", "approved"], ["notify-borrower-rejected", "rejected"]]) {
    app.post("/api/" + route, guard, handle(async (req, res) => res.json(await notifications().dispatch(documentId.parse(req.body.bookingId || req.body.id), kind))));
  }
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } });
  app.post("/api/upload-image", guard, upload.single("image"), handle(async (req, res) => {
    if (!req.file?.buffer) throw new ApiError(400, "ไม่พบภาพที่อัปโหลด");
    res.json(await storeImage(req.file.buffer, await bucket()));
  }));
  app.use("/api", (_req, res) => res.status(404).json({ success: false, message: "ไม่พบ API นี้" }));
  app.use("/uploads", express.static(path.join(root, "public/uploads"), { dotfiles: "deny", setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff") }));
  app.use(express.static(path.join(root, "dist")));
  for (const page of ["equipment", "booking", "calendar", "success", "admin", "my-bookings"]) {
    app.get(["/" + page, "/" + page + ".html"], (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
  }
  app.use(apiError);
  return app;
}
const app = createApp();
if (!process.env.VERCEL && process.argv[1] === fileURLToPath(import.meta.url)) app.listen(Number(process.env.PORT || 3000), "127.0.0.1");
export default app;
