import { useState } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  Package,
  CalendarDays,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import { useData } from "../context";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { Card, CardContent } from "../components/ui/card";
import {
  PageHeading,
  DataStatus,
  EquipmentCard,
  Empty,
  SectionHeading,
  SearchIcon,
} from "../components/shared";
import { Scanner } from "../components/qr";
const categories: Record<string, string> = {
  all: "ทุกหมวดหมู่",
  sports: "กีฬา",
  misc: "อุปกรณ์จิปาถะ",
  inventory: "ครุภัณฑ์",
};
export function HomePage() {
  const { equipment, bookings, errors, loading } = useData();
  const [search, setSearch] = useState("");
  return (
    <>
      <div className="eyebrow mb-4">SMO.CRA / STUDENT RESOURCES</div>
      <section className="grid gap-8 border-b pb-10 md:grid-cols-[1.5fr_1fr] md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-sm text-primary mb-4">
            <span className="size-2 rounded-full bg-[#af8032]" />
            พื้นที่สำหรับทุกกิจกรรมของนักศึกษา
          </span>
          <h1 className="max-w-2xl text-primary">
            อุปกรณ์พร้อมใช้
            <br />
            ให้ทุกกิจกรรมเป็นไปได้
          </h1>
          <p className="muted mt-4 max-w-xl">
            ค้นหาอุปกรณ์ที่ต้องการ ตรวจสอบวันว่าง และส่งคำขอยืมได้ในที่เดียว
            เพื่อให้คุณมีเวลาโฟกัสกับกิจกรรมมากขึ้น
          </p>
          <form
            action="/equipment.html"
            className="mt-6 flex flex-col gap-2 sm:flex-row"
          >
            <label htmlFor="home-search" className="sr-only">
              ค้นหาอุปกรณ์
            </label>
            <div className="relative flex-1">
              <SearchIcon />
              <Input
                id="home-search"
                name="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่ออุปกรณ์หรือรหัส..."
                className="bg-white pl-10 h-12"
              />
            </div>
            <Button type="submit" className="h-12">
              <Search />
              ค้นหาอุปกรณ์
            </Button>
          </form>
          <Link
            to="/calendar.html"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-primary"
          >
            <CalendarDays className="size-4" />
            ดูปฏิทินการจอง <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="rounded-xl border bg-white p-6 md:p-8">
          <p className="eyebrow">เริ่มต้นใช้งาน</p>
          <h2 className="text-primary mt-2 mb-6">ยืมง่าย ใน 3 ขั้นตอน</h2>
          {[
            ["เลือกอุปกรณ์", "ค้นหาและตรวจสอบสถานะพร้อมให้ยืม"],
            ["ส่งคำขอยืม", "กรอกข้อมูลและระบุวันใช้งาน"],
            ["รออนุมัติและรับอุปกรณ์", "ตรวจสอบวันนัดหมาย แล้วรับอุปกรณ์"],
          ].map(([t, d], i) => (
            <div key={t} className="flex gap-4 py-4 border-t">
              <span className="number-step shrink-0">{i + 1}</span>
              <div>
                <h3 className="text-base">{t}</h3>
                <p className="text-sm muted mt-1">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section
        aria-label="สถิติอุปกรณ์"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-8"
      >
        {[
          {
            label: "อุปกรณ์ทั้งหมด",
            value: equipment.length,
            icon: Package,
            scope: "equipment",
          },
          {
            label: "พร้อมให้ยืม",
            value: equipment.filter((e) => e.status === "available").length,
            icon: CheckCircle2,
            scope: "equipment",
          },
          {
            label: "กำลังถูกยืม",
            value: bookings.filter((b) => b.status === "approved").length,
            icon: CalendarDays,
            scope: "bookings",
          },
          {
            label: "คำขอรออนุมัติ",
            value: bookings.filter((b) => b.status === "pending").length,
            icon: ClipboardList,
            scope: "bookings",
          },
        ].map(({ label, value, icon: Icon, scope }) => (
          <div key={label} className="border-l-2 border-[#d6af5b] pl-4 py-2">
            <div className="flex gap-2 items-center muted text-sm">
              <Icon className="size-4" />
              {label}
            </div>
            <p className="text-[30px] text-primary mt-1">
              {loading || errors[scope as keyof typeof errors]
                ? "—"
                : value.toLocaleString("th-TH")}
              <span className="text-sm muted ml-2">รายการ</span>
            </p>
          </div>
        ))}
      </section>
      <section>
        <SectionHeading
          title="อุปกรณ์ที่เพิ่งเพิ่มเข้ามา"
          link="/equipment.html"
        />
        <DataStatus collection="equipment">
          {equipment.length ? (
            <div className="data-grid">
              {equipment.slice(0, 4).map((e) => (
                <EquipmentCard key={e.id} equipment={e} />
              ))}
            </div>
          ) : (
            <Empty description="อุปกรณ์ที่เพิ่มเข้าระบบจะแสดงที่นี่" />
          )}
        </DataStatus>
      </section>
      <section className="mt-10 flex flex-col gap-4 rounded-lg border bg-[#edf2f7] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl text-primary">วางแผนวันใช้งานไว้ก่อน</h2>
          <p className="muted mt-1">
            ตรวจสอบตารางการจอง เพื่อเลือกวันที่เหมาะกับกิจกรรมของคุณ
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/calendar.html">
            เปิดปฏิทิน <ArrowRight />
          </Link>
        </Button>
      </section>
    </>
  );
}
export function CatalogPage() {
  const { equipment } = useData();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "",
    category = params.get("category") || "all",
    status = params.get("status") || "all";
  function update(key: string, value: string) {
    const p = new URLSearchParams(params);
    value && value !== "all" ? p.set(key, value) : p.delete(key);
    setParams(p, { replace: true });
  }
  const items = equipment.filter(
    (e) =>
      (category === "all" ||
        e.category === categories[category] ||
        e.category === category) &&
      (status === "all" || e.status === status) &&
      [e.title, e.assetCode, e.category, e.description]
        .join(" ")
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="ทรัพยากรสำหรับนักศึกษา"
        title="เลือกอุปกรณ์สำหรับกิจกรรม"
        description="ค้นหาสิ่งที่ต้องการ แล้วส่งคำขอยืมตามวันใช้งานของคุณ"
        action={<Scanner />}
      />
      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <label htmlFor="equipment-search" className="sr-only">
            ค้นหาอุปกรณ์
          </label>
          <SearchIcon />
          <Input
            id="equipment-search"
            value={search}
            onChange={(e) => update("search", e.target.value)}
            className="pl-10"
            placeholder="ค้นหาชื่อ รหัส หรือรายละเอียด..."
          />
        </div>
        <Select value={category} onValueChange={(v) => update("category", v)}>
          <SelectTrigger aria-label="หมวดหมู่อุปกรณ์" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(categories).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => update("status", v)}>
          <SelectTrigger aria-label="สถานะอุปกรณ์" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="available">พร้อมให้ยืม</SelectItem>
            <SelectItem value="unavailable">กำลังถูกยืม</SelectItem>
            <SelectItem value="maintenance">อยู่ระหว่างซ่อม</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3 my-5">
        <p className="muted" role="status">
          พบ {items.length} รายการ
        </p>
        {(search || category !== "all" || status !== "all") && (
          <Button variant="ghost" onClick={() => setParams({})}>
            ล้างตัวกรอง
          </Button>
        )}
      </div>
      <DataStatus collection="equipment">
        {items.length ? (
          <div className="data-grid">
            {items.map((e) => (
              <EquipmentCard key={e.id} equipment={e} />
            ))}
          </div>
        ) : (
          <Empty
            title="ไม่พบอุปกรณ์ที่ค้นหา"
            description="ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น"
            action={
              <Button variant="outline" onClick={() => setParams({})}>
                ดูอุปกรณ์ทั้งหมด
              </Button>
            }
          />
        )}
      </DataStatus>
    </>
  );
}
export function SuccessPage() {
  const location = useLocation();
  const id = location.state?.bookingId;
  return (
    <div className="mx-auto max-w-xl py-6 md:py-12">
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="grid size-14 place-items-center rounded-full bg-[#edf8f0] text-[#225538] mb-6">
            <CheckCircle2 className="size-8" />
          </div>
          <p className="eyebrow">คำขอถูกส่งแล้ว</p>
          <h1 className="text-primary">ส่งคำขอยืมสำเร็จ</h1>
          <p className="muted mt-4">
            คำขอของคุณอยู่ระหว่างรอแอดมินอนุมัติ
            กรุณารอการติดต่อยืนยันก่อนเข้ารับอุปกรณ์
          </p>
          {id && (
            <p className="mt-4 break-all rounded-lg bg-muted p-3 text-sm">
              รหัสคำขอ: {id}
            </p>
          )}
          <div className="my-6 border-y py-5">
            <h2 className="text-lg">ขั้นตอนถัดไป</h2>
            <p className="muted mt-2">
              แอดมินจะตรวจสอบอุปกรณ์และวันใช้งาน หากมีการอนุมัติ
              ระบบจะแสดงรายการในปฏิทินการจอง
            </p>
          </div>
          <div className="grid gap-3">
            <Button asChild>
              <Link to="/calendar.html">
                <CalendarDays />
                ดูปฏิทินการจอง
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/equipment.html">
                เลือกดูอุปกรณ์เพิ่มเติม <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">กลับหน้าหลัก</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
