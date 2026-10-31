import { useEffect, useState } from "react";
import App from "./App";
import { initializeLine, lineEnabled } from "./lib/line";
import { Button } from "./components/ui/button";
export function LineBootstrap() {
  const params = new URLSearchParams(window.location.search);
  const redirect = lineEnabled && (params.has("liff.state") || params.has("liffClientId"));
  const [waiting,setWaiting] = useState(redirect), [error,setError] = useState(false), [attempt,setAttempt] = useState(0);
  useEffect(()=>{
    if (!lineEnabled) return;
    let active=true;
    initializeLine().then(()=>{if(active)setWaiting(false);}).catch(()=>{if(active){setError(true);if(!redirect)setWaiting(false);}});
    return()=>{active=false;};
  },[attempt,redirect]);
  if (!waiting) return <App/>;
  return <main className="container-app" aria-busy={!error}><h1>SMO.CRA ยืมอุปกรณ์</h1><p role={error?"alert":"status"} className="my-5">{error?"LINE ยังไม่พร้อม คุณสามารถลองยืนยันใหม่หรือเริ่มดูรายการอุปกรณ์ได้":"กำลังตรวจการกลับจาก LINE…"}</p>{error&&<div className="flex flex-wrap gap-3"><Button onClick={()=>{setError(false);setAttempt(v=>v+1);}}>ลองยืนยันอีกครั้ง</Button><Button variant="outline" onClick={()=>setWaiting(false)}>ดูรายการอุปกรณ์ก่อน</Button></div>}</main>;
}
