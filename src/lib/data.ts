import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { fixtureState } from "./fixtures";
import type {
  Booking,
  CollectionName,
  Equipment,
  CalendarEntry,
} from "./types";
import { asDate } from "./utils";
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
export function watch(
  name: CollectionName,
  next: (rows: Row[]) => void,
  error: (message: string) => void,
) {
  let stopped = false,
    unsub: undefined | (() => void);
  if (demo) {
    const emit = () => next([...state[name]]);
    listeners.add(emit);
    emit();
    return () => {
      listeners.delete(emit);
    };
  }
  import("./firebase")
    .then(({ db }) => {
      if (!stopped)
        unsub = onSnapshot(
          collection(db, name),
          (s) => next(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Row)),
          () => error("เชื่อมต่อข้อมูลไม่สำเร็จ กรุณาลองใหม่"),
        );
    })
    .catch(() => error("เริ่มระบบข้อมูลไม่สำเร็จ"));
  return () => {
    stopped = true;
    unsub?.();
  };
}
export function watchAuth(
  next: (user: { email: string | null } | null) => void,
) {
  if (demo) {
    const emit = () => next(demoAdmin ? { email: demoAccount.email } : null);
    listeners.add(emit);
    emit();
    return () => {
      listeners.delete(emit);
    };
  }
  let stop = false,
    unsub: undefined | (() => void);
  import("./firebase").then(({ auth }) => {
    if (!stop)
      unsub = onAuthStateChanged(auth, (u) =>
        next(u ? { email: u.email } : null),
      );
  });
  return () => {
    stop = true;
    unsub?.();
  };
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
export async function createBooking(data: Omit<Booking, "id" | "createdAt">) {
  if (demo) {
    const id = crypto.randomUUID();
    state.bookings.unshift({
      ...data,
      id,
      createdAt: new Date().toISOString(),
    });
    changed();
    return id;
  }
  const { db } = await import("./firebase");
  const ref = await addDoc(collection(db, "bookings"), {
    ...data,
    startDate: Timestamp.fromDate(asDate(data.startDate)!),
    endDate: Timestamp.fromDate(asDate(data.endDate)!),
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
  const { db } = await import("./firebase");
  await runTransaction(db, async (tx) => {
    const br = doc(db, "bookings", id),
      snap = await tx.get(br);
    if (!snap.exists() || snap.data().status !== "pending")
      throw Error("คำขอนี้ถูกดำเนินการแล้ว");
    const b = snap.data(),
      er = doc(db, "equipment", b.equipmentId),
      eq = await tx.get(er);
    if (
      action === "approved" &&
      (!eq.exists() || eq.data().status !== "available")
    )
      throw Error("อุปกรณ์ไม่พร้อมให้ยืม");
    tx.update(br, {
      status: action,
      adminNote: note,
      [action === "approved" ? "approvedAt" : "rejectedAt"]: serverTimestamp(),
    });
    if (action === "approved")
      tx.update(er, { status: "unavailable", returnDate: b.endDate });
  });
}
export async function returnEquipment(id: string) {
  if (demo) {
    const e = state.equipment.find((x) => x.id === id);
    if (e) e.status = "available";
    state.bookings.forEach((b) => {
      if (b.equipmentId === id && b.status === "approved")
        b.status = "returned";
    });
    changed();
    return;
  }
  const { db } = await import("./firebase");
  const docs = await getDocs(
    query(
      collection(db, "bookings"),
      where("equipmentId", "==", id),
      where("status", "==", "approved"),
    ),
  );
  const batch = writeBatch(db);
  batch.update(doc(db, "equipment", id), {
    status: "available",
    returnDate: null,
  });
  docs.forEach((d) =>
    batch.update(d.ref, { status: "returned", returnedAt: serverTimestamp() }),
  );
  await batch.commit();
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
export function webhook() {
  return localStorage.getItem("smo_email_webhook_url") || "";
}
export function saveWebhook(url: string) {
  if (
    url &&
    !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
      url,
    )
  )
    throw Error("กรุณาใช้ URL Web App ของ Google Apps Script แบบ HTTPS");
  url
    ? localStorage.setItem("smo_email_webhook_url", url)
    : localStorage.removeItem("smo_email_webhook_url");
}
export async function notify(action: string, data: Record<string, unknown>) {
  if (demo) return { success: true, deliveredToSMTP: false };
  const url = webhook();
  const r = await fetch(url || "/api/" + action, {
    method: "POST",
    headers: {
      "Content-Type": url ? "text/plain;charset=utf-8" : "application/json",
    },
    body: JSON.stringify(url ? { action, ...data } : data),
    ...(url ? { mode: "no-cors" as RequestMode } : {}),
  });
  if (url) return { success: true, deliveryUnknown: true };
  if (!r.ok) throw Error("บันทึกคำขอแล้ว แต่ส่งการแจ้งเตือนไม่สำเร็จ");
  return r.json();
}
