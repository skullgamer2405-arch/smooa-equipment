import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";
export class RouteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div role="alert" className="rounded-lg border bg-white p-6"><h1>เปิดหน้านี้ไม่สำเร็จ</h1><p className="muted my-4">ตรวจการเชื่อมต่อแล้วลองเปิดใหม่ ร่างคำขอที่บันทึกไว้ในรอบใช้งานนี้จะยังอยู่</p><Button onClick={()=>window.location.reload()}>ลองเปิดหน้าใหม่</Button></div>;
    return this.props.children;
  }
}
