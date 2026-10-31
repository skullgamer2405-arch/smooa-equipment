import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./ui/table";
import { useState } from "react";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { readImport, type ImportRow } from "../lib/import-equipment";
import { saveEquipment } from "../lib/data";
import { useData } from "../context";
export function AdminImport() {
  const [rows, setRows] = useState<ImportRow[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(0);
  const { announce } = useData();
  async function load(file?: File) {
    if (!file) return;
    setBusy(true);
    setRows([]);
    setDone(0);
    setError("");
    try {
      setRows(await readImport(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    let completed = 0;
    try {
      for (const row of rows.filter((r) => !r.error)) {
        await saveEquipment(row.data);
        completed++;
        setDone(completed);
      }
      setRows([]);
      announce("นำเข้าอุปกรณ์สำเร็จ " + completed + " รายการ");
    } catch {
      setRows((current) => {
        let remaining = completed;
        return current.filter((r) => {
          if (!r.error && remaining > 0) {
            remaining--;
            return false;
          }
          return true;
        });
      });
      setError(
        `บันทึกสำเร็จ ${completed} รายการ รายการที่เหลือยังไม่นำเข้า กรุณาลองอีกครั้ง`,
      );
    } finally {
      setBusy(false);
    }
  }
  function template() {
    const data =
      "\ufeffชื่ออุปกรณ์,รหัสอุปกรณ์,หมวดหมู่,URL รูปภาพ,รายละเอียด\nอุปกรณ์ตัวอย่าง,SMO-EXAMPLE,ครุภัณฑ์,,รายละเอียดอุปกรณ์\n";
    const url = URL.createObjectURL(
      new Blob([data], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "equipment-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              นำเข้าอุปกรณ์จากไฟล์
            </h3>
            <p className="text-sm muted mt-2">
              รองรับ Excel (.xlsx, .xls) และตารางใน Word (.docx) ไม่เกิน 10 MB /
              500 แถว
            </p>
          </div>
          <Button variant="outline" onClick={template}>
            <Download />
            แม่แบบ CSV
          </Button>
        </div>
        <label className="mt-5 flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/40 p-5">
          <Upload className="size-5" />
          {busy ? "กำลังประมวลผล..." : "เลือกไฟล์ที่ต้องการนำเข้า"}
          <input
            aria-label="ไฟล์นำเข้าอุปกรณ์"
            type="file"
            accept=".xlsx,.xls,.docx"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              load(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {rows.length > 0 && (
          <div className="mt-5">
            <p className="mb-3">
              พร้อมนำเข้า {rows.filter((r) => !r.error).length} / {rows.length}{" "}
              รายการ
            </p>
            <div className="max-h-72 overflow-auto rounded border">
              <Table className="w-full text-left text-sm">
                <TableCaption className="sr-only">
                  ตรวจสอบก่อนนำเข้า
                </TableCaption>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead className="p-3">ชื่อ / รหัส</TableHead>
                    <TableHead className="p-3">ผลตรวจ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.row} className="border-t">
                      <TableCell className="p-3">
                        {r.data.title}
                        <span className="block muted">{r.data.assetCode}</span>
                      </TableCell>
                      <TableCell className="p-3">
                        {r.error || "พร้อมนำเข้า"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button
                disabled={busy || !rows.some((r) => !r.error)}
                onClick={submit}
              >
                {busy
                  ? "นำเข้าแล้ว " + done + " รายการ"
                  : "ยืนยันนำเข้ารายการที่ผ่าน"}
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => setRows([])}
              >
                ล้างรายการ
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive mt-3">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
