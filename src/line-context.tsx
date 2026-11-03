import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { demo } from "./lib/data";
import {
  lineEnabled,
  lineSession,
  lineFriendUrl,
  type LineSession,
} from "./lib/line";
import {
  savedLineChoice,
  saveLineChoice,
  type LineChoice,
} from "./lib/line-consent";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";

type Account = Pick<LineSession, "displayName" | "friend">;
type LineState = {
  consent: boolean;
  ready: boolean;
};
const Context = createContext<LineState | null>(null);
const demoAccount = { displayName: "บัญชี LINE ตัวอย่าง", friend: true };

export function LineProvider({ children }: { children: ReactNode }) {
  const [initialChoice] = useState(savedLineChoice);
  const [choice, setChoice] = useState(initialChoice);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(
    demo || !lineEnabled || initialChoice !== "pending",
  );
  const [open, setOpen] = useState(initialChoice === ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const adminPage = /^\/admin(?:\.html)?\/?$/.test(useLocation().pathname);
  // Consent is a preference, not proof of identity. Every linked booking checks
  // the current LINE session and the server verifies its ID token again.
  const consent = choice === "accepted";
  const attempt = useRef(0);
  function remember(value: Exclude<LineChoice, "">) {
    setChoice(value);
    saveLineChoice(value);
  }
  useEffect(() => {
    const version = ++attempt.current;
    // Already connected: no second app permission prompt or profile request.
    // LIFF restores login on entry; a stale login must not disable notifications
    // silently by sending an unlinked booking instead.
    if (initialChoice !== "pending") return;
    if (demo) {
      remember("accepted");
      return;
    }
    if (!lineEnabled) {
      setReady(true);
      return;
    }
    lineSession()
      .then((s) => {
        if (attempt.current !== version) return;
        setAccount(s ? { displayName: s.displayName, friend: s.friend } : null);
        if (s?.friend) {
          remember("accepted");
          setOpen(false);
        } else setOpen(true);
      })
      .catch(() => {
        if (attempt.current === version) {
          setError(
            "ตรวจการเชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง หรือเลือกไว้ภายหลัง",
          );
          setOpen(true);
        }
      })
      .finally(() => {
        if (attempt.current === version) setReady(true);
      });
    return () => {
      attempt.current++;
    };
  }, [initialChoice]);
  function dismiss() {
    attempt.current++;
    setBusy(false);
    setReady(true);
    if (!consent) remember("declined");
    setOpen(false);
  }
  async function accept() {
    if (busy) return;
    const version = ++attempt.current;
    setBusy(true);
    setError("");
    // Remember an unfinished login only for its redirect, not as lasting consent.
    remember("pending");
    try {
      const s = demo ? demoAccount : await lineSession(true);
      if (attempt.current !== version) return;
      setAccount(s ? { displayName: s.displayName, friend: s.friend } : null);
      if (s?.friend) {
        remember("accepted");
        setOpen(false);
      }
    } catch {
      if (attempt.current === version)
        setError(
          "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง หรือเลือกไว้ภายหลัง",
        );
    } finally {
      if (attempt.current === version) {
        setBusy(false);
        setReady(true);
      }
    }
  }
  const friendUrl = lineFriendUrl();
  return (
    <Context.Provider value={{ consent, ready }}>
      {children}
      <Dialog
        open={open && !adminPage && (demo || lineEnabled)}
        onOpenChange={(value) => (value ? setOpen(true) : dismiss())}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.getElementById("main")?.focus();
          }}
        >
          <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle aria-hidden="true" />
          </div>
          <DialogTitle className="text-2xl leading-snug">
            รับแจ้งเตือนจาก SMO OA ผ่าน LINE
          </DialogTitle>
          <DialogDescription>
            เชื่อมบัญชี LINE เพื่อรับผลอนุมัติคำขอยืม
            และเตือนคืนอุปกรณ์ในแชทของคุณ
          </DialogDescription>
          <ul className="list-disc pl-5 text-sm space-y-2">
            <li>ใช้ชื่อโปรไฟล์และตัวระบุบัญชี LINE เพื่อผูกกับคำขอยืม</li>
            <li>แจ้งเตือนก่อนคืน 1 วัน และวันครบกำหนด ช่วง 09:00–09:59 น. เวลาไทย</li>
            <li>รับเฉพาะข่าวสารคำขอยืม ไม่มีข้อความโฆษณา</li>
          </ul>
          {demo && (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm">
              นี่คือตัวอย่างหน้าขออนุญาต ยังไม่เชื่อมบัญชีหรือส่งข้อความ LINE
              จริง
            </p>
          )}
          {!demo && account && !account.friend && (
            <div className="grid gap-3">
              <p role="status" className="text-sm">
                เชื่อมกับ {account.displayName} แล้ว กรุณาเพิ่มเพื่อน SMO OA
                แล้วกดตรวจสอบอีกครั้งเพื่อรับข้อความ
              </p>
            </div>
          )}
          <p className="text-sm muted">
            เชื่อมต่อครั้งเดียวสำหรับคำขอนี้และครั้งถัดไป
            เมื่อกลับมาเปิดเว็บบนเบราว์เซอร์เดิมจะไม่ถามซ้ำ
            หากต้องการหยุดรับข้อความ สามารถบล็อก SMO OA ใน LINE ได้
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid gap-2">
            <Button type="button" disabled={busy} onClick={() => void accept()}>
              {busy
                ? "กำลังเชื่อมต่อ..."
                : demo
                  ? "ทดลองอนุญาต (ข้อมูลจำลอง)"
                  : account && !account.friend
                    ? "เพิ่มเพื่อนแล้ว ตรวจสอบอีกครั้ง"
                    : "ยินยอมและเชื่อมต่อ LINE"}
            </Button>
            {friendUrl && (demo || !account?.friend) && (
              <Button asChild variant="outline">
                <a href={friendUrl} target="_blank" rel="noopener noreferrer">
                  เพิ่มเพื่อน SMO OA
                </a>
              </Button>
            )}
            <Button type="button" variant="outline" onClick={dismiss}>
              ไว้ภายหลัง
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}
export function useLine() {
  const state = useContext(Context);
  if (!state) throw Error("LineProvider missing");
  return state;
}
