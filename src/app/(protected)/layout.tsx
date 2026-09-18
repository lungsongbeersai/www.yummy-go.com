import type { Viewport } from "next";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ProtectedShell } from "@/components/layout/protected-shell";

// เฉพาะ route กลุ่มนี้ (หลังบ้าน ต้อง login) เป็นจอ POS/tablet ของร้านจริง ๆ — ปิด pinch-zoom
// กันบั๊ก iOS/WKWebView ที่ซูมเข้าอัตโนมัติตอนแตะ input แล้วค้างไม่คืนสเกล (ดูคู่กับ
// .capacitor-ios ใน globals.css ที่กันไม่ให้ซูมเกิดตั้งแต่ต้นด้วย font-size >= 16px) ต้อง
// ไม่ตั้งค่านี้ที่ root layout เพราะ src/app/posAll (หน้าสั่งอาหารสาธารณะของลูกค้า) อยู่นอก
// กลุ่มนี้ — ดู docs/Decisions.md หัวข้อ "Disable pinch-zoom on staff-only routes"
export const viewport: Viewport = {
  maximumScale: 1,
  userScalable: false,
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthGuard>
  );
}
