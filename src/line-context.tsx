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
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";

type Choice = "accepted" | "declined" | "";
type Account = Pick<LineSession, "displayName" | "friend">;
const preferenceKey = `smo-line-notifications-v1-${demo ? "demo" : "live"}`;
function savedChoice(): Choice {
  try {
    const value = sessionStorage.getItem(preferenceKey);
    return value === "accepted" || value === "declined" ? value : "";
  } catch {
    return "";
  }
}
type LineState = {
  account: Account | null;
  consent: boolean;
  busy: boolean;
  requestConnection: () => void;
  setConsent: (value: boolean) => void;
};
const Context = createContext<LineState | null>(null);
const demoAccount = { displayName: "บัญชี LINE ตัวอย่าง", friend: true };

export function LineProvider({ children }: { children: ReactNode }) {
  const [initialChoice] = useState<Choice>(savedChoice);
  const [choice, setChoice] = useState(initialChoice);
  const [account, setAccount] = useState<Account | null>(
    demo && initialChoice === "accepted" ? demoAccount : null,
  );
  const [ready, setReady] = useState(demo || !lineEnabled);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const adminPage = /^\/admin(?:\.html)?\/?$/.test(useLocation().pathname);
  const consent = choice === "accepted" && account?.friend === true;
  const attempt = useRef(0);
  function remember(value: Choice) {
    setChoice(value);
    try {
      sessionStorage.setItem(preferenceKey, value);
    } catch {
      /* use in-memory preference */
    }
  }
  useEffect(() => {
    const version = ++attempt.current;
    if (demo) {
      setAccount(initialChoice === "accepted" ? demoAccount : null);
      return;
    }
    if (!lineEnabled || initialChoice !== "accepted") {
      setReady(true);
      return;
    }
    lineSession()
      .then((s) => {
        if (attempt.current === version)
          setAccount(
            s ? { displayName: s.displayName, friend: s.friend } : null,
          );
      })
      .catch(() => {
        if (attempt.current === version)
          setError(
            "ตรวจการเชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง หรือเลือกไว้ภายหลัง",
          );
      })
      .finally(() => {
        if (attempt.current === version) setReady(true);
      });
    return () => {
      attempt.current++;
    };
  }, [initialChoice]);
  useEffect(() => {
    if (
      !adminPage &&
      ready &&
      (demo || lineEnabled) &&
      choice !== "declined" &&
      !consent
    )
      setOpen(true);
  }, [adminPage, ready, choice, consent]);
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
    // Keep the user's choice through the official LINE login redirect, without storing tokens.
    remember("accepted");
    try {
      const s = demo ? demoAccount : await lineSession(true);
      if (attempt.current !== version) return;
      setAccount(s ? { displayName: s.displayName, friend: s.friend } : null);
      if (s?.friend) setOpen(false);
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
  function setConsent(value: boolean) {
    if (value && !account?.friend) {
      setOpen(true);
      return;
    }
    remember(value ? "accepted" : "declined");
  }
  const friendUrl = lineFriendUrl();
  return (
    <Context.Provider
      value={{
        account,
        consent,
        busy,
        setConsent,
        requestConnection: () => {
          setError("");
          setOpen(true);
        },
      }}
    >
      {children}
      <Dialog
        open={open && !adminPage}
        onOpenChange={(value) => (value ? setOpen(true) : dismiss())}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.getElementById("line-connection-toggle")?.focus();
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
            <li>แจ้งเตือนก่อนคืน 1 วัน และวันครบกำหนด เวลา 09:00 น. เวลาไทย</li>
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
              {friendUrl && (
                <Button asChild variant="outline">
                  <a href={friendUrl} target="_blank" rel="noopener noreferrer">
                    เพิ่มเพื่อน SMO OA
                  </a>
                </Button>
              )}
            </div>
          )}
          <p className="text-sm muted">
            เมื่ออนุญาต ระบบจะใช้การตั้งค่านี้กับคำขอที่ส่งในรอบการใช้งานนี้
            เปลี่ยนได้ในหน้าจอง หรือบล็อก OA เพื่อหยุดรับข้อความ
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                remember("declined");
                dismiss();
              }}
            >
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

export function LineStatusBar() {
  const { consent, requestConnection } = useLine();
  const adminPage = /^\/admin(?:\.html)?\/?$/.test(useLocation().pathname);
  if (adminPage || (!demo && !lineEnabled)) return null;
  return (
    <div className="border-b bg-white px-4">
      <div className="mx-auto flex max-w-[1136px] justify-end">
        <Button
          id="line-connection-toggle"
          type="button"
          variant="link"
          className="text-sm whitespace-normal text-left"
          onClick={requestConnection}
        >
          <MessageCircle aria-hidden="true" />
          {consent
            ? demo
              ? "ตัวอย่าง: เปิดรับแจ้งเตือน LINE"
              : "เปิดรับแจ้งเตือนจาก SMO OA แล้ว"
            : "เชื่อม LINE เพื่อรับแจ้งเตือน"}
        </Button>
      </div>
    </div>
  );
}
