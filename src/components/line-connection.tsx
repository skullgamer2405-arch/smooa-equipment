import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { demo } from "../lib/data";
import {
  lineEnabled,
  lineFriendUrl,
  lineSession,
  type LineSession,
} from "../lib/line";

export function LineConnection({
  session,
  onChange,
  consent,
  onConsent,
}: {
  session: LineSession | null;
  onChange: (s: LineSession | null) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!lineEnabled) return;
    let stopped = false;
    lineSession()
      .then((s) => {
        if (!stopped) onChange(s);
      })
      .catch(() => {
        if (!stopped)
          setError(
            "เชื่อมต่อ LINE ไม่สำเร็จ คุณยังส่งคำขอโดยไม่รับแจ้งเตือน LINE ได้",
          );
      });
    return () => {
      stopped = true;
    };
  }, [onChange]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      onChange(await lineSession(true));
    } catch {
      setError("เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
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
        {demo || !lineEnabled ? (
          <p className="text-sm" role="status">
            {demo
              ? "โหมดทดลองยังไม่เชื่อมบัญชีหรือส่งข้อความ LINE จริง"
              : "กำลังเตรียมบริการ LINE คุณยังจองผ่านแบบฟอร์มนี้ได้ตามปกติ"}
          </p>
        ) : (
          <>
            <p role="status" className="text-sm">
              {session
                ? `เชื่อมต่อกับ ${session.displayName} แล้ว`
                : "เชื่อมต่อก่อนกรอกแบบฟอร์ม เพื่อให้กลับจาก LINE ได้สะดวก"}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void connect()}
            >
              {busy
                ? "กำลังเชื่อมต่อ..."
                : session
                  ? "ตรวจสอบการเชื่อมต่อ LINE อีกครั้ง"
                  : "เชื่อมต่อ LINE"}
            </Button>
            {session && !session.friend && (
              <>
                <p className="text-sm">
                  กรุณาเพิ่มเพื่อน LINE OA แล้วกดตรวจสอบการเชื่อมต่ออีกครั้ง
                  จึงจะรับข้อความได้
                </p>
                {friendUrl && (
                  <Button asChild variant="outline">
                    <a
                      href={friendUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      เพิ่มเพื่อน LINE OA
                    </a>
                  </Button>
                )}
              </>
            )}
            {session?.friend && (
              <label className="flex min-h-11 items-start gap-3 cursor-pointer">
                <Checkbox
                  className="mt-1 shrink-0"
                  checked={consent}
                  onCheckedChange={(v) => onConsent(v === true)}
                />
                <span className="text-sm">
                  ยินยอมให้ผูกบัญชี LINE กับคำขอนี้
                  เพื่อส่งผลอนุมัติและเตือนคืนอุปกรณ์ ไม่ใช้เพื่อส่งโฆษณา บล็อก
                  OA เพื่อหยุดรับข้อความได้
                </span>
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
