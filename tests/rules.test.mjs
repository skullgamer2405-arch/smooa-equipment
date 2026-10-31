import { test, before, after } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { ref, getBytes, uploadBytes } from "firebase/storage";

const projectId="demo-smooa-test";
let env;
before(async()=>{
  if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080" || process.env.FIREBASE_STORAGE_EMULATOR_HOST!=="127.0.0.1:9199")throw Error("Only the explicit loopback demo emulators are permitted");
  env=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,rules:readFileSync(new URL("../firestore.rules",import.meta.url),"utf8")},storage:{host:"127.0.0.1",port:9199,rules:readFileSync(new URL("../storage.rules",import.meta.url),"utf8")}});
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for(const collection of ["equipment","calendarEntries","publicCalendar","bookings","lineBookingRecipients","lineNotifications","emailNotifications","bookingReceipts","submissionLimits","settings"]){
      await setDoc(doc(db,collection,"fixture"),{title:"Fixture",assetCode:"F01",status:"pending",fullName:"Dummy borrower"});
    }
    for(const path of ["equipment/fixture.png","documents/fixture.txt","private/fixture.txt"])await uploadBytes(ref(ctx.storage(),path),new Uint8Array([1,2,3]));
  });
});
after(async()=>{await env?.cleanup();});
const principals=()=>[
  env.unauthenticatedContext(),env.authenticatedContext("ordinary",{email_verified:true}),env.authenticatedContext("unverified-admin",{admin:true,email_verified:false}),
];
test("rules: public catalog is readable but private booking/job/settings state is denied",async()=>{
  for(const ctx of principals()){
    for(const name of ["equipment","calendarEntries","publicCalendar"])await assertSucceeds(getDoc(doc(ctx.firestore(),name,"fixture")));
    for(const name of ["bookings","lineBookingRecipients","lineNotifications","emailNotifications","bookingReceipts","submissionLimits","settings"])await assertFails(getDoc(doc(ctx.firestore(),name,"fixture")));
    for(const name of ["equipment","calendarEntries","bookings","publicCalendar","settings"])await assertFails(setDoc(doc(ctx.firestore(),name,"new"),{title:"Forgery",assetCode:"F",status:"pending",createdAt:Timestamp.now()}));
  }
});
test("rules: verified admin reads bookings/manages catalog but cannot bypass server workflows",async()=>{
  const db=env.authenticatedContext("admin",{admin:true,email_verified:true}).firestore();
  await assertSucceeds(getDoc(doc(db,"bookings","fixture")));
  await assertSucceeds(setDoc(doc(db,"equipment","new"),{title:"Fixture",assetCode:"NEW",status:"available",createdAt:Timestamp.now()}));
  await assertSucceeds(setDoc(doc(db,"calendarEntries","new"),{date:Timestamp.now(),activityName:"Public fixture",createdAt:Timestamp.now()}));
  for(const name of ["bookings","publicCalendar","lineBookingRecipients","lineNotifications","emailNotifications","submissionLimits","settings"])await assertFails(setDoc(doc(db,name,"new"),{status:"approved"}));
});
test("storage rules: public equipment, verified-admin documents, no client writes or unknown reads",async()=>{
  const admin=env.authenticatedContext("admin",{admin:true,email_verified:true});
  for(const ctx of [...principals(),admin]){
    await assertSucceeds(getBytes(ref(ctx.storage(),"equipment/fixture.png")));
    for(const path of ["equipment/new.png","documents/new.txt","private/new.txt"])await assertFails(uploadBytes(ref(ctx.storage(),path),new Uint8Array([1])));
    await assertFails(getBytes(ref(ctx.storage(),"private/fixture.txt")));
  }
  for(const ctx of principals())await assertFails(getBytes(ref(ctx.storage(),"documents/fixture.txt")));
  await assertSucceeds(getBytes(ref(admin.storage(),"documents/fixture.txt")));
});
