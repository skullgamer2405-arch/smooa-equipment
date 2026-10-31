import { useEffect, useRef, useState } from "react";
import { QrCode, Download, Printer, Copy, Camera, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import type { Equipment } from "../lib/types";
import { qrBookingPath } from "../lib/utils";
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function printLabels(items: Equipment[]) {
  const w = window.open("", "_blank");
  if (!w) throw Error("กรุณาอนุญาตหน้าต่างสำหรับพิมพ์");
  const { default: QRCode } = await import("qrcode");
  const labels = await Promise.all(
    items.map(async (e) => ({
      e,
      qr: await QRCode.toDataURL(
        window.location.origin + "/booking.html?id=" + encodeURIComponent(e.id),
        { width: 400, margin: 2, errorCorrectionLevel: "H" },
      ),
    })),
  );
  w.document.write(
    '<!doctype html><html lang="th"><head><title>ป้ายอุปกรณ์</title><style>@font-face{font-family:likit;src:url("' +
      window.location.origin +
      '/fonts/chulabhornlikittext-regular.woff2")}body{font-family:likit,sans-serif;display:flex;flex-wrap:wrap;gap:16px}.label{border:1px solid #aaa;padding:16px;width:240px;text-align:center;break-inside:avoid}img{width:160px;height:160px}h1{font-size:18px;font-weight:400}</style></head><body>' +
      labels
        .map(
          ({ e, qr }) =>
            '<section class="label"><h1>' +
            escape(e.title) +
            "</h1><p>" +
            escape(e.assetCode) +
            '</p><img alt="QR code" src="' +
            qr +
            '"/><p>สแกนเพื่อส่งคำขอยืม</p></section>',
        )
        .join("") +
      "</body></html>",
  );
  w.document.close();
  await w.document.fonts.ready;
  setTimeout(() => w.print(), 400);
}
export function QRDialog({ equipment }: { equipment: Equipment }) {
  const [open, setOpen] = useState(false),
    [image, setImage] = useState(""),
    [message, setMessage] = useState("");
  const url =
    window.location.origin +
    "/booking.html?id=" +
    encodeURIComponent(equipment.id);
  useEffect(() => {
    if (open)
      import("qrcode")
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(url, {
            width: 480,
            margin: 2,
            errorCorrectionLevel: "H",
          }),
        )
        .then(setImage)
        .catch(() => setMessage("สร้าง QR ไม่สำเร็จ"));
  }, [open, url]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={"QR ของ " + equipment.title}
        >
          <QrCode />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>QR สำหรับยืมอุปกรณ์</DialogTitle>
        <DialogDescription>
          {equipment.title} · {equipment.assetCode}
        </DialogDescription>
        {image && (
          <img
            src={image}
            alt={"QR จอง " + equipment.title}
            className="mx-auto w-56"
          />
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a download={"QR-" + equipment.assetCode + ".png"} href={image}>
              <Download />
              บันทึก
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              printLabels([equipment]).catch((e) => setMessage(e.message))
            }
          >
            <Printer />
            พิมพ์
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(url)
                .then(() => setMessage("คัดลอกแล้ว"))
                .catch(() => setMessage("คัดลอกไม่ได้ กรุณาใช้ลิงก์ด้านล่าง"))
            }
          >
            <Copy />
            คัดลอก
          </Button>
        </div>
        <a href={url} className="break-all text-sm underline">
          {url}
        </a>
        <p role="status">{message}</p>
      </DialogContent>
    </Dialog>
  );
}
export function Scanner() {
  const [open, setOpen] = useState(false),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    attempt = useRef(0),
    frame = useRef(0);
  const navigate = useNavigate();
  function stop() {
    attempt.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setRunning(false);
  }
  function result(raw: string) {
    const path = qrBookingPath(raw, window.location.origin);
    if (path) {
      stop();
      setOpen(false);
      navigate(path);
    } else {
      stop();
      setError("QR นี้ไม่ใช่ลิงก์จองอุปกรณ์ของระบบ");
    }
  }
  useEffect(() => {
    if (!open) stop();
    return stop;
  }, [open]);
  async function camera() {
    stop();
    const session = attempt.current;
    setError("");
    try {
      const { default: jsQR } = await import("jsqr");
      if (session !== attempt.current) return;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (session !== attempt.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const v = video.current!;
      v.srcObject = stream.current;
      await v.play();
      if (session !== attempt.current) return;
      setRunning(true);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const scan = () => {
        if (v.readyState >= 2) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);
          const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(d.data, d.width, d.height);
          if (qr) {
            result(qr.data);
            return;
          }
        }
        frame.current = requestAnimationFrame(scan);
      };
      scan();
    } catch {
      if (session !== attempt.current) return;
      stop();
      setError("เปิดกล้องไม่ได้ กรุณาอนุญาตกล้องหรือเลือกรูป QR");
    }
  }
  async function file(f?: File) {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("กรุณาใช้รูปขนาดไม่เกิน 10 MB");
      return;
    }
    try {
      const { default: jsQR } = await import("jsqr");
      const b = await createImageBitmap(f);
      const ratio = Math.min(1, 1600 / Math.max(b.width, b.height));
      const c = document.createElement("canvas");
      c.width = b.width * ratio;
      c.height = b.height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(b, 0, 0, c.width, c.height);
      b.close();
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const qr = jsQR(d.data, d.width, d.height);
      qr ? result(qr.data) : setError("ไม่พบ QR ในรูปนี้");
    } catch {
      setError("อ่านรูปไม่ได้ กรุณาใช้ PNG หรือ JPEG");
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCode />
          สแกน QR
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>สแกน QR อุปกรณ์</DialogTitle>
        <DialogDescription>
          ใช้กล้องหรือเลือกรูป QR ที่ได้จากระบบ
        </DialogDescription>
        <video
          ref={video}
          muted
          playsInline
          className="aspect-video w-full rounded-lg bg-muted"
        />
        {!running && (
          <Button onClick={camera}>
            <Camera />
            เปิดกล้อง
          </Button>
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3">
          <Upload className="size-4" />
          เลือกรูป QR
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => file(e.target.files?.[0])}
          />
        </label>
        <p role="alert" className="text-destructive">
          {error}
        </p>
      </DialogContent>
    </Dialog>
  );
}
