import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../components/ui/table";
import { useMemo, useState, useRef } from "react";
import {
  Plus,
  Printer,
  Pencil,
  Trash2,
  Undo2,
  Check,
  X,
  ShieldCheck,
  Mail,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useData } from "../context";
import * as api from "../lib/data";
import type { Booking, Equipment } from "../lib/types";
import { asDate, dateLabel } from "../lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "../components/ui/alert-dialog";
import { PageHeading, DataStatus, Empty, Status } from "../components/shared";
import { QRDialog, printLabels } from "../components/qr";
import { EquipmentEditor } from "../components/admin-equipment";
import { AdminImport } from "../components/admin-import";
function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api.login(String(d.get("email")).trim(), String(d.get("password")));
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจอีเมล รหัสผ่าน และการเชื่อมต่อ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md py-6 md:py-12">
      <Card>
        <CardContent className="p-6 md:p-8">
          <ShieldCheck className="size-10 text-primary mb-5" />
          <p className="eyebrow">สำหรับผู้ดูแลระบบ</p>
          <h1>เข้าสู่ระบบจัดการ</h1>
          <p className="muted mt-3 mb-6">
            จัดการคำขอยืมและอุปกรณ์ของสโมสรนักศึกษา
          </p>
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <Label htmlFor="admin-email">อีเมลผู้ดูแล</Label>
              <Input
                type="email"
                id="admin-email"
                name="email"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="admin-password">รหัสผ่าน</Label>
              <Input
                type="password"
                id="admin-password"
                name="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy}>
              {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
          {api.demo && (
            <p className="mt-5 rounded bg-muted p-3 text-sm">
              บัญชีตัวอย่าง: admin@example.invalid
              <br />
              รหัสผ่าน: demo-only
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
type Action = {
  title: string;
  description: string;
  danger?: boolean;
  reason?: boolean;
  run: (note: string) => Promise<void>;
};
export function AdminPage() {
  const actionTrigger = useRef<HTMLElement | null>(null);
  const editorTrigger = useRef<HTMLElement | null>(null);
  function restoreFocus(element: HTMLElement | null) {
    if (element?.isConnected) element.focus();
    else
      document
        .querySelector<HTMLElement>(
          '[data-slot="tabs-trigger"][data-state="active"]',
        )
        ?.focus();
  }
  function edit(item: Equipment | "new") {
    editorTrigger.current = document.activeElement as HTMLElement;
    setEditing(item);
  }

  const { user, authReady, equipment, bookings, announce, errors, loading } =
    useData();
  const [params, setParams] = useSearchParams();
  const tab = ["requests", "equipment", "settings"].includes(
    params.get("tab") || "",
  )
    ? params.get("tab")!
    : "requests";
  const [editing, setEditing] = useState<Equipment | null | "new">(null),
    [action, setAction] = useState<Action | null>(null),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("pending"),
    [page, setPage] = useState(1);
  const pending = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            (filter === "all" || b.status === filter) &&
            [b.fullName, b.studentId, b.equipmentName]
              .join(" ")
              .includes(search),
        )
        .sort(
          (a, b) => +(asDate(b.createdAt) || 0) - +(asDate(a.createdAt) || 0),
        ),
    [bookings, filter, search],
  );
  const pages = Math.max(1, Math.ceil(pending.length / 10));
  const currentPage = Math.min(page, pages);
  const visibleBookings = pending
    .slice((currentPage - 1) * 10, currentPage * 10)
    .map((booking) => ({
      booking,
      equipment: equipment.find((e) => e.id === booking.equipmentId),
    }));
  function confirm(a: Action) {
    actionTrigger.current = document.activeElement as HTMLElement;
    setNote("");
    setError("");
    setAction(a);
  }
  async function execute() {
    if (!action || busy) return;
    setBusy(true);
    setError("");
    try {
      await action.run(note);
      setAction(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function decision(booking: Booking, status: "approved" | "rejected") {
    const eq = equipment.find((e) => e.id === booking.equipmentId);
    confirm({
      title:
        status === "approved" ? "ยืนยันอนุมัติคำขอ" : "ยืนยันไม่อนุมัติคำขอ",
      description: `${eq?.title || "ไม่พบอุปกรณ์"} · ${eq?.assetCode || booking.equipmentId} สำหรับ ${booking.fullName}`,
      danger: status === "rejected",
      reason: status === "rejected",
      run: async (note) => {
        await api.decideBooking(booking.id, status, note);
        announce(
          status === "approved" ? "อนุมัติคำขอแล้ว" : "บันทึกการไม่อนุมัติแล้ว",
        );
        if (booking.applicantEmail) {
          try {
            await api.notify(
              status === "approved"
                ? "notify-borrower-approved"
                : "notify-borrower-rejected",
              {
                ...booking,
                equipmentName: eq?.title || booking.equipmentName,
                adminNote: note,
              },
            );
          } catch {
            announce("เปลี่ยนสถานะแล้ว แต่การแจ้งเตือนยังไม่สำเร็จ");
          }
        }
      },
    });
  }
  if (!authReady) return <p role="status">กำลังตรวจสอบการเข้าสู่ระบบ...</p>;
  if (!user) return <Login />;
  return (
    <>
      <PageHeading
        eyebrow="ADMIN WORKSPACE"
        title="จัดการคำขอและอุปกรณ์"
        description="ตรวจคำขอ ดูแลอุปกรณ์ และเตรียมความพร้อมให้กิจกรรมนักศึกษา"
        action={
          <Button onClick={() => edit("new")}>
            <Plus />
            เพิ่มอุปกรณ์
          </Button>
        }
      />
      <section
        aria-label="สถิติการจัดการ"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6"
      >
        {[
          [
            "คำขอรออนุมัติ",
            bookings.filter((b) => b.status === "pending").length,
          ],
          [
            "อยู่ระหว่างการยืม",
            bookings.filter((b) => b.status === "approved").length,
          ],
          [
            "เลยกำหนดคืน",
            bookings.filter(
              (b) =>
                b.status === "approved" &&
                asDate(b.endDate) &&
                asDate(b.endDate)! < new Date(),
            ).length,
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="muted">{label}</p>
              <p className="text-[30px] text-primary mt-2">
                {errors.bookings || loading ? "—" : value}
                <span className="text-sm muted ml-2">รายการ</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="h-auto w-full flex-wrap justify-start mb-6 bg-transparent gap-2 p-0">
          <TabsTrigger
            value="requests"
            className="min-h-11 px-5 border data-[state=active]:bg-primary! data-[state=active]:text-white!"
          >
            คำขอยืม
          </TabsTrigger>
          <TabsTrigger
            value="equipment"
            className="min-h-11 px-5 border data-[state=active]:bg-primary! data-[state=active]:text-white!"
          >
            จัดการอุปกรณ์
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="min-h-11 px-5 border data-[state=active]:bg-primary! data-[state=active]:text-white!"
          >
            การแจ้งเตือน
          </TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <div className="flex flex-col gap-3 sm:flex-row mb-5">
            <label className="relative flex-1">
              <span className="sr-only">ค้นหาคำขอ</span>
              <Search className="absolute left-3 top-3.5 size-5 muted" />
              <Input
                className="pl-10 bg-white"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="ค้นหาชื่อ รหัสนักศึกษา หรืออุปกรณ์"
              />
            </label>
            <label>
              <span className="sr-only">กรองสถานะคำขอ</span>
              <select
                className="min-h-11 rounded-md border bg-white px-3 w-full"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="pending">รออนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ไม่อนุมัติ</option>
                <option value="returned">คืนแล้ว</option>
                <option value="all">ทุกสถานะ</option>
              </select>
            </label>
          </div>
          <DataStatus collection="bookings">
            {pending.length ? (
              <>
                <div className="hidden md:block rounded-lg border bg-white overflow-auto">
                  <Table className="w-full text-left">
                    <TableCaption className="sr-only">
                      รายการคำขอยืมอุปกรณ์
                    </TableCaption>
                    <TableHeader className="bg-muted text-sm muted">
                      <TableRow>
                        {[
                          "ผู้ยืม / กิจกรรม",
                          "อุปกรณ์",
                          "วันยืม–คืน",
                          "สถานะ / การดำเนินการ",
                        ].map((t) => (
                          <TableHead key={t} className="p-4">
                            {t}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleBookings.map(({ booking: b, equipment: eq }) => (
                        <TableRow key={b.id} className="border-t align-top">
                          <TableCell className="p-4">
                            <p>{b.fullName}</p>
                            <p className="text-sm muted">
                              {b.studentId} · {b.faculty}
                            </p>
                            <p className="text-sm mt-2">{b.activityName}</p>
                            <p className="text-sm muted">{b.reason}</p>
                          </TableCell>
                          <TableCell className="p-4">
                            {eq?.title || "ไม่พบอุปกรณ์"}
                            <p className="text-sm muted">
                              {eq?.assetCode || b.equipmentId}
                            </p>
                          </TableCell>
                          <TableCell className="p-4 text-sm">
                            {dateLabel(b.startDate)}
                            <br />
                            {dateLabel(b.endDate)}
                          </TableCell>
                          <TableCell className="p-4">
                            <Status value={b.status} />
                            {b.status === "pending" && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                <Button
                                  onClick={() => decision(b, "approved")}
                                  disabled={!eq}
                                >
                                  <Check />
                                  อนุมัติ
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => decision(b, "rejected")}
                                >
                                  <X />
                                  ไม่อนุมัติ
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-4 md:hidden">
                  {visibleBookings.map(({ booking: b, equipment: eq }) => (
                    <Card key={b.id}>
                      <CardContent className="p-5">
                        <div className="flex flex-wrap gap-3 justify-between mb-3">
                          <h3>{b.fullName}</h3>
                          <Status value={b.status} />
                        </div>
                        <p className="muted text-sm">
                          {b.studentId} · {b.faculty}
                        </p>
                        <p className="mt-3">
                          {eq?.title || "ไม่พบอุปกรณ์"} ·{" "}
                          {eq?.assetCode || b.equipmentId}
                        </p>
                        <p className="text-sm muted my-2">
                          {dateLabel(b.startDate)} – {dateLabel(b.endDate)}
                        </p>
                        <p>{b.activityName}</p>
                        <p className="text-sm muted">{b.reason}</p>
                        {b.status === "pending" && (
                          <div className="flex flex-wrap gap-3 mt-4">
                            <Button
                              onClick={() => decision(b, "approved")}
                              disabled={!eq}
                            >
                              อนุมัติ
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => decision(b, "rejected")}
                            >
                              ไม่อนุมัติ
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-between items-center gap-3 mt-5">
                  <p className="text-sm muted">
                    หน้า {currentPage} / {pages} · {pending.length} รายการ
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="หน้าก่อนหน้า"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="หน้าถัดไป"
                      disabled={currentPage === pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <Empty
                title="ไม่มีคำขอในสถานะนี้"
                description="คำขอใหม่จะแสดงเมื่อมีนักศึกษาส่งเข้ามา"
              />
            )}
          </DataStatus>
        </TabsContent>
        <TabsContent value="equipment">
          <div className="flex flex-wrap justify-between gap-3 mb-5">
            <h2 className="text-xl">อุปกรณ์ทั้งหมด</h2>
            <Button
              variant="outline"
              onClick={() =>
                printLabels(equipment).catch((e) => announce(e.message))
              }
              disabled={!equipment.length}
            >
              <Printer />
              พิมพ์ QR ทั้งหมด
            </Button>
          </div>
          <DataStatus collection="equipment">
            {!equipment.length ? (
              <Empty />
            ) : (
              <div className="grid gap-3 mb-6">
                {equipment.map((e) => (
                  <div
                    key={e.id}
                    className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <h3 className="text-lg">{e.title}</h3>
                      <p className="muted text-sm mt-1">
                        {e.assetCode} · {e.category}
                      </p>
                      <div className="mt-2">
                        <Status value={e.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <QRDialog equipment={e} />
                      <Button variant="outline" onClick={() => edit(e)}>
                        <Pencil />
                        แก้ไข
                      </Button>
                      {e.status === "unavailable" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            confirm({
                              title: "ยืนยันรับคืนอุปกรณ์",
                              description: e.title,
                              run: async () => {
                                await api.returnEquipment(e.id);
                                announce("รับคืนอุปกรณ์แล้ว");
                              },
                            })
                          }
                        >
                          <Undo2 />
                          รับคืน
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="text-destructive"
                        aria-label={"ลบ " + e.title}
                        onClick={() =>
                          confirm({
                            title: "ลบอุปกรณ์นี้?",
                            description:
                              e.title + " · การลบไม่สามารถย้อนกลับได้",
                            danger: true,
                            run: async () => {
                              await api.removeEquipment(e.id);
                              announce("ลบอุปกรณ์แล้ว");
                            },
                          })
                        }
                      >
                        <Trash2 />
                        ลบ
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataStatus>
          <AdminImport />
        </TabsContent>
        <TabsContent value="settings">
          <Settings />
        </TabsContent>
      </Tabs>
      <EquipmentEditor
        key={typeof editing === "object" ? editing?.id : "new"}
        item={editing}
        onClose={() => setEditing(null)}
        onRestoreFocus={() => restoreFocus(editorTrigger.current)}
      />
      <AlertDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus(actionTrigger.current);
          }}
        >
          <AlertDialogTitle>{action?.title}</AlertDialogTitle>
          <AlertDialogDescription>{action?.description}</AlertDialogDescription>
          {action?.reason && (
            <div>
              <Label htmlFor="decision-note">เหตุผล / หมายเหตุ</Label>
              <Textarea
                id="decision-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
            <Button
              variant={action?.danger ? "destructive" : "default"}
              onClick={execute}
              disabled={busy}
            >
              {busy ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function Settings() {
  const [url, setUrl] = useState(api.webhook()),
    [error, setError] = useState(""),
    [testing, setTesting] = useState(false);
  const { announce } = useData();
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-5 md:p-6">
        <h2 className="text-xl flex items-center gap-2">
          <Mail className="size-5" />
          อีเมลแจ้งเตือน
        </h2>
        <p className="muted mt-3 mb-5">
          ตั้งค่า Google Apps Script Web App สำหรับแจ้งเตือนผู้ดูแลและผู้ยืม
          การตั้งค่านี้บันทึกเฉพาะเบราว์เซอร์ที่ใช้งาน
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            try {
              api.saveWebhook(url.trim());
              announce("บันทึกการตั้งค่าการแจ้งเตือนแล้ว");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Label htmlFor="webhook-url">URL ของ Google Apps Script</Label>
          <Input
            id="webhook-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
          />
          <p className="text-sm muted mt-2">
            เว้นว่างเพื่อใช้เซิร์ฟเวอร์ API ที่ตั้งค่าไว้
            การส่งอีเมลจริงขึ้นอยู่กับบริการที่เปิดใช้งาน
          </p>
          {error && (
            <p role="alert" className="text-destructive mt-3">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={testing}>บันทึกการตั้งค่า</Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={async () => {
                setError("");
                if (url.trim() !== api.webhook()) {
                  setError("กรุณาบันทึกการตั้งค่าก่อนส่งทดสอบ");
                  return;
                }
                setTesting(true);
                try {
                  const result = await api.notify("notify-admin-booking", {
                    bookingId: "notification-test",
                    equipmentName: "ทดสอบระบบแจ้งเตือน",
                    fullName: "ผู้ดูแลระบบ",
                    activityName: "ทดสอบการตั้งค่า",
                  });
                  if (!result.success) throw Error("บริการแจ้งเตือนไม่ตอบรับ");
                  announce(
                    result.deliveredToSMTP
                      ? "ส่งอีเมลทดสอบผ่าน SMTP แล้ว"
                      : result.deliveryUnknown
                        ? "ส่งคำขอทดสอบแล้ว เบราว์เซอร์ไม่สามารถยืนยันการส่งอีเมลได้"
                        : "บันทึกการทดสอบแล้ว ยังไม่ได้ส่งอีเมลจริง",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? "กำลังส่งทดสอบ..." : "ส่งอีเมลทดสอบ"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
