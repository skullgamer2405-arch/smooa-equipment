import { IMAGE_SOURCE_MAX_BYTES, IMAGE_INGRESS_MAX_BYTES, IMAGE_MAX_DIMENSION, IMAGE_MAX_PIXELS } from "../../shared/image-limits.js";

/** Convert supported local raster files to the bounded PNG contract accepted by the API. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > IMAGE_SOURCE_MAX_BYTES)
    throw Error("ใช้ PNG, JPEG หรือ WebP ไม่เกิน 10 MB");
  const image = await createImageBitmap(file).catch(() => {
    throw Error("เปิดไฟล์ภาพไม่ได้ กรุณาเลือกภาพใหม่");
  });
  const canvas = document.createElement("canvas");
  try {
    if (!image.width || !image.height || image.width > IMAGE_MAX_DIMENSION || image.height > IMAGE_MAX_DIMENSION || image.width * image.height > IMAGE_MAX_PIXELS)
      throw Error("ใช้ภาพกว้างและสูงไม่เกิน 4096px และไม่เกิน 16 ล้านพิกเซล");
    const context = canvas.getContext("2d");
    if (!context) throw Error("เบราว์เซอร์นี้ยังเตรียมภาพไม่ได้ กรุณาใช้ URL รูปภาพแทน");
    for (let round = 0; round <= 12; round++) {
      canvas.width = Math.max(1, Math.floor(image.width * 0.8 ** round));
      canvas.height = Math.max(1, Math.floor(image.height * 0.8 ** round));
      // Redraw the original to avoid accumulating resampling artifacts.
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error("เตรียมภาพไม่สำเร็จ")), "image/png"));
      if (png.size <= IMAGE_INGRESS_MAX_BYTES) return png;
    }
    throw Error("ภาพ PNG ใหญ่เกิน 3 MB กรุณาลดขนาดภาพแล้วลองใหม่");
  } finally {
    image.close();
    canvas.width = canvas.height = 0;
  }
}
