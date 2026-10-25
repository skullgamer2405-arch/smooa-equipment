import { Router } from "express";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { bookingSchema, bangkokDay } from "../shared/booking-schema.js";

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const id = z.string().regex(/^[\p{L}\p{N}_-]{1,150}$/u);
const requestSchema = z.object({
  idToken: z.string().min(1).max(8192),
  requestId: z.string().uuid(),
  lineConsent: z.literal(true),
  equipmentId: id,
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sameSecret = (a, b) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const asDate = (value) => (value?.toDate ? value.toDate() : new Date(value));
const dueDay = (value) => bangkokDay(asDate(value));
const nextDay = (now) => bangkokDay(new Date(+now + 86400000));
const jobId = (bookingId, kind, day = "") => `${bookingId}_${kind}_${day}`;

export async function verifyLineIdentity(
  idToken,
  channelId,
  request = fetch,
  now = new Date(),
) {
  const response = await request("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new ApiError(401, "กรุณาเชื่อมต่อ LINE ใหม่");
  const claims = await response.json();
  if (
    claims.aud !== channelId ||
    claims.iss !== "https://access.line.me" ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 <= +now ||
    !/^U[0-9a-f]{32}$/i.test(claims.sub || "")
  )
    throw new ApiError(401, "ข้อมูลยืนยัน LINE ไม่ถูกต้อง");
  return claims.sub;
}
export function notificationText(booking, kind) {
  const day = dueDay(booking.endDate);
  const heading =
    kind === "approval"
      ? "✅ คำขอยืมได้รับอนุมัติแล้ว"
      : kind === "before"
        ? "🔔 เตือนคืนอุปกรณ์พรุ่งนี้"
        : "🔔 วันนี้ครบกำหนดคืนอุปกรณ์";
  return `${heading}\nอุปกรณ์: ${booking.equipmentName}\nรหัส: ${booking.assetCode}\nกำหนดคืน: ${day} (เวลาไทย)\nกรุณาส่งคืนตามจุดรับคืนที่ตกลงกับผู้ดูแล หากคืนแล้วแต่สถานะยังไม่ปรับ กรุณาติดต่อผู้ดูแล`;
}

// All LINE identity, delivery state and leases are private server-side collections.
export function createLineService({
  db,
  request = fetch,
  now = () => new Date(),
  env = process.env,
}) {
  const bookingRef = (value) => db.collection("bookings").doc(value);
  const recipientRef = (value) =>
    db.collection("lineBookingRecipients").doc(value);
  const jobs = db.collection("lineNotifications");
  const newJob = (bookingId, kind, day = "") => ({
    bookingId,
    kind,
    day,
    status: "pending",
    retryKey: randomUUID(),
    createdAt: now(),
  });
  async function createBooking(body) {
    const { idToken, requestId, equipmentId } = requestSchema.parse(body);
    const { terms: _, ...fields } = bookingSchema.parse(body);
    const userId = await verifyLineIdentity(
      idToken,
      env.LINE_LOGIN_CHANNEL_ID,
      request,
      now(),
    );
    const bookingId = "line-" + hash(userId + ":" + requestId);
    const ref = bookingRef(bookingId),
      recipient = recipientRef(bookingId);
    const fingerprint = hash(JSON.stringify({ ...fields, equipmentId }));
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      const previous = await tx.get(recipient);
      if (existing.exists) {
        if (
          previous.data()?.fingerprint !== fingerprint ||
          previous.data()?.userId !== userId
        )
          throw new ApiError(409, "คำขอซ้ำมีข้อมูลต่างกัน กรุณาเริ่มคำขอใหม่");
        return;
      }
      const equipment = await tx.get(
        db.collection("equipment").doc(equipmentId),
      );
      if (!equipment.exists || equipment.data().status !== "available")
        throw new ApiError(409, "อุปกรณ์ไม่พร้อมให้ยืม");
      const item = equipment.data();
      tx.create(ref, {
        ...fields,
        equipmentId,
        equipmentName: z.string().min(1).max(200).parse(item.title),
        assetCode: z.string().min(1).max(50).parse(item.assetCode),
        startDate: new Date(fields.startDate + "T00:00:00+07:00"),
        endDate: new Date(fields.endDate + "T00:00:00+07:00"),
        status: "pending",
        createdAt: now(),
      });
      tx.create(recipient, {
        userId,
        fingerprint,
        consentedAt: now(),
        consentVersion: 1,
        enabled: true,
        approved: false,
      });
    });
    return bookingId;
  }
  async function approve(bookingId, note, adminUid) {
    const ref = bookingRef(bookingId),
      recipient = recipientRef(bookingId);
    const job = jobs.doc(jobId(bookingId, "approval"));
    let linked = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref),
        line = await tx.get(recipient);
      if (!snap.exists) throw new ApiError(404, "ไม่พบคำขอ");
      const b = snap.data();
      linked = line.exists && line.data().enabled === true;
      if (b.status === "approved" && linked && line.data().approved) return;
      if (b.status !== "pending")
        throw new ApiError(409, "คำขอนี้ถูกดำเนินการแล้ว");
      const eq = db.collection("equipment").doc(b.equipmentId),
        item = await tx.get(eq);
      if (!item.exists || item.data().status !== "available")
        throw new ApiError(409, "อุปกรณ์ไม่พร้อมให้ยืม");
      tx.update(ref, {
        status: "approved",
        adminNote: note,
        approvedAt: now(),
        approvedBy: adminUid,
      });
      tx.update(eq, { status: "unavailable", returnDate: b.endDate });
      if (linked) {
        tx.update(recipient, { approved: true });
        tx.create(job, newJob(bookingId, "approval"));
      }
    });
    // The approval and outbox are committed together. A delivery failure never undoes approval.
    if (!linked) return "not_linked";
    try {
      return await deliver(job.id);
    } catch {
      return "queued";
    }
  }
  async function deliver(key) {
    const ref = jobs.doc(key),
      time = now();
    const leased = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return null;
      const job = snapshot.data();
      if (
        ["sent", "skipped", "needs_review"].includes(job.status) ||
        +asDate(job.leaseUntil || 0) > +time
      )
        return null;
      const booking = await tx.get(bookingRef(job.bookingId)),
        recipient = await tx.get(recipientRef(job.bookingId));
      const b = booking.data(),
        line = recipient.data();
      if (
        job.kind !== "approval" &&
        +time < +new Date(bangkokDay(time) + "T09:00:00+07:00")
      )
        return null;
      const valid =
        b?.status === "approved" &&
        line?.enabled &&
        line?.approved &&
        (job.kind === "approval" ||
          (dueDay(b.endDate) === job.day &&
            job.day ===
              (job.kind === "before" ? nextDay(time) : bangkokDay(time))));
      if (!valid) {
        tx.update(ref, { status: "skipped", leaseUntil: null });
        return null;
      }
      // LINE deduplicates retry keys for 24h. Stop ambiguous retries before that expires.
      if (
        job.firstAttemptAt &&
        +time - +asDate(job.firstAttemptAt) >= 23 * 3600000
      ) {
        tx.update(ref, { status: "needs_review", leaseUntil: null });
        return null;
      }
      tx.update(ref, {
        status: "sending",
        firstAttemptAt: job.firstAttemptAt || time,
        leaseUntil: new Date(+time + 90000),
      });
      return { job, booking: b, userId: line.userId };
    });
    if (!leased) return "unchanged";
    try {
      const response = await request(
        "https://api.line.me/v2/bot/message/push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,
            "X-Line-Retry-Key": leased.job.retryKey,
          },
          body: JSON.stringify({
            to: leased.userId,
            messages: [
              {
                type: "text",
                text: notificationText(leased.booking, leased.job.kind),
              },
            ],
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      // Only a documented duplicate response counts as previously accepted.
      if (
        !response.ok &&
        !(
          response.status === 409 &&
          response.headers.get("x-line-accepted-request-id")
        )
      )
        throw Error("LINE_PUSH_REJECTED");
      await ref.update({ status: "sent", acceptedAt: now(), leaseUntil: null });
      return "accepted"; // API acceptance is not proof the user has read/received it.
    } catch {
      await ref.update({ status: "pending", leaseUntil: null });
      return "queued";
    }
  }
  async function reminders() {
    const deadline = Date.now() + 45000;
    const time = now(),
      today = bangkokDay(time),
      tomorrow = nextDay(time);
    const start = new Date(today + "T00:00:00+07:00"),
      end = new Date(+new Date(tomorrow + "T00:00:00+07:00") + 86400000);
    let cursor,
      scanned = 0,
      queued = 0;
    // Persist reminder jobs before dispatch. A repeated run safely picks up existing jobs.
    do {
      let q = db
        .collection("bookings")
        .where("status", "==", "approved")
        .where("endDate", ">=", start)
        .where("endDate", "<", end)
        .orderBy("endDate")
        .limit(100);
      if (cursor) q = q.startAfter(cursor);
      const page = await q.get();
      for (const booking of page.docs) {
        if (Date.now() >= deadline)
          return {
            scanned,
            queued,
            processed: 0,
            accepted: 0,
            incomplete: true,
          };
        scanned++;
        const recipient = await recipientRef(booking.id).get();
        if (!recipient.data()?.approved || !recipient.data()?.enabled) continue;
        const day = dueDay(booking.data().endDate),
          kind = day === tomorrow ? "before" : "due";
        const ref = jobs.doc(jobId(booking.id, kind, day));
        await db.runTransaction(async (tx) => {
          const existing = await tx.get(ref);
          if (!existing.exists) {
            tx.create(ref, newJob(booking.id, kind, day));
            queued++;
          }
        });
      }
      cursor = page.docs.length === 100 ? page.docs.at(-1) : null;
    } while (cursor);
    const pending = await jobs
      .where("status", "in", ["pending", "sending"])
      .limit(100)
      .get();
    const results = [];
    for (let i = 0; i < pending.docs.length && Date.now() < deadline; i += 5)
      results.push(
        ...(await Promise.all(
          pending.docs.slice(i, i + 5).map((job) => deliver(job.id)),
        )),
      );
    const review = await jobs
      .where("status", "==", "needs_review")
      .limit(1)
      .get();
    const needsReview = review.docs.length > 0;
    return {
      scanned,
      queued,
      processed: results.length,
      accepted: results.filter((x) => x === "accepted").length,
      needsReview,
      // Explicitly flag a potentially unfinished queue for operators to rerun safely.
      incomplete:
        needsReview ||
        pending.docs.length === 100 ||
        results.length < pending.docs.length ||
        results.some((x) => x === "queued"),
    };
  }
  return { createBooking, approve, deliver, reminders };
}

