import { z } from "zod";

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const documentId = z.string().regex(/^[\p{L}\p{N}_-]{1,150}$/u);
export const adminIdentity = (user) => Boolean(user?.uid && user.admin === true && user.email_verified === true);
const adminVerifyCodes = new Set([
  "auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired", "auth/id-token-revoked",
  "auth/user-disabled", "auth/user-not-found", "auth/insufficient-permission", "auth/invalid-credential",
  "auth/internal-error", "auth/project-not-found", "auth/tenant-id-mismatch",
  "app/invalid-credential", "app/network-error", "app/network-timeout", "app/invalid-app-options",
  "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "ERR_REQUIRE_ESM", "ERR_REQUIRE_ASYNC_MODULE", "ERR_UNSUPPORTED_DIR_IMPORT", "ERR_DLOPEN_FAILED",
]);
export function adminGuard(verify) {
  return async (req, _res, next) => {
    try {
      const token = /^Bearer (\S+)$/.exec(req.headers.authorization || "")?.[1];
      if (!token) throw new ApiError(401, "กรุณาเข้าสู่ระบบผู้ดูแล");
      let user;
      try { user = await verify(token); }
      catch (error) {
        // Keep operator diagnostics free of tokens, account identities and SDK messages.
        const kind = ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError"].includes(error?.name) ? error.name : "Error";
        console.warn("ADMIN_AUTH_VERIFY_FAILED", adminVerifyCodes.has(error?.code) ? error.code : "unknown", kind);
        throw new ApiError(error?.status === 503 ? 503 : 403, "ตรวจสิทธิ์ผู้ดูแลไม่สำเร็จ กรุณาลองใหม่");
      }
      if (!adminIdentity(user)) {
        console.warn("ADMIN_AUTH_DENIED", "missing_admin_or_verified_email");
        throw new ApiError(403, "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล");
      }
      req.adminUser = user;
      next();
    } catch (error) { next(error); }
  };
}
export const handle = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
export function apiError(error, _req, res, _next) {
  const status = error instanceof z.ZodError ? 400 : error.status || (error.code === "LIMIT_FILE_SIZE" ? 413 : 503);
  res.status(status).json({ success: false, message: error instanceof ApiError ? error.message : status === 400 ? "ข้อมูลไม่ถูกต้อง กรุณาตรวจแบบฟอร์ม" : status === 413 ? "ไฟล์หรือข้อมูลมีขนาดใหญ่เกินกำหนด" : "บริการไม่พร้อม กรุณาลองใหม่" });
}
