import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("./data",()=>({demo:true}));
import { emptyBooking, readBookingDraft, writeBookingDraft, removeBookingDraft } from "./booking-draft";
const id="c8ed05f3-76b1-4f51-83bf-1581bbb82591";
beforeEach(()=>{const rows=new Map<string,string>();vi.stubGlobal("sessionStorage",{getItem:(k:string)=>rows.get(k)||null,setItem:(k:string,v:string)=>rows.set(k,v),removeItem:(k:string)=>rows.delete(k)});});
afterEach(()=>{vi.unstubAllGlobals();});
it("restores the same request ID and fields only for the selected equipment, without retaining terms",()=>{
  expect(writeBookingDraft("one",id,{...emptyBooking,fullName:"ผู้ทดสอบ",terms:true})).toBe(true);
  expect(readBookingDraft("one")).toEqual({requestId:id,values:{...emptyBooking,fullName:"ผู้ทดสอบ"}});
  expect(readBookingDraft("two")).toBeNull();removeBookingDraft("one");expect(readBookingDraft("one")).toBeNull();
});
it("expires drafts after one day and treats invalid or blocked storage as an empty draft",()=>{
  writeBookingDraft("one",id,{...emptyBooking,reason:"test"});expect(readBookingDraft("one",Date.now()+86400001)).toBeNull();
  sessionStorage.setItem("smo-booking-draft-v1-demo:one","not JSON");expect(readBookingDraft("one")).toBeNull();
  vi.stubGlobal("sessionStorage",{getItem(){throw Error("blocked");},setItem(){throw Error("blocked");}});
  expect(readBookingDraft("one")).toBeNull();expect(writeBookingDraft("one",id,{...emptyBooking,fullName:"test"})).toBe(false);
});
