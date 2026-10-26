import { parseArgs } from "node:util";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
const { values } = parseArgs({ options: { uid:{type:"string"}, project:{type:"string"}, apply:{type:"boolean",default:false} } });
if (!values.uid || !values.project) throw Error("ระบุ --project และ --uid ของบัญชีที่เจ้าของระบบยืนยันแล้ว");
if (!values.apply) {
  console.log(JSON.stringify({ mode:"dry_run", project:values.project, uid:values.uid, action:"grant verified account admin claim; revoke previous sessions", next:"ตรวจบัญชีเป้าหมายก่อนเพิ่ม --apply ไม่ต้องส่ง credentials ในแชต" }));
} else {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const account = json ? JSON.parse(json) : null;
  if (account && account.project_id !== values.project) throw Error("โครงการใน credential ไม่ตรงกับ --project");
  const app=initializeApp({projectId:values.project,...(account?{credential:cert(account)}:{})});
  const auth=getAuth(app),user=await auth.getUser(values.uid);
  if(!user.emailVerified || user.disabled)throw Error("บัญชีต้องยืนยันอีเมลแล้วและไม่ถูกปิดใช้งาน");
  await auth.setCustomUserClaims(user.uid,{...user.customClaims,admin:true});
  await auth.revokeRefreshTokens(user.uid);
  console.log("ตั้งสิทธิ์แล้ว ให้เจ้าของบัญชีออกจากระบบและเข้าสู่ระบบใหม่");
}
