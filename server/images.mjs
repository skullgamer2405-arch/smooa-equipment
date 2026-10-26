import { randomUUID } from "node:crypto";
import { PNG } from "pngjs";
import { ApiError } from "./http.mjs";

export function canonicalImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || buffer.length > 10 * 1024 * 1024 || !buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new ApiError(400, "ใช้ไฟล์ภาพ PNG ที่อ่านได้และไม่เกิน 10 MB");
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  if (!width || !height || width > 4096 || height > 4096 || width * height > 16000000) throw new ApiError(400, "ภาพต้องไม่เกิน 4096px และ 16 ล้านพิกเซล");
  try { return PNG.sync.write(PNG.sync.read(buffer, { checkCRC: true })); }
  catch { throw new ApiError(400, "ไฟล์ภาพไม่สมบูรณ์ กรุณาเลือกภาพใหม่"); }
}
export async function storeImage(buffer, bucket) {
  const bytes = canonicalImage(buffer), name = "equipment/" + randomUUID() + ".png", token = randomUUID();
  await bucket.file(name).save(bytes, { resumable: false, validation: "crc32c", metadata: { contentType: "image/png", cacheControl: "public,max-age=31536000,immutable", metadata: { firebaseStorageDownloadTokens: token } } });
  return { success: true, imageUrl: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(name)}?alt=media&token=${token}` };
}
