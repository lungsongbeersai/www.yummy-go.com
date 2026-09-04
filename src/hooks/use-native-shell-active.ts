"use client";

import { useIsCapacitorNativeApp } from "./use-capacitor-native-app";

// ProtectedShell เคยสลับไปใช้ AppShell (แบบเดสก์ท็อป) แทน NativeAppShell ตอน Capacitor
// จอกว้าง/แนวนอน — hook นี้เกิดมาเพื่อให้หน้าฟีเจอร์ต่าง ๆ รู้ว่า NativeTopBar/NativeBottomNav
// กำลังโชว์อยู่จริงไหม (ต่างจาก isCapacitorNativeApp ดิบที่ตอนนั้นไม่พอ) ตอนนี้ ProtectedShell
// ย้อนกลับไปใช้ NativeAppShell เสมอเวลารัน Capacitor แล้ว (ดู protected-shell.tsx) เงื่อนไข
// นี้เลยเท่ากับ isCapacitorNativeApp ตรง ๆ อีกครั้ง — เก็บ hook นี้ไว้เป็น alias เดิมแทนที่จะ
// ไล่แก้ทุกจุดที่เรียกใช้อยู่ (order-customer-view.tsx, table-selection-page.tsx ฯลฯ) กลับไป
// เรียก isCapacitorNativeApp ตรง ๆ ทีละไฟล์
export function useIsNativeShellActive() {
  return useIsCapacitorNativeApp();
}
