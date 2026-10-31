import { createHash, randomUUID } from "node:crypto";
import { IMAGE_SOURCE_MAX_BYTES, IMAGE_OUTPUT_MAX_BYTES, IMAGE_MAX_DIMENSION, IMAGE_MAX_PIXELS } from "../shared/image-limits.js";
import { PNG } from "pngjs";
import { ApiError } from "./http.mjs";

// Server-only credentials; also used by the release configuration gate.
export function cloudinaryConfig(env) {
  const cloud = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(cloud || "") || !apiKey || !apiSecret) throw Error("CLOUDINARY configuration is missing or invalid");
  return { cloud, apiKey, apiSecret };
}

export function canonicalImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || buffer.length > IMAGE_SOURCE_MAX_BYTES || !buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new ApiError(400, "ใช้ไฟล์ภาพ PNG ที่อ่านได้และไม่เกิน 10 MB");
  // The browser re-encodes uploads as non-interlaced PNG. Check structure before allocation.
  let headers = 0, ended = false;
  for (let offset = 8; offset < buffer.length;) {
    if (offset + 12 > buffer.length) throw new ApiError(400, "ไฟล์ภาพไม่สมบูรณ์");
    const length = buffer.readUInt32BE(offset), type = buffer.toString("ascii", offset + 4, offset + 8);
    if (length > buffer.length - offset - 12 || (offset === 8 && type !== "IHDR")) throw new ApiError(400, "โครงสร้างภาพไม่ถูกต้อง");
    if (type === "IHDR" && (++headers !== 1 || length !== 13)) throw new ApiError(400, "ภาพมี header ซ้ำหรือไม่ถูกต้อง");
    offset += length + 12;
    if (type === "IEND") { ended = length === 0 && offset === buffer.length; break; }
  }
  if (headers !== 1 || !ended || buffer[28] !== 0) throw new ApiError(400, "กรุณาอัปโหลดภาพผ่านหน้าเว็บเพื่อแปลงเป็น PNG ที่รองรับ");
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  if (!width || !height || width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION || width * height > IMAGE_MAX_PIXELS) throw new ApiError(400, "ภาพต้องไม่เกิน 4096px และ 16 ล้านพิกเซล");
  try {
    const bytes = PNG.sync.write(PNG.sync.read(buffer, { checkCRC: true }));
    if (bytes.length > IMAGE_OUTPUT_MAX_BYTES) throw Error("Image output limit");
    return bytes;
  }
  catch { throw new ApiError(400, "ไฟล์ภาพไม่สมบูรณ์ กรุณาเลือกภาพใหม่"); }
}
export async function storeImage(buffer, { env = process.env, request = fetch, now = () => new Date() } = {}) {
  const bytes = canonicalImage(buffer);
  try {
    const { cloud, apiKey, apiSecret } = cloudinaryConfig(env);
    const publicId = "equipment/" + randomUUID();
    const timestamp = String(Math.floor(now().getTime() / 1000));
    const signature = createHash("sha256").update(`overwrite=false&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const body = new FormData();
    body.set("file", new Blob([bytes], { type: "image/png" }), "image.png");
    body.set("api_key", apiKey);
    body.set("public_id", publicId);
    body.set("timestamp", timestamp);
    body.set("overwrite", "false");
    body.set("signature", signature);
    const response = await request(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok || response.redirected) throw Error("Upload failed");
    const result = await response.json();
    const url = new URL(result.secure_url);
    // Accept only this upload's canonical PNG, never arbitrary provider-returned URLs.
    const path = new RegExp(`^/${cloud}/image/upload/(?:v[0-9]+/)?${publicId}\\.png$`);
    if (result.resource_type !== "image" || result.format !== "png" || result.public_id !== publicId || url.protocol !== "https:" || url.host !== "res.cloudinary.com" || url.username || url.password || url.search || url.hash || !path.test(url.pathname)) throw Error("Invalid image response");
    return { success: true, imageUrl: url.href };
  } catch {
    throw new ApiError(503, "บริการอัปโหลดภาพไม่พร้อม กรุณาลองใหม่");
  }
}