export function createLineRouter({
  getDb,
  verifyAdmin,
  request = fetch,
  now = () => new Date(),
  env = process.env,
}) {
  const router = Router();
  router.use((req, res, next) => {
    if (
      env.LINE_ENABLED !== "true" ||
      !env.LINE_LOGIN_CHANNEL_ID ||
      !env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||
      !env.LINE_ADMIN_EMAILS ||
      !env.CRON_SECRET ||
      env.CRON_SECRET.length < 32
    )
      return res
        .status(503)
        .json({ success: false, message: "ยังไม่ได้เปิดใช้งาน LINE" });
    next();
  });
  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res, createLineService({ db: getDb(), request, now, env }));
    } catch (error) {
      const status =
        error instanceof z.ZodError
          ? 400
          : error instanceof ApiError
            ? error.status
            : 503;
      res.status(status).json({
        success: false,
        message:
          status === 400
            ? "ข้อมูลคำขอไม่ถูกต้อง"
            : error instanceof ApiError
              ? error.message
              : "บริการ LINE ไม่พร้อม กรุณาลองใหม่",
      });
    }
  };
  router.post(
    "/bookings",
    handle(async (req, res, service) => {
      res.json({
        success: true,
        bookingId: await service.createBooking(req.body),
      });
    }),
  );
  router.post(
    "/bookings/:id/approve",
    handle(async (req, res, service) => {
      const token = /^Bearer (\S+)$/.exec(req.headers.authorization || "")?.[1];
      if (!token) throw new ApiError(401, "กรุณาเข้าสู่ระบบผู้ดูแล");
      let user;
      try {
        user = await verifyAdmin(token);
      } catch {
        throw new ApiError(403, "ไม่มีสิทธิ์ผู้ดูแล");
      }
      const allowed = env.LINE_ADMIN_EMAILS.split(",").map((s) =>
        s.trim().toLowerCase(),
      );
      if (
        !user.email_verified ||
        !allowed.includes(user.email?.toLowerCase()) ||
        !user.uid
      )
        throw new ApiError(403, "ไม่มีสิทธิ์ผู้ดูแล");
      const bookingId = id.parse(req.params.id),
        note = z
          .string()
          .max(1000)
          .parse(req.body.note ?? "");
      res.json({
        success: true,
        notification: await service.approve(bookingId, note, user.uid),
      });
    }),
  );
  router.get(
    "/reminders",
    handle(async (req, res, service) => {
      if (
        !sameSecret(
          req.headers.authorization || "",
          "Bearer " + env.CRON_SECRET,
        )
      )
        throw new ApiError(401, "Unauthorized");
      const result = await service.reminders();
      res
        .status(result.incomplete ? 503 : 200)
        .json({ success: !result.incomplete, ...result });
    }),
  );
  return router;
}
