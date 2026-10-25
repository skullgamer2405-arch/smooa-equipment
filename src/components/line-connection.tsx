import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { demo } from "../lib/data";
import { lineEnabled, lineFriendUrl } from "../lib/line";
import { useLine } from "../line-context";

export function LineConnection() {
  const { account, consent, setConsent, requestConnection, busy } = useLine();
  const friendUrl = lineFriendUrl();
  return (
    <Card>
      <CardContent className="p-5 md:p-6 grid gap-3">
        <h2 className="text-xl flex items-center gap-2">
          <MessageCircle aria-hidden="true" />
          รับแจ้งเตือนผ่าน LINE
        </h2>
        <p className="muted text-sm">
          รับผลอนุมัติ และเตือนก่อนคืน 1 วันกับวันครบกำหนด เวลา 09:00 น. เวลาไทย
        </p>
        {demo && (
          <p className="text-sm" role="status">
            โหมดทดลองยังไม่เชื่อมบัญชีหรือส่งข้อความ LINE จริง
          </p>
        )}
        {demo || lineEnabled ? (
          <>
            {account && (
              <p role="status" className="text-sm">
                {demo ? "การเชื่อมต่อจำลอง: " : "เชื่อมต่อกับ "}
                {account.displayName}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={requestConnection}
            >
              {account?.friend ? "จัดการการเชื่อมต่อ LINE" : "เชื่อมต่อ LINE"}
            </Button>
            {account?.friend && (
              <label className="flex min-h-11 items-start gap-3 cursor-pointer">
                <Checkbox
                  className="mt-1 shrink-0"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                />
                <span className="text-sm">
                  ยินยอมรับผลอนุมัติและเตือนคืนจาก SMO OA
                  สำหรับคำขอนี้และคำขอถัดไปในรอบการใช้งานนี้
                </span>
              </label>
            )}
          </>
        ) : (
          <p className="text-sm" role="status">
            กำลังเตรียมบริการ LINE คุณยังจองผ่านแบบฟอร์มนี้ได้ตามปกติ
          </p>
        )}
        {friendUrl && (demo || !account?.friend) && (
          <Button asChild variant="outline">
            <a href={friendUrl} target="_blank" rel="noopener noreferrer">
              เพิ่มเพื่อน SMO OA
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
