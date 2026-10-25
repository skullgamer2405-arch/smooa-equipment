import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(+value) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(+date) ? null : date;
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      return asDate(value.toDate());
    } catch {
      return null;
    }
  }
  return null;
}
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
export function dateLabel(value: unknown) {
  const date = asDate(value);
  return date ? dateFormatter.format(date) : "ไม่ระบุวันที่";
}
export function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseInputDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function safeImage(value?: string) {
  if (!value) return "/equipment-placeholder.svg";
  try {
    const u = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(u.protocol) ||
      (u.protocol === "blob:" && u.origin === window.location.origin)
      ? u.href
      : "/equipment-placeholder.svg";
  } catch {
    return "/equipment-placeholder.svg";
  }
}
export function qrBookingPath(value: string, origin: string) {
  const raw = value.trim();
  if (!raw || /[\u0000-\u001f]/.test(raw)) return null;
  try {
    const url = new URL(raw, origin);
    if (
      url.origin === origin &&
      ["http:", "https:"].includes(url.protocol) &&
      ["/booking", "/booking.html"].includes(url.pathname) &&
      url.searchParams.get("id")
    )
      return (
        "/booking.html?id=" + encodeURIComponent(url.searchParams.get("id")!)
      );
  } catch {
    /* plain IDs below */
  }
  return /^[\p{L}\p{N}_-]{1,150}$/u.test(raw)
    ? "/booking.html?id=" + encodeURIComponent(raw)
    : null;
}
