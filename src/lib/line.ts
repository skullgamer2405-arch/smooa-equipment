import { lineOa } from "../../shared/line-oa.js";

export const lineEnabled =
  import.meta.env.VITE_DEMO_MODE !== "true" &&
  Boolean(import.meta.env.VITE_LINE_LIFF_ID);
export type LineSession = {
  idToken: string;
  displayName: string;
  friend: boolean;
};
let initialization:
  Promise<(typeof import("@line/liff"))["default"]> | undefined;
export class LineConnectionError extends Error {}
export async function initializeLine() {
  if (!lineEnabled) throw Error("ยังไม่ได้เปิดใช้งานการเชื่อมต่อ LINE");
  initialization ??= import("@line/liff")
    .then(async ({ default: liff }) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          liff.init({ liffId: import.meta.env.VITE_LINE_LIFF_ID }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(Error("LINE_CONNECTION_TIMEOUT")),
              10000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      return liff;
    })
    .catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
export async function lineSession(login = false): Promise<LineSession | null> {
  const liff = await initializeLine();
  if (!liff.isLoggedIn()) {
    if (login) liff.login({ redirectUri: window.location.href });
    return null;
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw Error("กรุณาเชื่อมต่อ LINE ใหม่ และอนุญาตการเข้าสู่ระบบ");
  const [profile, friendship] = await Promise.all([
    liff.getProfile(),
    liff.getFriendship(),
  ]);
  return {
    idToken,
    displayName: profile.displayName,
    friend: friendship.friendFlag,
  };
}
export function lineFriendUrl() {
  try {
    const u = new URL(import.meta.env.VITE_LINE_OA_URL || lineOa.friendUrl);
    return u.protocol === "https:" && ["line.me", "lin.ee"].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function createLineBooking(data: Record<string, unknown>) {
  let session;
  try { session = await lineSession(); }
  catch { throw new LineConnectionError("ตรวจบัญชี LINE ไม่สำเร็จ ข้อมูลในแบบฟอร์มยังอยู่ กรุณาลองยืนยันบัญชีอีกครั้ง"); }
  if (!session?.friend)
    throw new LineConnectionError(
      "ตรวจบัญชี LINE ไม่สำเร็จ กรุณาเปิดเว็บอีกครั้งจาก Rich Menu ของ SMO OA และตรวจว่าไม่ได้บล็อกบัญชี",
    );
  const r = await fetch("/api/line/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      idToken: session.idToken,
      lineConsent: true,
    }),
  });
  if (r.status === 401) throw new LineConnectionError("การเชื่อมต่อ LINE หมดอายุ กรุณายืนยันบัญชีอีกครั้ง");
  if (!r.ok) throw Error("บันทึกคำขอผ่าน LINE ไม่สำเร็จ กรุณาลองส่งคำขอเดิมอีกครั้ง");
  return (await r.json()).bookingId as string;
}
export async function approveWithLine(bookingId: string, note: string) {
  const { auth } = await import("./firebase");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error("กรุณาเข้าสู่ระบบผู้ดูแลใหม่");
  const r = await fetch(
    `/api/line/bookings/${encodeURIComponent(bookingId)}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ note }),
    },
  );
  if (!r.ok)
    throw Error(
      r.status === 403
        ? "บัญชีนี้ยังไม่ได้รับสิทธิ์อนุมัติผ่าน LINE กรุณาติดต่อผู้ดูแล"
        : "อนุมัติไม่สำเร็จ กรุณาตรวจสถานะและลองใหม่",
    );
  return r.json() as Promise<{ notification: string }>;
}
