import {
  addDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  startAfter,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { fixtureState } from "./fixtures";
import { validWebhook } from "../../shared/notification-config.js";
import type {
  Booking,
  CollectionName,
  WatchOptions,
  MyBooking,
  Equipment,
  CalendarEntry,
} from "./types";
import { asDate, inputDate } from "./utils";
import { lineSession } from "./line";
export const demo = import.meta.env.VITE_DEMO_MODE === "true";
export const demoAccount = {
  email: "admin@example.invalid",
  password: "demo-only",
};
type Row = Equipment | Booking | CalendarEntry;
const listeners = new Set<() => void>();
function readDemo(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function persistDemo(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Restricted browsers can still use fixtures in memory until the page reloads.
  }
}
let demoAdmin = demo && readDemo("smo-demo-admin") === "1";
function loadDemo() {
  try {
    const raw = readDemo("smo-demo-state");
    if (raw) return JSON.parse(raw) as ReturnType<typeof fixtureState>;
  } catch {
    /* isolated demo resets */
  }
  return fixtureState();
}
const state = demo ? loadDemo() : fixtureState();
function changed() {
  persistDemo("smo-demo-state", JSON.stringify(state));
  listeners.forEach((f) => f());
}
export type PageMeta = { cursor: unknown; hasMore: boolean };
export function watch(name: CollectionName, next: (rows: Row[], meta: PageMeta) => void, error: (message: string) => void, options: WatchOptions = {}) {
  let stopped = false, unsub: undefined | (() => void);
  const size = options.size || 25;
  if (demo) {
    const emit = () => {
      let rows: Row[] = [...state[name]];
      if (name === "bookings") rows = (rows as Booking[]).filter(b => matchesFilter(b, options.filter || "all")).sort((a,b) => +(asDate(b.createdAt) || 0) - +(asDate(a.createdAt) || 0) || a.id.localeCompare(b.id));
      const at = options.cursor ? rows.findIndex(r => r.id === options.cursor) + 1 : 0;
      const page = rows.slice(at, at + size);
      next(page, { cursor: page.at(-1)?.id, hasMore: rows.length > at + size });
    };
    listeners.add(emit); emit();
    return () => { listeners.delete(emit); };
  }
  import("./firebase").then(({ db }) => {
    if (stopped) return;
    const constraints = [];
    if (name === "bookings" && options.filter && options.filter !== "all") {
      const due = ["due","overdue"].includes(options.filter);
      constraints.push(where("status", "==", due ? "approved" : options.filter));
      if (due) {
        const today = inputDate(new Date());
        constraints.push(where("endDate", options.filter === "due" ? ">=" : "<", Timestamp.fromDate(new Date(today + "T00:00:00+07:00"))));
        if (options.filter === "due") constraints.push(where("endDate", "<", Timestamp.fromDate(new Date(+new Date(today + "T00:00:00+07:00") + 86400000))));
        constraints.push(orderBy("endDate"));
      } else constraints.push(orderBy("createdAt", "desc"));
    } else constraints.push(orderBy(name === "bookings" ? "createdAt" : "__name__", name === "bookings" ? "desc" : "asc"));
    if (options.cursor) constraints.push(startAfter(options.cursor));
    if (name === "calendarEntries" && options.from && options.to) {
      constraints.unshift(where("date", ">=", Timestamp.fromDate(new Date(options.from + "T00:00:00+07:00"))), where("date", "<=", Timestamp.fromDate(new Date(options.to + "T23:59:59+07:00"))));
      constraints.unshift(orderBy("date"));
    }
    unsub = onSnapshot(query(collection(db, name), ...constraints, limit(size + 1)), snap => {
      const docs = snap.docs.slice(0, size);
      next(docs.map(d => ({ ...d.data(), id: d.id }) as Row), { cursor: docs.at(-1), hasMore: snap.docs.length > size });
    }, () => error("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ หรือตรวจสิทธิ์และ indexes"));
  }).catch(() => error("เริ่มระบบข้อมูลไม่สำเร็จ กรุณาลองใหม่"));
  return () => { stopped = true; unsub?.(); };
}
export function matchesFilter(b: Booking, filter: string) {
  if (["due", "overdue"].includes(filter)) {
    const end = asDate(b.endDate);
    return b.status === "approved" && end && (filter === "due" ? inputDate(end) === inputDate(new Date()) : inputDate(end) < inputDate(new Date()));
  }
  return filter === "all" || b.status === filter;
}
export function watchAuth(next: (user: { email: string | null } | null) => void, error: (message: string) => void = () => {}) {
  if (demo) {
    const emit = () => next(demoAdmin ? { email: demoAccount.email } : null);
    listeners.add(emit); emit(); return () => { listeners.delete(emit); };
  }
  let stopped = false, version = 0, unsub: undefined | (() => void);
  import("./firebase").then(({ auth }) => {
    if (stopped) return;
    unsub = onIdTokenChanged(auth, async user => {
      const current = ++version;
      if (!user) { error(""); next(null); return; }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([user.getIdTokenResult(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("AUTH_TIMEOUT")), 10000); })]);
        if (stopped || current !== version) return;
        if (result.claims.admin !== true || result.claims.email_verified !== true) { next(null); error("บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแล กรุณาติดต่อผู้ดูแลระบบหรือเปลี่ยนบัญชี"); return; }
        error(""); next({ email: user.email });
      } catch { if (!stopped && current === version) { next(null); error("ตรวจการเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"); } }
      finally { clearTimeout(timer); }
    }, () => { if (!stopped) { next(null); error("ตรวจการเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"); } });
  }).catch(() => { if (!stopped) { next(null); error("โหลดระบบเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่"); } });
  return () => { stopped = true; version++; unsub?.(); };
}
export async function adminHeaders() {
  const { auth } = await import("./firebase");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error("กรุณาเข้าสู่ระบบผู้ดูแลใหม่");
  return { Authorization: "Bearer " + token };
}
export async function apiRequest<T = Record<string, unknown>>(url: string, options: RequestInit = {}, admin = false): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(admin ? await adminHeaders() : {}), ...options.headers }, signal: options.signal || AbortSignal.timeout(15000) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Error(body.message || "บริการไม่พร้อม กรุณาลองใหม่");
  }
  return response.json();
}
export async function getEquipment(id: string): Promise<Equipment | null> {
  if (demo) return state.equipment.find(e => e.id === id) || null;
  const { db } = await import("./firebase");
  const snap = await getDoc(doc(db, "equipment", id));
  return snap.exists() ? { ...snap.data(), id: snap.id } as Equipment : null;
}
export async function equipmentPage(cursor?: unknown) {
  if (demo) {
    const start = cursor ? state.equipment.findIndex(e => e.id === cursor) + 1 : 0;
    const rows = state.equipment.slice(start, start + 25);
    return { rows, cursor: rows.at(-1)?.id as unknown, hasMore: state.equipment.length > start + 25 };
  }
  const { db } = await import("./firebase");
  const constraints = [orderBy("__name__"), ...(cursor ? [startAfter(cursor)] : []), limit(26)];
  const snap = await getDocs(query(collection(db, "equipment"), ...constraints));
  const docs = snap.docs.slice(0, 25);
  return { rows: docs.map(d => ({ ...d.data(), id: d.id }) as Equipment), cursor: docs.at(-1) as unknown, hasMore: snap.docs.length > 25 };
}
export async function equipmentSummary(): Promise<Record<string, number>> {
  if (demo) return { all: state.equipment.length, available: state.equipment.filter(e => e.status === "available").length, unavailable: state.equipment.filter(e => e.status === "unavailable").length, maintenance: state.equipment.filter(e => e.status === "maintenance").length };
  return apiRequest("/api/public/equipment-summary");
}
export async function bookingSummary(): Promise<Record<string, number>> {
  if (demo) return Object.fromEntries(["pending", "approved", "due", "overdue"].map(key => [key, state.bookings.filter(b => matchesFilter(b, key)).length]));
  return apiRequest("/api/admin/booking-summary", {}, true);
}
export async function publicCalendar(from: string, to: string, equipmentId = "", cursor = ""): Promise<{ items: import("./types").PublicEvent[]; nextCursor: string | null }> {
  if (demo) return { items: state.bookings.filter(b => b.status === "approved" && (!equipmentId || b.equipmentId === equipmentId)).map(b => ({ id: b.id, equipmentId: b.equipmentId, equipmentName: b.equipmentName, assetCode: b.assetCode, startDay: inputDate(asDate(b.startDate)!), endDay: inputDate(asDate(b.endDate)!), status: b.status })).filter(b => b.endDay >= from && b.startDay <= to), nextCursor: null };
  return apiRequest("/api/public/calendar?" + new URLSearchParams({ from, to, equipmentId, after: cursor }));
}
export async function login(email: string, password: string) {
  if (demo) {
    if (email !== demoAccount.email || password !== demoAccount.password)
      throw Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    demoAdmin = true;
    persistDemo("smo-demo-admin", "1");
    listeners.forEach((f) => f());
    return;
  }
  const { auth } = await import("./firebase");
  await signInWithEmailAndPassword(auth, email, password);
}
export async function logout() {
  if (demo) {
    demoAdmin = false;
    persistDemo("smo-demo-admin", null);
    listeners.forEach((f) => f());
    return;
  }
  const { auth } = await import("./firebase");
  await signOut(auth);
}
export async function createBooking(data: Omit<Booking, "id" | "createdAt">, requestId: string, lineLinked = false) {
  if (demo) {
    const previous = state.bookings.find(b => b.requestId === requestId);
    if (previous) return previous.id;
    const id = crypto.randomUUID();
    state.bookings.unshift({ ...data, id, requestId, lineLinked, createdAt: new Date().toISOString() });
    changed(); return id;
  }
  const result = await apiRequest<{ bookingId: string }>("/api/bookings", { method: "POST", body: JSON.stringify({ ...data, requestId, terms: true, startDate: inputDate(asDate(data.startDate)!), endDate: inputDate(asDate(data.endDate)!) }) });
  return result.bookingId;
}
export async function saveEquipment(data: Omit<Equipment, "id">, id?: string) {
  if (demo) {
    if (id) {
      const i = state.equipment.findIndex((x) => x.id === id);
      state.equipment[i] = { ...data, id };
    } else
      state.equipment.unshift({
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
    changed();
    return;
  }
  const { db } = await import("./firebase");
  if (id)
    await updateDoc(doc(db, "equipment", id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  else
    await addDoc(collection(db, "equipment"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
}
export async function removeEquipment(id: string) {
  if (demo) {
    state.equipment = state.equipment.filter((x) => x.id !== id);
    changed();
    return;
  }
  const { db } = await import("./firebase");
  await deleteDoc(doc(db, "equipment", id));
}
export async function decideBooking(
  id: string,
  action: "approved" | "rejected",
  note: string,
) {
  if (demo) {
    const b = state.bookings.find((x) => x.id === id);
    if (!b || b.status !== "pending") throw Error("คำขอนี้ถูกดำเนินการแล้ว");
    const eq = state.equipment.find((x) => x.id === b.equipmentId);
    if (action === "approved" && (!eq || eq.status !== "available"))
      throw Error("อุปกรณ์ไม่พร้อมให้ยืม");
    b.status = action;
    b.adminNote = note;
    if (action === "approved" && eq) {
      eq.status = "unavailable";
      eq.returnDate = b.endDate;
    }
    changed();
    return;
  }
  return apiRequest<{ notification?: string }>(`/api/admin/bookings/${encodeURIComponent(id)}/decision`, { method: "POST", body: JSON.stringify({ action, note }) }, true);
}
export async function returnEquipment(id: string, bookingId?: string) {
  if (demo) {
    const selected = state.bookings.filter(b => b.equipmentId === id && b.status === "approved" && (!bookingId || b.id === bookingId));
    selected.forEach(b => { b.status = "returned"; });
    if (!state.bookings.some(b => b.equipmentId === id && b.status === "approved")) { const item = state.equipment.find(e => e.id === id); if (item) item.status = "available"; }
    changed(); return;
  }
  await apiRequest(`/api/admin/equipment/${encodeURIComponent(id)}/return`, { method: "POST", body: JSON.stringify({ bookingId }) }, true);
}
export async function myBookings(cursor = ""): Promise<{ items: MyBooking[]; nextCursor: string | null }> {
  if (demo) return { items: state.bookings.filter(b => b.lineLinked || b.id === "booking-sample").map(b => ({ id: b.id, equipmentId: b.equipmentId, equipmentName: b.equipmentName, assetCode: b.assetCode, status: b.status, startDay: inputDate(asDate(b.startDate)!), endDay: inputDate(asDate(b.endDate)!), activityName: b.activityName, adminNote: b.adminNote || "", createdAt: asDate(b.createdAt)!.toISOString() })), nextCursor: null };
  const session = await lineSession();
  if (!session) throw Error("กรุณาเปิดเว็บจาก Rich Menu ของ SMO OA เพื่อยืนยันบัญชี");
  return apiRequest("/api/line/my-bookings?cursor=" + encodeURIComponent(cursor), { headers: { Authorization: "Bearer " + session.idToken } });
}

export async function addCalendar(data: Omit<CalendarEntry, "id">) {
  if (demo) {
    state.calendarEntries.push({ ...data, id: crypto.randomUUID() });
    changed();
    return;
  }
  const { db } = await import("./firebase");
  await addDoc(collection(db, "calendarEntries"), {
    ...data,
    date: Timestamp.fromDate(asDate(data.date)!),
    createdAt: serverTimestamp(),
  });
}
export function webhook() { return readDemo("smo_email_webhook_url") || ""; }
export type NotificationSettings = { webhookUrl: string; smtpConfigured: boolean; webhookReady: boolean; adminEmail: string; provider: "smtp" | "apps_script" | "none"; adminUrl: string; ready: boolean; issues: string[] };
export async function notificationSettings(): Promise<NotificationSettings> {
  if (demo) return { webhookUrl: webhook(), smtpConfigured: false, webhookReady: false, adminEmail: "", provider: "none", adminUrl: "", ready: false, issues: [] };
  return apiRequest("/api/admin/notification-settings", {}, true);
}
export async function saveWebhook(url: string) {
  if (!validWebhook(url)) throw Error("กรุณาใช้ URL Web App ของ Google Apps Script แบบ HTTPS");
  if (demo) { persistDemo("smo_email_webhook_url", url || null); return; }
  await apiRequest("/api/admin/notification-settings", { method: "PUT", body: JSON.stringify({ webhookUrl: url }) }, true);
}
export async function notify(action: string, data: Record<string, unknown>) {
  if (demo) return { success: true, deliveredToSMTP: false, notification: "not_configured" as const };
  return apiRequest<{ success: boolean; deliveredToSMTP?: boolean; notification?: "accepted" | "needs_review" | "not_configured" | "already_queued" }>(action === "test" ? "/api/admin/notifications/test" : "/api/" + action, { method: "POST", body: JSON.stringify({ bookingId: data.bookingId || data.id }) }, true);
}
