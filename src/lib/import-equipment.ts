import type { Equipment } from "./types";
export type ImportRow = {
  data: Omit<Equipment, "id">;
  error: string;
  row: number;
};
const headers = [
  ["ชื่ออุปกรณ์", "title", "name"],
  ["รหัสอุปกรณ์", "assetCode", "code"],
  ["หมวดหมู่", "category"],
  ["URL รูปภาพ", "imageUrl", "image"],
  ["รายละเอียด", "description"],
];
export function mapRows(rows: Record<string, unknown>[]): ImportRow[] {
  return rows.map((row, i) => {
    const fields = headers.map((keys) =>
      String(
        keys.map((k) => row[k]).find((v) => v !== undefined && v !== null) ||
          "",
      ).trim(),
    );
    const [title, assetCode, category, imageUrl, description] = fields;
    const error =
      !title || !assetCode
        ? "ชื่อและรหัสอุปกรณ์จำเป็น"
        : title.length > 200 || assetCode.length > 50
          ? "ชื่อหรือรหัสยาวเกินกำหนด"
          : imageUrl && !/^https?:\/\//.test(imageUrl)
            ? "URL รูปภาพไม่ถูกต้อง"
            : "";
    return {
      data: {
        title,
        assetCode,
        category: category || "ครุภัณฑ์",
        imageUrl,
        description,
        status: "available",
      },
      error,
      row: i + 2,
    };
  });
}
export async function readImport(file: File) {
  if (file.size > 10 * 1024 * 1024) throw Error("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
  let rows: Record<string, unknown>[] = [];
  if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth/mammoth.browser");
    const { value } = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    const document = new DOMParser().parseFromString(value, "text/html");
    const table = document.querySelector("table");
    if (table) {
      const lines = Array.from(table.rows).map((row) =>
        Array.from(row.cells).map((c) => c.textContent?.trim() || ""),
      );
      const keys = lines.shift() || [];
      rows = lines.map((line) =>
        Object.fromEntries(keys.map((key, i) => [key, line[i] || ""])),
      );
    } else {
      rows = Array.from(document.querySelectorAll("p,li"))
        .map((p) => p.textContent?.split(/\||\t/).map((t) => t.trim()) || [])
        .filter((p) => p.length >= 2)
        .map((p) => ({
          ชื่ออุปกรณ์: p[0],
          รหัสอุปกรณ์: p[1],
          หมวดหมู่: p[2] || "",
          "URL รูปภาพ": p[3] || "",
          รายละเอียด: p[4] || "",
        }));
    }
  } else if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import("@e965/xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      bookVBA: false,
    });
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[workbook.SheetNames[0]],
      { defval: "" },
    );
  } else throw Error("รองรับ .xlsx, .xls และ .docx");
  if (rows.length > 500)
    throw Error("นำเข้าได้ครั้งละไม่เกิน 500 แถว กรุณาแบ่งไฟล์");
  if (!rows.length) throw Error("ไม่พบตารางข้อมูลในไฟล์");
  return mapRows(rows);
}
