import { useState } from "react";
import { Upload, ImageIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import type { Equipment } from "../lib/types";
import { saveEquipment, demo } from "../lib/data";
import { safeImage } from "../lib/utils";
import { useData } from "../context";
export function EquipmentEditor({
  item,
  onClose,
  onRestoreFocus,
}: {
  item: Equipment | null | "new";
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const existing = item && item !== "new" ? item : null;
  const [draft, setDraft] = useState({
    title: existing?.title || "",
    assetCode: existing?.assetCode || "",
    category: existing?.category || "ครุภัณฑ์",
    description: existing?.description || "",
    imageUrl: existing?.imageUrl || "",
    status: existing?.status || ("available" as Equipment["status"]),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [warning, setWarning] = useState("");
  const { announce } = useData();
  function text(key: "title" | "assetCode" | "description" | "imageUrl") {
    return {
      value: draft[key],
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setDraft((d) => ({ ...d, [key]: e.target.value })),
    };
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        draft.imageUrl &&
        !(demo && draft.imageUrl.startsWith("blob:")) &&
        !/^https?:\/\//.test(draft.imageUrl) &&
        !draft.imageUrl.startsWith("/uploads/")
      )
        throw Error("URL รูปภาพต้องเป็น HTTP/HTTPS หรือไฟล์อัปโหลดของระบบ");
      await saveEquipment(
        {
          ...draft,
          title: draft.title.trim(),
          assetCode: draft.assetCode.trim(),
        },
        existing?.id,
      );
      announce(existing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มอุปกรณ์แล้ว");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("ใช้ PNG, JPEG หรือ WebP ไม่เกิน 10 MB");
      return;
    }
    if (demo) {
      setDraft((x) => ({ ...x, imageUrl: URL.createObjectURL(file) }));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const r = await fetch("/api/upload-image", { method: "POST", body });
      if (!r.ok)
        throw Error(
          "อัปโหลดไม่สำเร็จ ตรวจว่าเซิร์ฟเวอร์ API พร้อมใช้งาน หรือใช้ URL รูปภาพแทน",
        );
      const d = await r.json();
      if (!d.success) throw Error("อัปโหลดไม่สำเร็จ");
      setDraft((x) => ({ ...x, imageUrl: d.imageUrl }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-xl"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          onRestoreFocus();
        }}
      >
        <DialogTitle>{existing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์"}</DialogTitle>
        <DialogDescription>
          ข้อมูลและรูปภาพนี้จะแสดงในรายการอุปกรณ์สำหรับผู้ยืม
        </DialogDescription>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="eq-title">ชื่ออุปกรณ์ *</Label>
              <Input
                id="eq-title"
                required
                maxLength={200}
                {...text("title")}
              />
            </div>
            <div>
              <Label htmlFor="eq-code">รหัสอุปกรณ์ *</Label>
              <Input
                id="eq-code"
                required
                maxLength={50}
                {...text("assetCode")}
              />
            </div>
          </div>
          <div>
            <Label>หมวดหมู่</Label>
            <Select
              value={draft.category}
              onValueChange={(category) =>
                setDraft((d) => ({ ...d, category }))
              }
            >
              <SelectTrigger className="w-full" aria-label="หมวดหมู่">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["ครุภัณฑ์", "กีฬา", "อุปกรณ์จิปาถะ"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>สถานะ</Label>
            <Select
              value={draft.status}
              onValueChange={(status) =>
                setDraft((d) => ({
                  ...d,
                  status: status as Equipment["status"],
                }))
              }
            >
              <SelectTrigger className="w-full" aria-label="สถานะ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">พร้อมให้ยืม</SelectItem>
                <SelectItem value="unavailable">กำลังถูกยืม</SelectItem>
                <SelectItem value="maintenance">อยู่ระหว่างซ่อม</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="eq-description">รายละเอียด</Label>
            <Textarea id="eq-description" rows={3} {...text("description")} />
          </div>
          <div>
            <Label htmlFor="eq-image">URL รูปภาพ</Label>
            <Input
              id="eq-image"
              placeholder="https://..."
              {...text("imageUrl")}
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3">
            <Upload className="size-4" />
            อัปโหลดภาพต้นฉบับ
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          {draft.imageUrl ? (
            <img
              src={safeImage(draft.imageUrl)}
              alt="ตัวอย่างรูปอุปกรณ์"
              className="mx-auto max-h-44 object-contain"
              onLoad={(e) =>
                setWarning(
                  e.currentTarget.naturalWidth < 800
                    ? "ภาพนี้มีความกว้างน้อยกว่า 800px ภาพต้นฉบับที่ใหญ่กว่าจะเห็นรายละเอียดชัดขึ้น"
                    : "",
                )
              }
              onError={() => setWarning("โหลดรูปไม่ได้ กรุณาตรวจ URL รูปภาพ")}
            />
          ) : (
            <div className="flex items-center gap-2 text-sm muted">
              <ImageIcon className="size-4" />
              เพิ่มรูปที่เห็นอุปกรณ์ครบและพื้นหลังเรียบ
            </div>
          )}
          {warning && <p className="text-sm muted">{warning}</p>}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              ยกเลิก
            </Button>
            <Button disabled={busy}>
              {busy ? "กำลังบันทึก..." : "บันทึกอุปกรณ์"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
