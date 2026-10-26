/** Convert supported local raster files to the bounded PNG contract accepted by the API. */
export async function prepareImage(file: File): Promise<Blob> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)
    throw Error("ใช้ PNG, JPEG หรือ WebP ไม่เกิน 10 MB");
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width > 4096 || image.height > 4096 || image.width * image.height > 16_000_000)
      throw Error("ใช้ภาพกว้างและสูงไม่เกิน 4096px และไม่เกิน 16 ล้านพิกเซล");
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw Error("เบราว์เซอร์นี้ยังเตรียมภาพไม่ได้ กรุณาใช้ URL รูปภาพแทน");
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error("เตรียมภาพไม่สำเร็จ")), "image/png"));
    if (png.size > 10 * 1024 * 1024) throw Error("ภาพ PNG ใหญ่เกิน 10 MB กรุณาลดขนาดภาพแล้วลองใหม่");
    return png;
  } finally {
    image.close();
  }
}
