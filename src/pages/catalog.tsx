import { useState } from "react";
import { Link, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Search,
  CalendarDays,
  ClipboardList,
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
import { demo } from "../lib/data";
import { dateLabel, parseInputDate } from "../lib/utils";
import { Scanner } from "../components/qr";
import { bookingReceipt } from "../lib/booking-receipt";
const categories: Record<string, string> = {
  all: "ทุกหมวดหมู่",
  sports: "กีฬา",
  misc: "อุปกรณ์จิปาถะ",
  inventory: "ครุภัณฑ์",
};
export function HomePage() {
  const { equipment, equipmentTotals, errors, isLoading } = useData();
  const [search,setSearch]=useState("");
  const navigate=useNavigate();
  return <>
    <section className="mb-8 border-b pb-6 md:pb-8">
      <h1 className="text-primary">ยืมอุปกรณ์สำหรับกิจกรรมนักศึกษา</h1>
      <p className="muted mt-3 max-w-2xl">เลือกอุปกรณ์ ระบุวันใช้งาน แล้วส่งคำขอให้ผู้ดูแลตรวจสอบ</p>
      <form action="/equipment.html" onSubmit={event=>{event.preventDefault();navigate("/equipment.html?"+new URLSearchParams({search:search.trim()}));}} className="mt-5 flex flex-col gap-3 sm:flex-row max-w-3xl">
        <div className="relative flex-1"><label className="sr-only" htmlFor="home-search">ค้นหาอุปกรณ์</label><SearchIcon/><Input id="home-search" name="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="ชื่ออุปกรณ์หรือรหัส เช่น ไมโครโฟน…" className="h-12 bg-white pl-10"/></div>
        <Button type="submit" className="h-12"><Search aria-hidden="true"/>ค้นหาอุปกรณ์</Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link className="inline-flex min-h-11 items-center gap-2 text-primary" to="/calendar.html"><CalendarDays className="size-4" aria-hidden="true"/>ดูปฏิทินการจอง</Link>
        <Link className="inline-flex min-h-11 items-center gap-2 text-primary" to="/my-bookings.html"><ClipboardList className="size-4" aria-hidden="true"/>ติดตามรายการของฉัน</Link>
      </div>
    </section>
    <section className="mb-8" aria-label="อุปกรณ์พร้อมให้ยืม">
      <SectionHeading title="อุปกรณ์พร้อมให้ยืม" link="/equipment.html?status=available"/>
      <div className="flex flex-wrap gap-2 mb-5">{Object.entries(categories).map(([key,label])=><Button key={key} variant="outline" asChild><Link to={key==="all"?"/equipment.html":"/equipment.html?category="+key}>{label}</Link></Button>)}</div>
      <DataStatus collection="equipment">{equipment.some(e=>e.status==="available")?<div className="data-grid">{equipment.filter(e=>e.status==="available").slice(0,4).map(item=><EquipmentCard key={item.id} equipment={item}/>)}</div>:<Empty title={equipmentTotals.available ? "ยังไม่พบอุปกรณ์พร้อมยืมในชุดที่โหลด" : "ยังไม่มีอุปกรณ์พร้อมให้ยืม"} description={equipmentTotals.available ? "เปิดรายการอุปกรณ์เพื่อโหลดรายการเพิ่มเติม" : "เปิดรายการทั้งหมดเพื่อดูสถานะ หรือติดต่อผู้ดูแลตามช่องทางของสโมสร"} action={<Button asChild variant="outline"><Link to="/equipment.html?status=available">ดูอุปกรณ์ทั้งหมด</Link></Button>}/>}</DataStatus>
    </section>
    <section aria-label="สถิติอุปกรณ์" className="grid grid-cols-2 gap-4 border-y py-5 md:grid-cols-4">
      {[["อุปกรณ์ทั้งหมด","all"],["พร้อมให้ยืม","available"],["กำลังถูกยืม","unavailable"],["อยู่ระหว่างซ่อม","maintenance"]].map(([label,key])=><div key={key}><p className="text-sm muted">{label}</p><p className="mt-2 text-2xl text-primary tabular-nums">{errors.equipment||isLoading("equipment")?"—":equipmentTotals[key]??"—"}<span className="text-sm muted ml-2">รายการ</span></p></div>)}
    </section>
    <details className="mt-6 rounded-lg border bg-white p-4"><summary className="min-h-11 cursor-pointer text-primary">วิธียืมอุปกรณ์และข้อควรทราบ</summary><ol className="list-decimal pl-5 mt-3 space-y-2"><li>เลือกอุปกรณ์และวันใช้งาน</li><li>กรอกข้อมูลแล้วส่งคำขอ การส่งคำขอยังไม่ถือว่าอนุมัติ</li><li>รอผลจากผู้ดูแล แล้วนัดหมายรับ–คืนตามช่องทางที่ตกลงกัน</li></ol></details>
  </>;
}
export function CatalogPage() {
  const { equipment, hasMoreEquipment, moreEquipment, equipmentBusy } = useData();
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
          พบ {items.length} รายการจาก {equipment.length} รายการที่โหลด
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
            title={hasMoreEquipment ? "ยังไม่พบในรายการที่โหลด" : "ไม่พบอุปกรณ์ที่ค้นหา"}
            description={hasMoreEquipment ? "โหลดอุปกรณ์ชุดถัดไปเพื่อค้นหาต่อ" : "ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น"}
            action={
              <Button variant="outline" disabled={equipmentBusy} onClick={() => hasMoreEquipment ? void moreEquipment() : setParams({})}>
                {hasMoreEquipment ? "โหลดอุปกรณ์เพิ่มเติม" : "ดูอุปกรณ์ทั้งหมด"}
              </Button>
            }
          />
        )}
      </DataStatus>
      {hasMoreEquipment&&<div className="mt-6 flex flex-wrap items-center gap-3"><Button variant="outline" disabled={equipmentBusy} onClick={()=>void moreEquipment()}>{equipmentBusy?"กำลังโหลด…":"โหลดอุปกรณ์เพิ่มเติม"}</Button><p className="text-sm muted">ค้นหาจากอุปกรณ์ที่โหลดแล้ว {equipment.length} รายการ</p></div>}
    </>
  );
}
export function SuccessPage() {
  const location = useLocation();
  const [saved] = useState(()=>{try{return JSON.parse(sessionStorage.getItem(`smo-booking-receipt-${demo?"demo":"live"}`)||"null");}catch{return null;}});
  const receipt = bookingReceipt(location.state) || bookingReceipt(saved);
  const id = receipt?.bookingId;
  const [copied,setCopied]=useState(false);
  return (
    <div className="mx-auto max-w-xl py-6 md:py-12">
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="grid size-14 place-items-center rounded-full bg-[#edf8f0] text-[#225538] mb-6">
            <CheckCircle2 className="size-8" />
          </div>

          <h1 className="text-primary">ส่งคำขอยืมสำเร็จ</h1>
          <p className="muted mt-4">
            คำขอของคุณอยู่ระหว่างรอแอดมินอนุมัติ
            กรุณารอการติดต่อยืนยันก่อนเข้ารับอุปกรณ์
          </p>
          {id&&<div className="mt-5 rounded-lg bg-muted p-4">
            {receipt?.equipmentName&&<><h2 className="text-xl">{receipt.equipmentName}</h2><p className="text-sm muted mt-1">{receipt.assetCode}</p></>}
            {receipt?.startDate && receipt.endDate && <p className="mt-2">{dateLabel(parseInputDate(receipt.startDate))} – {dateLabel(parseInputDate(receipt.endDate))}</p>}
            <p className="mt-3 break-all text-sm">รหัสคำขอ: {id}</p>
            <Button variant="outline" className="mt-3" onClick={async()=>{try{await navigator.clipboard.writeText(id);setCopied(true);}catch{setCopied(false);}}}>คัดลอกรหัสคำขอ</Button>
            {copied&&<p role="status" className="mt-2 text-sm">คัดลอกรหัสแล้ว</p>}
          </div>}
          {receipt?.lineRequested && (
            <p className="mt-4 text-sm" role="status">
              {demo ? "โหมดทดลอง: แสดงการติดตามรายการจำลอง ไม่มีการเชื่อมบัญชีหรือส่งข้อความ LINE จริง" : "ผูกคำขอนี้กับ LINE แล้ว ระบบจะส่งผลอนุมัติและเตือนคืนผ่านแชท LINE OA กรุณาคงการเพิ่มเพื่อนไว้"}
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
            {receipt?.lineRequested&&<Button asChild><Link to="/my-bookings.html">ติดตามรายการยืมของฉัน</Link></Button>}
            <Button asChild variant={receipt?.lineRequested?"outline":"default"}>
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
