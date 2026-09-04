"use client";

import { AppShell } from "@/components/layout/web/app-shell";
import { NativeAppShell } from "@/components/layout/capacitor/app-shell";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";

// แยกเป็น client component เฉพาะจุดที่ต้องเรียก hook (useIsCapacitorNativeApp)
// เพื่อให้ (protected)/layout.tsx ยังเป็น server component ตามธรรมเนียม route file
// ของโปรเจกต์ (ดู src/lib/project-refactor-guards.test.ts:
// "keeps app route files as server components by default") — ถ้าใส่ "use client"
// ตรง ๆ ที่ layout.tsx จะชนกับเทสต์นี้ทันที
//
// เคยลองสลับเป็น AppShell (แบบเดสก์ท็อป) ตอน Capacitor จอกว้าง/แนวนอนมาแล้ว (ความกว้างจริง
// ใกล้เคียง desktop) แต่ AppShell มาจาก components/ui/sidebar.tsx ที่ทดสอบมาแค่บนเบราว์เซอร์
// เดสก์ท็อป ไม่เคยรองรับ WebView ของ Capacitor เลย — ชนปัญหาไล่ไม่จบ (safe-area บน/ล่าง,
// ข้อความล้นตอนย่อเมนู, คลิกไอคอนแล้วพฤติกรรมผิดจากเดสก์ท็อป) จึงย้อนกลับมาใช้ NativeAppShell
// เสมอเวลารัน Capacitor ไม่ว่าจอจะกว้างแค่ไหน/หมุนทิศไหนก็ตาม
export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const isCapacitorNativeApp = useIsCapacitorNativeApp();
  const Shell = isCapacitorNativeApp ? NativeAppShell : AppShell;

  return <Shell>{children}</Shell>;
}
