import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Info, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  DataStatus,
  EquipmentImage,
  Empty,
  PageHeading,
  Status,
} from "../components/shared";
import { useData } from "../context";
import { createBooking, getEquipment, demo } from "../lib/data";
import { dateLabel, inputDate, parseInputDate } from "../lib/utils";
import { createLineBooking, lineEnabled, lineSession, lineFriendUrl, LineConnectionError } from "../lib/line";
import { useLine } from "../line-context";
import { readBookingDraft, useBookingDraft, emptyBooking } from "../lib/booking-draft";
import type { Equipment } from "../lib/types";
import { bookingSchema, validDay } from "../../shared/booking-schema.js";
export { bookingSchema };
type Values = z.infer<typeof bookingSchema>;
export function BookingPage() {
  const { equipment, isLoading } = useData();

  const [params] = useSearchParams(),
    navigate = useNavigate();
  const equipmentId = params.get("id") || "";
  const [singleItem,setSingleItem] = useState<Equipment | null>(null), [itemReady,setItemReady] = useState(false);
  const item = equipment.find((e) => e.id === equipmentId) || singleItem;
  useEffect(()=>{let active=true;setItemReady(false);getEquipment(equipmentId).then(value=>{if(active)setSingleItem(value);}).catch(()=>{if(active)setSubmitError("โหลดอุปกรณ์ไม่สำเร็จ กรุณากลับไปเลือกรายการอีกครั้ง");}).finally(()=>{if(active)setItemReady(true);});return()=>{active=false;};},[equipmentId]);
  const loading = isLoading("equipment") && !itemReady;
  const [initialDraft] = useState(()=>readBookingDraft(equipmentId));
  const [recovery,setRecovery] = useState(false), [reconnecting,setReconnecting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const { consent: lineConsent, ready: lineReady } = useLine();

  const form = useForm<Values>({
    resolver: zodResolver(bookingSchema),
    defaultValues: initialDraft?.values || {
      ...emptyBooking,
      startDate: validDay(params.get("startDate") || "") ? params.get("startDate")! : "",
      endDate: validDay(params.get("endDate") || "") ? params.get("endDate")! : "",
    },
    shouldFocusError: true,
  });
  const draft = useBookingDraft(equipmentId, form, initialDraft);
  const { requestId } = draft;
  const values = form.watch();
  const errors = form.formState.errors;
  async function submit(data: Values, withoutLine = false) {
    if (!lineReady || !item || item.status !== "available") return;
    setSubmitError("");
    try {
      const { terms: _, ...fields } = data;
      const booking = {
        ...fields,
        equipmentId: item.id,
        equipmentName: item.title,
        assetCode: item.assetCode,
        startDate: parseInputDate(data.startDate),
        endDate: parseInputDate(data.endDate),
        status: "pending" as const,
      };
      const id =
        lineConsent && lineEnabled && !withoutLine
          ? await createLineBooking({
              ...fields,
              equipmentId: item.id,
              terms: true,
              requestId,
            })
          : await createBooking(booking, requestId, lineConsent && !withoutLine);
      const receipt = { bookingId:id, equipmentName:item.title, assetCode:item.assetCode, startDate:data.startDate, endDate:data.endDate, lineRequested:lineConsent && !withoutLine && (lineEnabled || demo) };
      try { sessionStorage.setItem(`smo-booking-receipt-${demo?"demo":"live"}`, JSON.stringify(receipt)); } catch { /* receipt remains in navigation state */ }
      draft.clear(true);
      navigate("/success.html", { state:receipt });
    } catch (e) {
      if (e instanceof LineConnectionError) setRecovery(true);
      setSubmitError(
        e instanceof Error ? e.message : "ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง",
      );
    }
  }
  function field(
    name: Exclude<keyof Values, "terms">,
    label: string,
    type = "text",
    optional = false,
  ) {
    return (
      <div>
        <Label htmlFor={name} className="mb-2 block">
          {label}
          {optional ? (
            <span className="muted text-sm"> (ถ้ามี)</span>
          ) : (
            <span className="text-destructive" aria-label="จำเป็น">
              {" "}
              *
            </span>
          )}
        </Label>
        <Input
          id={name}
          type={type}
          {...form.register(name)}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? name + "-error" : undefined}
          aria-required={!optional}
          autoComplete={({fullName:"name",applicantEmail:"email",applicantPhone:"tel"} as Record<string,string>)[name] || "off"}
          inputMode={name === "studentId" ? "numeric" : type === "email" ? "email" : type === "tel" ? "tel" : undefined}
          spellCheck={!["studentId","applicantEmail"].includes(name)}
          {...(type === "date"
            ? {
                min:
                  name === "endDate"
                    ? values.startDate || inputDate(new Date())
                    : inputDate(new Date()),
              }
            : {})}
        />
        {errors[name] && (
          <p
            id={name + "-error"}
            role="alert"
            className="text-sm text-destructive mt-1"
          >
            {errors[name]?.message}
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" className="mb-4 -ml-3">
        <Link to="/equipment.html">
          <ArrowLeft />
          กลับไปรายการอุปกรณ์
        </Link>
      </Button>
      <PageHeading
        eyebrow="ส่งคำขอยืม"
        title="เตรียมอุปกรณ์ให้พร้อมสำหรับกิจกรรม"
        description="กรอกข้อมูลให้ครบถ้วน แอดมินจะตรวจสอบและติดต่อยืนยันการยืม"
      />
      {item && <section aria-label="อุปกรณ์ที่เลือก" className="mb-6 flex items-center gap-4 rounded-lg border bg-white p-4">
        <div className="w-24 shrink-0 rounded bg-muted p-2"><EquipmentImage equipment={item}/></div>
        <div className="min-w-0"><p className="text-sm muted">{item.assetCode}</p><h2 className="text-xl my-1">{item.title}</h2><Status value={item.status}/></div>
      </section>}
      {draft.restored && <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4"><p>กลับมากรอกต่อจากร่างที่บันทึกไว้ในรอบใช้งานนี้</p><Button type="button" variant="outline" onClick={()=>draft.clear()}>ล้างร่าง</Button></div>}
      <DataStatus collection="equipment">
        {!item && !loading ? (
          <Empty
            title="ไม่พบอุปกรณ์นี้"
            description="กรุณาเลือกอุปกรณ์จากรายการอีกครั้ง"
            action={
              <Button asChild>
                <Link to="/equipment.html">เลือกอุปกรณ์</Link>
              </Button>
            }
          />
        ) : (
          item && (
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
              <form
                id="borrow-form"
                onSubmit={form.handleSubmit(data=>submit(data))}
                className="grid gap-6"
                noValidate
                aria-describedby={
                  item.status === "available"
                    ? undefined
                    : "booking-unavailable"
                }
              >
                {item.status !== "available" && (
                  <p
                    id="booking-unavailable"
                    role="status"
                    className="rounded-lg border bg-white p-4"
                  >
                    อุปกรณ์นี้ยังไม่พร้อมให้ยืม
                    กรุณาเลือกอุปกรณ์อื่นก่อนกรอกข้อมูล
                  </p>
                )}
                <fieldset
                  disabled={item.status !== "available"}
                  className="grid min-w-0 gap-6 border-0 p-0"
                >
                  <legend className="sr-only">ข้อมูลคำขอยืม</legend>
                  <Card>
                    <CardContent className="p-5 md:p-6">
                      <div className="section-label">
                        <span className="number-step">1</span>
                        <h2 className="text-xl">
                          รายละเอียดกิจกรรมและวันใช้งาน
                        </h2>
                      </div>
                      <div className="grid gap-5">
                        {field("activityName", "ชื่อโครงการหรือกิจกรรม")}
                        <div className="grid gap-5 sm:grid-cols-2">
                          {field("startDate", "วันยืม", "date")}
                          {field("endDate", "วันคืน", "date")}
                        </div>
                        <div>
                          <Label htmlFor="reason" className="mb-2 block">
                            วัตถุประสงค์ในการยืม{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Textarea
                            id="reason"
                            rows={4}
                            maxLength={1000}
                            {...form.register("reason")}
                            aria-invalid={!!errors.reason}
                            aria-describedby="reason-error"
                          />
                          {errors.reason && (
                            <p
                              id="reason-error"
                              role="alert"
                              className="text-sm text-destructive mt-1"
                            >
                              {errors.reason.message}
                            </p>
                          )}
                          <p className="muted text-sm mt-1">
                            ระบุการใช้งาน
                            เพื่อช่วยให้แอดมินพิจารณาคำขอได้รวดเร็ว
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5 md:p-6">
                      <div className="section-label">
                        <span className="number-step">2</span>
                        <h2 className="text-xl">ข้อมูลผู้ยืม</h2>
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        {field("fullName", "ชื่อ–นามสกุล")}
                        {field("studentId", "รหัสนักศึกษา")}
                        {field("faculty", "คณะ")}
                        {field("department", "สาขา")}
                        {field("applicantEmail", "อีเมล", "email")}
                        {field("applicantPhone", "เบอร์โทรศัพท์", "tel", true)}
                        <div className="sm:col-span-2">
                          {field(
                            "affiliation",
                            "หน่วยงาน / ชมรม",
                            "text",
                            true,
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </fieldset>
              </form>
              <aside className="lg:sticky lg:top-28">
                <Card>
                  <CardContent className="p-5 md:p-6">

                    <h2 className="text-xl mb-3">ตรวจคำขอก่อนส่ง</h2>
                    <p className="text-sm muted">{item.title} · {item.assetCode}</p>
                    <dl className="my-5 grid gap-3 border-y py-4 text-sm">
                      <div>
                        <dt className="muted">ผู้ยืม</dt>
                        <dd>{values.fullName || "ยังไม่ระบุ"}</dd>
                      </div>
                      <div>
                        <dt className="muted">วันใช้งาน</dt>
                        <dd>
                          {values.startDate
                            ? dateLabel(parseInputDate(values.startDate))
                            : "ยังไม่ระบุ"}{" "}
                          —{" "}
                          {values.endDate
                            ? dateLabel(parseInputDate(values.endDate))
                            : "ยังไม่ระบุ"}
                        </dd>
                      </div>
                    </dl>
                    {item.status === "available" ? (
                      <>
                        <label className="flex min-h-11 items-start gap-3 cursor-pointer">
                          <Checkbox
                            className="mt-1 shrink-0"
                            name={form.register("terms").name}
                            ref={form.register("terms").ref}
                            onBlur={form.register("terms").onBlur}
                            checked={values.terms}
                            onCheckedChange={(checked) =>
                              form.setValue("terms", checked === true, {
                                shouldValidate: true,
                              })
                            }
                            aria-invalid={!!errors.terms}
                            aria-describedby="terms-error"
                          />
                          <span>ฉันจะดูแลอุปกรณ์และส่งคืนตามวันที่กำหนด</span>
                        </label>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="link" className="px-0">
                              อ่านข้อควรทราบก่อนยืม
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogTitle>ข้อควรทราบก่อนยืม</DialogTitle>
                            <DialogDescription>
                              การส่งแบบฟอร์มยังไม่ถือว่าได้รับอนุมัติ
                            </DialogDescription>
                            <p>
                              กรุณาตรวจสภาพอุปกรณ์เมื่อรับ ดูแลระหว่างใช้งาน
                              และติดต่อสโมสรนักศึกษาหากอุปกรณ์ชำรุดหรือไม่สามารถส่งคืนตามกำหนด
                            </p>
                          </DialogContent>
                        </Dialog>
                        {errors.terms && (
                          <p
                            id="terms-error"
                            className="text-sm text-destructive"
                            role="alert"
                          >
                            {errors.terms.message}
                          </p>
                        )}
                        <Button
                          type="submit"
                          form="borrow-form"
                          disabled={!lineReady || form.formState.isSubmitting}
                          className="w-full mt-4"
                        >
                          {form.formState.isSubmitting ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <ArrowRight />
                          )}
                          {form.formState.isSubmitting
                            ? "กำลังส่งคำขอ..."
                            : "ส่งคำขอยืม"}
                        </Button>
                      </>
                    ) : (
                      <p className="rounded-lg bg-muted p-4">
                        อุปกรณ์นี้ยังไม่พร้อมให้ยืม
                        กรุณาเลือกอุปกรณ์อื่นหรือกลับมาตรวจสอบภายหลัง
                      </p>
                    )}
                    {submitError && (
                      <p role="alert" className="mt-3 text-destructive">
                        {submitError}
                      </p>
                    )}
                    <p className="mt-4 flex items-start gap-2 text-sm muted">
                      <Info className="size-4 mt-1 shrink-0" />
                      รอการอนุมัติจากแอดมินก่อนเข้ารับอุปกรณ์
                    </p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )
        )}
      </DataStatus>
      <Dialog open={recovery} onOpenChange={setRecovery}>
        <DialogContent>
          <DialogTitle>ตรวจบัญชี LINE ก่อนส่งคำขอ</DialogTitle>
          <DialogDescription>ข้อมูลในแบบฟอร์มยังอยู่ คำขอยังไม่ได้ถูกส่งผ่าน LINE กรุณายืนยันบัญชี หรือตัดสินใจส่งครั้งนี้โดยไม่รับแจ้งเตือน LINE</DialogDescription>
          {submitError&&<p role="alert" className="text-destructive">{submitError}</p>}
          <div className="grid gap-3">
            <Button disabled={reconnecting} onClick={async()=>{setReconnecting(true);try{const session=await lineSession(true);if(session?.friend){setRecovery(false);await form.handleSubmit(data=>submit(data))();}else if(session)setSubmitError("กรุณาเพิ่มเพื่อน SMO OA แล้วลองยืนยันบัญชีอีกครั้ง");}catch{setSubmitError("ยืนยันบัญชีไม่สำเร็จ กรุณาลองใหม่ ข้อมูลในแบบฟอร์มยังอยู่");}finally{setReconnecting(false);}}}>{reconnecting?"กำลังยืนยันบัญชี…":"ยืนยันบัญชีและลองส่งอีกครั้ง"}</Button>
            {lineFriendUrl()&&<Button asChild variant="outline"><a href={lineFriendUrl()!} target="_blank" rel="noopener noreferrer">เปิด SMO OA</a></Button>}
            <Button variant="outline" disabled={reconnecting} onClick={()=>{setRecovery(false);void form.handleSubmit(data=>submit(data,true))();}}>ส่งครั้งนี้โดยไม่รับแจ้งเตือน LINE</Button>
            <Button variant="ghost" onClick={()=>setRecovery(false)}>กลับไปตรวจแบบฟอร์ม</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
