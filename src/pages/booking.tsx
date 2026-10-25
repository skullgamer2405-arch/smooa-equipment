import { useState } from "react";
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
import { createBooking, notify } from "../lib/data";
import { dateLabel, inputDate, parseInputDate } from "../lib/utils";
import { LineConnection } from "../components/line-connection";
import { createLineBooking, type LineSession } from "../lib/line";
import { bookingSchema } from "../../shared/booking-schema.js";
export { bookingSchema };
type Values = z.infer<typeof bookingSchema>;
export function BookingPage() {
  const { equipment, isLoading, announce } = useData();
  const loading = isLoading("equipment");
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const item = equipment.find((e) => e.id === params.get("id"));
  const [submitError, setSubmitError] = useState("");
  const [lineAccount, setLineAccount] = useState<LineSession | null>(null);
  const [lineConsent, setLineConsent] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const form = useForm<Values>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      fullName: "",
      studentId: "",
      faculty: "",
      department: "",
      affiliation: "",
      applicantEmail: "",
      applicantPhone: "",
      activityName: "",
      reason: "",
      startDate: "",
      endDate: "",
      terms: false,
    },
    shouldFocusError: true,
  });
  const values = form.watch();
  const errors = form.formState.errors;
  async function submit(data: Values) {
    if (!item || item.status !== "available") return;
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
      const id = lineConsent
        ? await createLineBooking({
            ...fields,
            equipmentId: item.id,
            terms: true,
            requestId,
          })
        : await createBooking(booking);
      try {
        const sent = await notify("notify-admin-booking", {
          ...fields,
          bookingId: id,
          equipmentName: item.title,
          equipmentCode: item.assetCode,
        });
        if (!sent.success)
          announce("บันทึกคำขอแล้ว แต่การแจ้งเตือนยังไม่สำเร็จ");
      } catch {
        announce("บันทึกคำขอแล้ว แต่การแจ้งเตือนยังไม่สำเร็จ");
      }
      navigate("/success.html", {
        state: { bookingId: id, lineRequested: lineConsent },
      });
    } catch (e) {
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
                onSubmit={form.handleSubmit(submit)}
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
                  <LineConnection
                    session={lineAccount}
                    onChange={setLineAccount}
                    consent={lineConsent}
                    onConsent={setLineConsent}
                  />
                  <Card>
                    <CardContent className="p-5 md:p-6">
                      <div className="section-label">
                        <span className="number-step">1</span>
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
                  <Card>
                    <CardContent className="p-5 md:p-6">
                      <div className="section-label">
                        <span className="number-step">2</span>
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
                </fieldset>
              </form>
              <aside className="lg:sticky lg:top-28">
                <Card>
                  <CardContent className="p-5 md:p-6">
                    <div className="rounded-lg bg-muted p-4 mb-4">
                      <EquipmentImage equipment={item} />
                    </div>
                    <p className="eyebrow">
                      อุปกรณ์ที่เลือก · {item.assetCode}
                    </p>
                    <h2 className="text-xl mb-3">{item.title}</h2>
                    <Status value={item.status} />
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
                          disabled={form.formState.isSubmitting}
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
    </>
  );
}
