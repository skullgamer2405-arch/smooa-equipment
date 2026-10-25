import { useEffect, useRef, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  Link,
} from "react-router-dom";
import {
  Menu,
  ArrowUpRight,
  Package,
  CalendarDays,
  LayoutDashboard,
  Home,
  LogOut,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "./components/ui/sheet";
import { Button } from "./components/ui/button";
import { DataProvider, useData } from "./context";
import { demo, logout } from "./lib/data";
import { HomePage, CatalogPage, SuccessPage } from "./pages/catalog";
const BookingPage = lazy(() =>
  import("./pages/booking").then((m) => ({ default: m.BookingPage })),
);
const CalendarPage = lazy(() =>
  import("./pages/calendar").then((m) => ({ default: m.CalendarPage })),
);
const AdminPage = lazy(() =>
  import("./pages/admin").then((m) => ({ default: m.AdminPage })),
);
import { Empty } from "./components/shared";
import { LineProvider, LineStatusBar } from "./line-context";
const links = [
  { to: "/", label: "หน้าหลัก", icon: Home },
  { to: "/equipment.html", label: "อุปกรณ์", icon: Package },
  { to: "/calendar.html", label: "ปฏิทิน", icon: CalendarDays },
];
function Nav({ mobile = false }: { mobile?: boolean }) {
  const path = useLocation().pathname;
  const activePath = path === "/index.html" ? "/" : path.replace(/\.html$/, "");
  return (
    <nav
      aria-label={mobile ? "เมนูมือถือ" : "เมนูหลัก"}
      className={mobile ? "grid gap-2" : "hidden md:flex gap-1"}
    >
      {links.map(({ to, label, icon: Icon }) => {
        const link = (
          <Link
            to={to}
            aria-current={
              activePath === to.replace(/\.html$/, "") ? "page" : undefined
            }
            className="app-link"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
        return mobile ? (
          <SheetClose asChild key={to}>
            {link}
          </SheetClose>
        ) : (
          <span key={to}>{link}</span>
        );
      })}
    </nav>
  );
}
function Shell() {
  const { user, message, announce } = useData(),
    location = useLocation();
  const main = useRef<HTMLElement>(null);
  const titlePath =
    location.pathname === "/" || location.pathname === "/index.html"
      ? "/"
      : location.pathname.replace(/\.html$/, "") + ".html";
  useEffect(() => {
    document.title =
      ({
        "/": "หน้าหลัก",
        "/equipment.html": "รายการอุปกรณ์",
        "/booking.html": "ส่งคำขอยืม",
        "/calendar.html": "ปฏิทิน",
        "/admin.html": "จัดการระบบ",
        "/success.html": "ส่งคำขอสำเร็จ",
      }[titlePath] || "Equipment by SMO") + " | SMO.CRA";
    main.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        ข้ามไปยังเนื้อหา
      </a>
      {demo && (
        <div
          role="region"
          aria-label="โหมดข้อมูลตัวอย่าง"
          className="border-b bg-[#fff4d7] px-4 py-1 text-center text-sm text-[#65440b]"
        >
          ข้อมูลตัวอย่าง · ไม่เชื่อมต่อหรือแก้ไขข้อมูลจริง
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex min-h-20 max-w-[1200px] items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
          <Link to="/" title="หน้าหลัก" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Package className="size-6" />
            </span>
            <span>
              <span className="block text-lg text-primary">
                Equipment by SMO
              </span>
              <span className="block text-sm muted">
                สโมสรนักศึกษา · SMO.CRA
              </span>
            </span>
          </Link>
          <Nav />
          <div className="flex gap-2">
            <Button asChild variant="ghost" className="hidden lg:inline-flex">
              <Link to="/admin.html">
                <LayoutDashboard />
                ส่วนผู้ดูแล
              </Link>
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="ออกจากระบบ"
                onClick={() =>
                  logout().catch(() => announce("ออกจากระบบไม่สำเร็จ"))
                }
              >
                <LogOut />
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  className="md:hidden"
                  size="icon"
                  variant="outline"
                  aria-label="เปิดเมนู"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="px-4 pt-4">Equipment by SMO</SheetTitle>
                <SheetDescription className="px-4">
                  เมนูระบบยืมอุปกรณ์
                </SheetDescription>
                <div className="p-4">
                  <Nav mobile />
                  <SheetClose asChild>
                    <NavLink to="/admin.html" className="app-link">
                      <LayoutDashboard className="size-4" />
                      ส่วนผู้ดูแล
                    </NavLink>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <LineStatusBar />
      <main
        ref={main}
        id="main"
        tabIndex={-1}
        className="container-app min-h-[70vh] outline-none"
      >
        <Suspense fallback={<p role="status">กำลังเปิดหน้า...</p>}>
          <Routes>
            {["/", "/index.html"].map((p) => (
              <Route key={p} path={p} element={<HomePage />} />
            ))}
            {["/equipment", "/equipment.html"].map((p) => (
              <Route key={p} path={p} element={<CatalogPage />} />
            ))}
            {["/booking", "/booking.html"].map((p) => (
              <Route key={p} path={p} element={<BookingPage />} />
            ))}
            {["/calendar", "/calendar.html"].map((p) => (
              <Route key={p} path={p} element={<CalendarPage />} />
            ))}
            {["/success", "/success.html"].map((p) => (
              <Route key={p} path={p} element={<SuccessPage />} />
            ))}
            {["/admin", "/admin.html"].map((p) => (
              <Route key={p} path={p} element={<AdminPage />} />
            ))}
            <Route
              path="*"
              element={
                <Empty
                  title="ไม่พบหน้านี้"
                  action={
                    <Button asChild>
                      <Link to="/">กลับหน้าหลัก</Link>
                    </Button>
                  }
                />
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t bg-white">
        <div className="container-app flex flex-col justify-between gap-4 py-6! text-sm md:flex-row">
          <div>
            <p className="text-primary">Equipment by SMO</p>
            <p className="muted">
              ระบบยืมอุปกรณ์ สโมสรนักศึกษาราชวิทยาลัยจุฬาภรณ์
            </p>
          </div>
          <Link
            to="/equipment.html"
            className="inline-flex min-h-11 items-center gap-2 text-primary"
          >
            เลือกอุปกรณ์สำหรับกิจกรรมของคุณ <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </footer>
      <div
        className="fixed bottom-4 right-4 left-4 z-50 ml-auto max-w-md"
        role="status"
        aria-live="polite"
      >
        {message && (
          <div className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg">
            <p className="flex-1">{message}</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => announce("")}
              aria-label="ปิดข้อความ"
            >
              <X />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <DataProvider>
        <LineProvider>
          <Shell />
        </LineProvider>
      </DataProvider>
    </BrowserRouter>
  );
}
