import { parseArgs } from "node:util";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { publicBooking } from "../shared/calendar.js";
const {values}=parseArgs({options:{project:{type:"string"},apply:{type:"boolean",default:false}}});
if(!values.project)throw Error("ระบุ --project ให้ตรงกับโครงการที่เจ้าของยืนยัน");
if(!values.apply)console.log(JSON.stringify({mode:"dry_run",project:values.project,action:"publish only equipment/date/status of approved bookings in pages of 100",next:"สำรองข้อมูลและยืนยันโครงการก่อนใช้ --apply; ไม่แก้ข้อมูลผู้ยืม"}));
else{
 const account=process.env.FIREBASE_SERVICE_ACCOUNT_JSON?JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON):null;
 if(account&&account.project_id!==values.project)throw Error("Credential ไม่ตรงโครงการ");
 const app=initializeApp({projectId:values.project,...(account?{credential:cert(account)}:{})}),db=getFirestore(app);
 let cursor,count=0;
 do{
  let query=db.collection("bookings").where("status","==","approved").orderBy(FieldPath.documentId()).limit(100);
  if(cursor)query=query.startAfter(cursor);
  const page=await query.get(),batch=db.batch();
  for(const doc of page.docs){batch.set(db.collection("publicCalendar").doc(doc.id),publicBooking(doc.id,doc.data()));count++;}
  if(page.docs.length)await batch.commit();
  cursor=page.docs.length===100?page.docs.at(-1):null;
 }while(cursor);
 console.log("สร้างข้อมูลปฏิทินสาธารณะแล้ว "+count+" รายการ");
}
