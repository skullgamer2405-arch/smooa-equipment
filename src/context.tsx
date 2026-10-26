import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import * as api from "./lib/data";
import type { Equipment, Booking, CalendarEntry, CollectionName, BookingFilter } from "./lib/types";
import { inputDate } from "./lib/utils";
import { calendarWindow } from "./lib/calendar";
import { validDay } from "../shared/booking-schema.js";
type State = {
  equipment: Equipment[]; bookings: Booking[]; calendarEntries: CalendarEntry[];
  loading: boolean; isLoading: (name: CollectionName) => boolean;
  errors: Partial<Record<CollectionName, string>>; retry: () => void;
  user: { email: string | null } | null; authReady: boolean; authError: string;
  message: string; announce: (text: string) => void;
  equipmentTotals: Record<string, number>; bookingTotals: Record<string, number>;
  moreEquipment: () => Promise<void>; hasMoreEquipment: boolean; equipmentBusy: boolean;
  bookingPage: number; hasMoreBookings: boolean; nextBookings: () => void; previousBookings: () => void;
};
const Context = createContext<State | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const location = useLocation(), params = new URLSearchParams(location.search);
  const admin = /^\/admin(?:\.html)?\/?$/.test(location.pathname);
  const calendar = /^\/calendar(?:\.html)?\/?$/.test(location.pathname);
  const rawFilter = params.get("filter") || "pending";
  const filter = (["all","pending","approved","rejected","returned","due","overdue"].includes(rawFilter) ? rawFilter : "pending") as BookingFilter;
  const day = validDay(params.get("date") || "") ? params.get("date")! : inputDate(new Date());
  const range = calendarWindow(day);
  const [equipment, setEquipment] = useState<Equipment[]>([]), [bookings, setBookings] = useState<Booking[]>([]), [calendarEntries, setCalendar] = useState<CalendarEntry[]>([]);
  const [loaded, setLoaded] = useState<string[]>([]), [errors, setErrors] = useState<State["errors"]>({}), [version, setVersion] = useState(0);
  const [user, setUser] = useState<State["user"]>(null), [authReady, setReady] = useState(false), [authError, setAuthError] = useState("");
  const [message, announce] = useState("");
  const [equipmentTotals, setEquipmentTotals] = useState<Record<string,number>>({}), [bookingTotals,setBookingTotals] = useState<Record<string,number>>({});
  const [equipmentMeta,setEquipmentMeta] = useState<api.PageMeta>({cursor:undefined,hasMore:false}), [equipmentBusy,setEquipmentBusy] = useState(false);
  const [cursors,setCursors] = useState<unknown[]>([]), [bookingMeta,setBookingMeta] = useState<api.PageMeta>({cursor:undefined,hasMore:false});
  const queryKey = `${admin}:${filter}:${user?.email || ""}`;
  const keyRef = useRef(queryKey);
  const activeCursors = keyRef.current === queryKey ? cursors : [];
  useEffect(() => { keyRef.current = queryKey; setCursors([]); }, [queryKey]);
  function completed(name: CollectionName) { setLoaded(v => v.includes(name) ? v : [...v, name]); }
  function failed(name: CollectionName, text: string) { setErrors(v => ({...v,[name]:text})); completed(name); }
  useEffect(() => {
    setLoaded(v => v.filter(n => n !== "equipment")); setErrors(v => ({...v,equipment:undefined}));
    let active = true;
    const stop = api.watch("equipment", (rows,meta) => {
      setEquipment(rows as Equipment[]); setEquipmentMeta(meta); completed("equipment");
      api.equipmentSummary().then(value => { if(active) setEquipmentTotals(value); }).catch(() => { if(active) setEquipmentTotals({}); });
    }, text => failed("equipment",text));
    return ()=>{active=false;stop();};
  }, [version]);
  useEffect(() => {
    setReady(false); setAuthError("");
    return api.watchAuth(value => { setUser(value); setReady(true); }, text => { setAuthError(text); if(text) {setUser(null);setReady(true);} });
  }, [version]);
  const cursor = activeCursors.at(-1);
  useEffect(() => {
    setBookings([]); setErrors(v => ({...v,bookings:undefined}));
    setBookingMeta({cursor:undefined,hasMore:false});
    if (!admin || !user) { completed("bookings"); return; }
    setLoaded(v => v.filter(n => n !== "bookings"));
    let active=true;
    const stop = api.watch("bookings", (rows,meta) => { setBookings(rows as Booking[]); setBookingMeta(meta); completed("bookings"); api.bookingSummary().then(value => {if(active)setBookingTotals(value);}).catch(() => {if(active)setBookingTotals({});}); }, text => failed("bookings",text), { filter, cursor, size: 10 });
    return () => {active=false;stop();};
  }, [admin,user,filter,cursor,version]);
  useEffect(() => {
    setCalendar([]); setErrors(v => ({...v,calendarEntries:undefined}));
    if (!calendar) {completed("calendarEntries");return;}
    setLoaded(v => v.filter(n => n !== "calendarEntries"));
    return api.watch("calendarEntries", rows => {setCalendar(rows as CalendarEntry[]);completed("calendarEntries");},text=>failed("calendarEntries",text),{...range,size:100});
  }, [calendar,range.from,range.to,version]);
  useEffect(() => { if(!message)return; const timer=setTimeout(()=>announce(""),7000); return ()=>clearTimeout(timer); },[message]);
  async function moreEquipment() {
    if(equipmentBusy || !equipmentMeta.hasMore)return;
    setEquipmentBusy(true);
    try { const result=await api.equipmentPage(equipmentMeta.cursor); setEquipment(prev=>[...prev,...result.rows.filter(e=>!prev.some(old=>old.id===e.id))]);setEquipmentMeta(result); }
    catch {announce("โหลดอุปกรณ์เพิ่มไม่สำเร็จ กรุณาลองใหม่");} finally {setEquipmentBusy(false);}
  }
  return <Context.Provider value={{equipment,bookings,calendarEntries,loading:loaded.length<3,isLoading:name=>!loaded.includes(name),errors,retry:()=>setVersion(v=>v+1),user,authReady,authError,message,announce,equipmentTotals,bookingTotals,moreEquipment,hasMoreEquipment:equipmentMeta.hasMore,equipmentBusy,bookingPage:activeCursors.length+1,hasMoreBookings:bookingMeta.hasMore,nextBookings:()=>{if(bookingMeta.hasMore)setCursors([...activeCursors,bookingMeta.cursor]);},previousBookings:()=>setCursors(activeCursors.slice(0,-1))}}>{children}</Context.Provider>;
}
export function useData() {const state=useContext(Context);if(!state)throw Error("DataProvider missing");return state;}
