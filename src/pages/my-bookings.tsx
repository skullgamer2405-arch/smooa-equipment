import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, RefreshCw } from "lucide-react";
import { myBookings, demo } from "../lib/data";
import type { MyBooking } from "../lib/types";
import { dateLabel, parseInputDate } from "../lib/utils";
import { Button } from "../components/ui/button";
import { PageHeading, Empty, Status } from "../components/shared";
export function MyBookingsPage() {
  const [items,setItems]=useState<MyBooking[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  async function load(next="") {
    setBusy(true);setError("");
    try{const result=await myBookings(next);setItems(prev=>next?[...prev,...result.items.filter(v=>!prev.some(old=>old.id===v.id))]:result.items);setCursor(result.nextCursor);}
    catch(e){setError(e instanceof Error?e.message:"โหลดรายการไม่สำเร็จ กรุณาลองใหม่");}
    finally{setBusy(false);}
  }
  useEffect(()=>{let active=true;myBookings().then(result=>{if(active){setItems(result.items);setCursor(result.nextCursor);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
  return <>
    <PageHeading eyebrow="" title="รายการยืมของฉัน" description="ตรวจผลคำขอและกำหนดคืนที่ผูกกับบัญชี LINE ของคุณ" action={<Button variant="outline" onClick={()=>void load()} disabled={busy}><RefreshCw aria-hidden="true"/>อัปเดตรายการ</Button>}/>
    {demo&&<p className="mb-5 text-sm muted">รายการตัวอย่างสำหรับทดลองใช้งาน ยังไม่เชื่อมบัญชี LINE จริง</p>}
    {busy&&<p role="status" className="mb-4">กำลังโหลดรายการ…</p>}
    {error&&<div role="alert" className="rounded-lg border bg-white p-5 mb-5"><p>{error}</p><Button className="mt-3" variant="outline" onClick={()=>void load()}>ลองใหม่</Button></div>}
    {!busy&&!error&&!items.length&&<Empty title="ยังไม่มีคำขอที่ผูกกับบัญชีนี้" description="คำขอเก่าที่ไม่ได้เชื่อม LINE จะไม่ถูกจับคู่จากชื่อหรืออีเมล" action={<Button asChild><Link to="/equipment.html">เลือกอุปกรณ์</Link></Button>}/>}
    <div className="grid gap-4">
      {items.map(item=><article key={item.id} className="rounded-lg border bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm muted">{item.assetCode}</p><h2 className="text-xl mt-1">{item.equipmentName}</h2></div><Status value={item.status}/></div>
        <p className="mt-4">{dateLabel(parseInputDate(item.startDay))} – {dateLabel(parseInputDate(item.endDay))}</p>
        <p className="text-sm muted mt-1">{item.activityName}</p>
        {item.adminNote&&<p className="mt-3 rounded bg-muted p-3">หมายเหตุจากผู้ดูแล: {item.adminNote}</p>}
        <p className="mt-4 text-sm break-all muted"><ClipboardList className="inline size-4 mr-1" aria-hidden="true"/>รหัสคำขอ: {item.id}</p>
        {item.status==="approved"&&<p className="mt-3 text-sm">กรุณาติดต่อผู้ดูแลตามช่องทางที่ตกลงกันเพื่อรับและส่งคืนอุปกรณ์</p>}
      </article>)}
    </div>
    {cursor&&<Button className="mt-5" variant="outline" disabled={busy} onClick={()=>void load(cursor)}>โหลดรายการเพิ่มเติม</Button>}
  </>;
}
