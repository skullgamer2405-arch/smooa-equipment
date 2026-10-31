import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Package,
  Search,
  RefreshCw,
  ImageIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Skeleton } from "./ui/skeleton";
import { useData } from "../context";
import type { Equipment } from "../lib/types";
import { safeImage } from "../lib/utils";
import { QRDialog } from "./qr";
export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    available: "พร้อมให้ยืม",
    unavailable: "กำลังถูกยืม",
    maintenance: "อยู่ระหว่างซ่อม",
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ",
    returned: "คืนแล้ว",
  };
  return (
    <span className={"status status-" + value}>
      <span aria-hidden>●</span>
      {labels[value] || value}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading flex-col sm:flex-row">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted mt-2">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
export function Empty({
  title = "ยังไม่มีรายการ",
  description = "เมื่อมีข้อมูล รายการจะแสดงที่นี่",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Package className="mx-auto mb-3 size-8 muted" />
      <h3>{title}</h3>
      <p className="muted mt-2 mb-4">{description}</p>
      {action}
    </div>
  );
}
export function DataStatus({
  collection,
  children,
}: {
  collection: "equipment" | "bookings" | "calendarEntries";
  children: ReactNode;
}) {
  const { errors, isLoading, retry } = useData();
  const loading = isLoading(collection);
  if (errors[collection])
    return (
      <div role="alert" className="rounded-lg border bg-white p-6">
        <AlertCircle className="mb-3 text-destructive" />
        <h3>ไม่สามารถโหลดข้อมูลได้</h3>
        <p className="muted my-3">{errors[collection]}</p>
        <Button variant="outline" onClick={retry}>
          <RefreshCw />
          ลองใหม่
        </Button>
      </div>
    );
  if (loading)
    return (
      <div
        className="grid gap-4 sm:grid-cols-3"
        aria-busy="true"
        aria-label="กำลังโหลดข้อมูล"
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  return <>{children}</>;
}
export function EquipmentImage({
  equipment,
  large = false,
}: {
  equipment: Equipment;
  large?: boolean;
}) {
  const [failed, setFailed] = useState<string | undefined>();
  if (!equipment.imageUrl || failed === equipment.imageUrl || safeImage(equipment.imageUrl) === "/equipment-placeholder.svg") return <div role="img" aria-label={equipment.title} className="flex min-h-20 items-center justify-center gap-3 rounded bg-muted p-3 text-sm muted"><Package className="size-7" aria-hidden="true"/><span>ยังไม่มีภาพอุปกรณ์</span></div>;
  return (
    <img
      src={safeImage(equipment.imageUrl)}
      onError={() => {
        setFailed(equipment.imageUrl);
      }}
      alt={equipment.title}
      width={large ? 1000 : 480}
      height={large ? 750 : 360}
      loading={large ? "eager" : "lazy"}
      className="aspect-[4/3] w-full object-contain"
    />
  );
}
export function EquipmentCard({ equipment }: { equipment: Equipment }) {
  const [photo, setPhoto] = useState(false);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <button
        type="button"
        onClick={() => setPhoto(true)}
        className="relative block w-full bg-[#f0f3f7] p-5"
        aria-label={"ดูรูป " + equipment.title}
      >
        <EquipmentImage equipment={equipment} />
        <span className="absolute bottom-2 right-2 rounded bg-white p-2">
          <ImageIcon className="size-4" />
        </span>
      </button>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm muted mb-3">
          <span>{equipment.category || "อุปกรณ์"}</span>
          <span>{equipment.assetCode}</span>
        </div>
        <h3 className="text-lg mb-2">{equipment.title}</h3>
        <Status value={equipment.status} />
        <p className="muted mt-3 line-clamp-2 min-h-12 text-sm">
          {equipment.description ||
            "สอบถามรายละเอียดเพิ่มเติมจากผู้ดูแลก่อนยืม"}
        </p>
        <Link className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4" to={"/calendar.html?equipmentId="+encodeURIComponent(equipment.id)}>ดูวันใช้งานในปฏิทิน</Link>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" asChild>
            <Link to={"/booking.html?id=" + encodeURIComponent(equipment.id)}>
              {equipment.status === "available" ? "ขอยืมอุปกรณ์นี้" : "ดูสถานะอุปกรณ์"} <ArrowRight />
            </Link>
          </Button>
          <QRDialog equipment={equipment} />
        </div>
      </CardContent>
      <Dialog open={photo} onOpenChange={setPhoto}>
        <DialogContent className="sm:max-w-2xl">
          <DialogTitle>{equipment.title}</DialogTitle>
          <DialogDescription>
            รูปภาพอุปกรณ์ {equipment.assetCode}
          </DialogDescription>
          <EquipmentImage equipment={equipment} large />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
export function SectionHeading({
  title,
  link,
}: {
  title: string;
  link?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h2>{title}</h2>
      {link && (
        <Button asChild variant="ghost">
          <Link to={link}>
            ดูทั้งหมด <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}
export function SearchIcon() {
  return (
    <Search aria-hidden className="absolute left-3 top-3.5 size-5 muted" />
  );
}
