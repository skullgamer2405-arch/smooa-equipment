import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { calendarWindow } from "../lib/calendar";
import type { PublicEvent } from "../lib/types";
import { validDay } from "../../shared/booking-schema.js";
import { th } from "date-fns/locale";
import { Plus, CalendarDays, Clock } from "lucide-react";
import { useData } from "../context";
import { asDate, dateLabel, inputDate, parseInputDate } from "../lib/utils";
import { addCalendar, publicCalendar } from "../lib/data";
import { Calendar } from "../components/ui/calendar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "../components/ui/select";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { PageHeading, DataStatus, Empty } from "../components/shared";
export function CalendarPage() {
  const { calendarEntries, equipment, user, announce, moreEquipment, hasMoreEquipment } = useData();
  const [params,setParams] = useSearchParams();
  const rawDay = params.get("date") || "";
  const selected = parseInputDate(validDay(rawDay) ? rawDay : inputDate(new Date()));
  const equipmentId = params.get("equipmentId") || "";
  const [publicEvents,setPublicEvents] = useState<PublicEvent[]>([]),[eventsError,setEventsError] = useState(""),[eventsBusy,setEventsBusy] = useState(true),[nextCursor,setNextCursor] = useState<string|null>(null),[revision,setRevision] = useState(0);
  function setSelected(date:Date|undefined) { if(!date)return;const next=new URLSearchParams(params);next.set("date",inputDate(date));setParams(next); }
  function setEquipmentFilter(id:string) {const next=new URLSearchParams(params);id?next.set("equipmentId",id):next.delete("equipmentId");setParams(next);}
  const windowDays = calendarWindow(inputDate(selected));
  useEffect(()=>{let active=true;setEventsBusy(true);setEventsError("");setPublicEvents([]);publicCalendar(windowDays.from,windowDays.to,equipmentId).then(result=>{if(active){setPublicEvents(result.items);setNextCursor(result.nextCursor);}}).catch(()=>{if(active)setEventsError("โหลดปฏิทินไม่สำเร็จ กรุณาลองใหม่");}).finally(()=>{if(active)setEventsBusy(false);});return()=>{active=false;};},[windowDays.from,windowDays.to,equipmentId,revision]);
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [eqId, setEqId] = useState("none");
  const day = inputDate(selected || new Date());
  const events = [
    ...publicEvents.filter(event=>event.startDay<=day && event.endDay>=day).map(event=>({id:event.id,title:"มีการยืมอุปกรณ์",equipment:event.equipmentName,time:"ตลอดช่วงวันยืม"})),
    ...calendarEntries
      .filter((e) => {
        const d = asDate(e.date);
        return d && inputDate(d) === day && (!equipmentId || e.equipmentId === equipmentId);
      })
      .map((e) => ({
        id: e.id,
        title: e.activityName,
        equipment: e.equipmentName || "กิจกรรมทั่วไป",
        time: [e.startTime, e.endTime].filter(Boolean).join(" – ") || "ทั้งวัน",
      })),
  ];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const d = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const activity = String(d.get("activityName")).trim();
      if (!activity) throw Error("กรุณาระบุชื่อกิจกรรม");
      const start = String(d.get("startTime")),
        end = String(d.get("endTime"));
      if (start && end && end < start)
        throw Error("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม");
      await addCalendar({
        date: parseInputDate(String(d.get("date"))),
        activityName: activity,
        startTime: start,
        endTime: end,
        equipmentId: eqId === "none" ? "" : eqId,
        equipmentName: equipment.find((e) => e.id === eqId)?.title || "",
      });
      setOpen(false);
      announce("เพิ่มกิจกรรมเรียบร้อยแล้ว");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="วางแผนการใช้งาน"
        title="ปฏิทินการจองอุปกรณ์"
        description="รายการที่ได้รับอนุมัติและกิจกรรมของสโมสรนักศึกษา"
        action={
          user && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  เพิ่มกิจกรรม
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>เพิ่มกิจกรรมในปฏิทิน</DialogTitle>
                <DialogDescription>
                  สำหรับผู้ดูแลระบบ · กิจกรรมจะแสดงให้ผู้ใช้งานทุกคนเห็น
                </DialogDescription>
                <form onSubmit={submit} className="grid gap-4">
                  <Label htmlFor="calendar-date">วันที่</Label>
                  <Input
                    id="calendar-date"
                    name="date"
                    type="date"
                    required
                    defaultValue={day}
                  />
                  <Label htmlFor="calendar-activity">ชื่อกิจกรรม</Label>
                  <Input
                    id="calendar-activity"
                    name="activityName"
                    required
                    maxLength={300}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-time">เวลาเริ่ม</Label>
                      <Input id="start-time" name="startTime" type="time" />
                    </div>
                    <div>
                      <Label htmlFor="end-time">เวลาสิ้นสุด</Label>
                      <Input id="end-time" name="endTime" type="time" />
                    </div>
                  </div>
                  <Label>อุปกรณ์ที่เกี่ยวข้อง</Label>
                  <Select value={eqId} onValueChange={setEqId}>
                    <SelectTrigger
                      aria-label="อุปกรณ์ที่เกี่ยวข้อง"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">กิจกรรมทั่วไป</SelectItem>
                      {equipment.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {error && (
                    <p role="alert" className="text-destructive">
                      {error}
                    </p>
                  )}
                  <Button disabled={pending}>
                    {pending ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <div className="mb-5 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1 max-w-md"><Label htmlFor="calendar-equipment">ดูปฏิทินของอุปกรณ์</Label><select id="calendar-equipment" className="mt-2 min-h-11 w-full rounded-md border bg-white px-3" value={equipmentId} onChange={e=>setEquipmentFilter(e.target.value)}><option value="">ทุกอุปกรณ์</option>{equipmentId&&!equipment.some(e=>e.id===equipmentId)&&<option value={equipmentId}>อุปกรณ์ที่เลือก</option>}{equipment.map(item=><option key={item.id} value={item.id}>{item.title} · {item.assetCode}</option>)}</select></div>{hasMoreEquipment&&<Button variant="outline" onClick={()=>void moreEquipment()}>โหลดชื่ออุปกรณ์เพิ่ม</Button>}{equipmentId&&<Button asChild><Link to={"/booking.html?"+new URLSearchParams({id:equipmentId,startDate:day,endDate:day})}>ขอยืมอุปกรณ์นี้</Link></Button>}</div>
      <p className="text-sm muted mb-5">วันที่ขีดเส้นใต้มีรายการอนุมัติ การไม่พบรายการยังไม่ยืนยันว่าอุปกรณ์พร้อม ผู้ดูแลจะตรวจอีกครั้งก่อนอนุมัติ</p>
      {eventsBusy&&<p role="status" className="mb-4">กำลังโหลดรายการปฏิทิน…</p>}
      {eventsError&&<div role="alert" className="mb-5 rounded border bg-white p-4"><p>{eventsError}</p><Button variant="outline" className="mt-3" onClick={()=>setRevision(v=>v+1)}>ลองใหม่</Button></div>}
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="self-start">
          <CardContent className="p-3">
            <div className="sm:hidden p-2">
              <Label htmlFor="mobile-calendar-date">เลือกวันที่</Label>
              <Input
                id="mobile-calendar-date"
                type="date"
                value={day}
                onChange={(e) =>
                  e.target.value && setSelected(parseInputDate(e.target.value))
                }
              />
            </div>
            <div className="hidden sm:block">
              <Calendar
                mode="single"
                locale={th}
                selected={selected}
                timeZone="Asia/Bangkok"
                month={selected}
                onMonthChange={date=>setSelected(date)}
                modifiers={{ booked:date=>publicEvents.some(event=>event.startDay<=inputDate(date)&&event.endDay>=inputDate(date)) }}
                modifiersStyles={{booked:{textDecoration:"underline",textUnderlineOffset:"5px"}}}
                labels={{labelDayButton:(date,modifiers)=>date.toLocaleDateString("th-TH",{dateStyle:"full",timeZone:"Asia/Bangkok"})+(modifiers.booked?" มีรายการอนุมัติ":"")}}
                onSelect={(d) => d && setSelected(d)}
                className="w-full"
              />
            </div>
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => setSelected(new Date())}
            >
              กลับมาวันนี้
            </Button>
          </CardContent>
        </Card>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-xl">{dateLabel(selected)}</h2>
            <span className="text-sm muted">{events.length} รายการ</span>
          </div>
            <DataStatus collection="calendarEntries">
              {events.length ? (
                <div className="grid gap-4">
                  {events.map((e) => (
                    <Card key={e.id}>
                      <CardContent>
                        <p className="text-sm muted mb-2 flex items-center gap-2">
                          <CalendarDays className="size-4" />
                          กิจกรรม / การจองที่อนุมัติ
                        </p>
                        <h3 className="mb-2">{e.title}</h3>
                        <p>{e.equipment}</p>
                        <p className="muted text-sm mt-3 flex items-center gap-2">
                          <Clock className="size-4" />
                          {e.time}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !eventsBusy && !eventsError ? (
                <Empty
                  title="ยังไม่มีรายการในวันนี้"
                  description="เลือกวันอื่นเพื่อดูการจองและกิจกรรม"
                />
              ) : null}
            </DataStatus>
          {nextCursor&&<Button className="mt-4" variant="outline" disabled={eventsBusy} onClick={async()=>{setEventsBusy(true);try{const result=await publicCalendar(windowDays.from,windowDays.to,equipmentId,nextCursor);setPublicEvents(prev=>[...prev,...result.items]);setNextCursor(result.nextCursor);}catch{setEventsError("โหลดรายการเพิ่มไม่สำเร็จ กรุณาลองใหม่");}finally{setEventsBusy(false);}}}>โหลดรายการในช่วงนี้เพิ่มเติม</Button>}
          <p className="muted text-sm mt-5">
            ปฏิทินแสดงเฉพาะคำขอที่อนุมัติแล้ว
            วันว่างในปฏิทินยังไม่ใช่การรับรองว่าอุปกรณ์พร้อมให้ยืม
          </p>
        </section>
      </div>
    </>
  );
}
