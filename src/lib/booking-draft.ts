import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { bookingSchema } from "../../shared/booking-schema.js";
import { demo } from "./data";
export type BookingValues = z.infer<typeof bookingSchema>;
export const emptyBooking: BookingValues = { fullName:"",studentId:"",faculty:"",department:"",affiliation:"",applicantEmail:"",applicantPhone:"",activityName:"",reason:"",startDate:"",endDate:"",terms:false };
const key = (id: string) => `smo-booking-draft-v1-${demo ? "demo" : "live"}:${id}`;
export function readBookingDraft(id: string, now = Date.now()) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key(id)) || "null");
    if (!saved || !/^[0-9a-f-]{36}$/i.test(saved.requestId) || !Number.isFinite(saved.updatedAt) || now - saved.updatedAt > 86400000 || saved.updatedAt > now + 60000) return null;
    const values = { ...emptyBooking };
    for (const field of Object.keys(emptyBooking) as (keyof BookingValues)[]) {
      if (field !== "terms" && typeof saved.values?.[field] === "string" && saved.values[field].length <= 1000) values[field] = saved.values[field];
    }
    return { values, requestId: saved.requestId as string };
  } catch { return null; }
}
export function writeBookingDraft(id: string, requestId: string, values: BookingValues) {
  try {
    if (Object.entries(values).some(([field,value])=>field!=="terms" && typeof value==="string" && value.length)) sessionStorage.setItem(key(id), JSON.stringify({ values: { ...values, terms:false }, requestId, updatedAt:Date.now() }));
    else sessionStorage.removeItem(key(id));
    return true;
  } catch { return false; }
}
export function removeBookingDraft(id: string) { try {sessionStorage.removeItem(key(id));}catch{/* memory remains usable */} }
export function useBookingDraft(id: string, form: UseFormReturn<BookingValues>, initial: ReturnType<typeof readBookingDraft>) {
  const [requestId,setRequestId] = useState(initial?.requestId || crypto.randomUUID());
  const [restored,setRestored] = useState(Boolean(initial));
  const active=useRef(true);
  useEffect(()=>{
    active.current=true;
    const save=()=>active.current && writeBookingDraft(id,requestId,form.getValues());
    let timer: ReturnType<typeof setTimeout>;
    const subscription=form.watch(()=>{clearTimeout(timer);timer=setTimeout(save,200);});
    const leave=(event:BeforeUnloadEvent)=>{if(active.current && !save() && form.formState.isDirty){event.preventDefault();event.returnValue="";}};
    window.addEventListener("pagehide",save);window.addEventListener("beforeunload",leave);
    return ()=>{clearTimeout(timer);save();subscription.unsubscribe();window.removeEventListener("pagehide",save);window.removeEventListener("beforeunload",leave);};
  },[id,requestId,form]);
  function clear(success=false) {
    active.current=false;removeBookingDraft(id);setRestored(false);
    if(!success){form.reset(emptyBooking);setRequestId(crypto.randomUUID());}
  }
  return { requestId, restored, clear };
}
