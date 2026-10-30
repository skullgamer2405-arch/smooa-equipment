import { useEffect, useRef, useState } from "react";
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
import { saveEquipment, demo, adminHeaders } from "../lib/data";
import { prepareImage } from "../lib/image-upload";
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
  const [imageStage, setImageStage] = useState<"" | "preparing" | "uploading">("");
  const actionLock = useRef(false);
  const previewUrl = useRef("");
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
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
    if (actionLock.current) return;
    actionLock.current = true;
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
      // Saved demo records keep their blob URL for the lifetime of this page.
      if (demo && draft.imageUrl === previewUrl.current) previewUrl.current = "";
      if (!mounted.current) return;
      announce(existing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มอุปกรณ์แล้ว");
      onClose();
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || actionLock.current) return;
    actionLock.current = true;
    setImageStage("preparing");
    setBusy(true);
    setError("");
    try {
      const png = await prepareImage(file);
      if (!mounted.current) return;
      if (demo) {
        const url = URL.createObjectURL(png);
        if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
        previewUrl.current = url;
        setDraft((x) => ({ ...x, imageUrl: url }));
        return;
      }
      setImageStage("uploading");
      const body = new FormData();
      body.append("image", png, "equipment.png");
      const headers = await adminHeaders();
      if (!mounted.current) return;
      const r = await fetch("/api/upload-image", { method: "POST", body, headers, signal: AbortSignal.timeout(20000) });
      if (!r.ok)
        throw Error(
          "อัปโหลดไม่สำเร็จ ตรวจว่าเซิร์ฟเวอร์ API พร้อมใช้งาน หรือใช้ URL รูปภาพแทน",
        );
      const d = await r.json();
      if (!d.success || typeof d.imageUrl !== "string" || !d.imageUrl) throw Error("อัปโหลดไม่สำเร็จ");
      if (mounted.current) setDraft((x) => ({ ...x, imageUrl: d.imageUrl }));
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      actionLock.current = false;
      if (mounted.current) setImageStage("");
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open && !actionLock.current) onClose();
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
              disabled={busy}
              placeholder="https://..."
              {...text("imageUrl")}
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3">
            <Upload className="size-4" />
            อัปโหลดภาพอุปกรณ์
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy}
              aria-describedby="eq-image-help"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void upload(file);
              }}
            />
          </label>
          <p id="eq-image-help" className="text-sm muted">PNG, JPEG หรือ WebP ไม่เกิน 10 MB ระบบจะเตรียม PNG ไม่เกิน 3 MB</p>
          {imageStage && <p role="status" className="text-sm muted">{imageStage === "preparing" ? "กำลังเตรียมภาพ..." : "กำลังอัปโหลดภาพ..."}</p>}
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
              {busy && !imageStage ? "กำลังบันทึก..." : "บันทึกอุปกรณ์"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
