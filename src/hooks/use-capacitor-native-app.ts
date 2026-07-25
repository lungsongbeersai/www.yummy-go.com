"use client";

import { useSyncExternalStore } from "react";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";

// ค่าคงที่ตลอดอายุหน้า จึงไม่มี event ให้ subscribe — คืน unsubscribe เปล่า
const subscribe = () => () => {};

// เดิมใช้ useState(false) + effect เซ็ตค่าจริงหลัง mount ซึ่งทำให้ผู้ใช้เห็นสถานะ
// "ไม่ใช่แอป" หนึ่งเฟรมเสมอ และผิดกฎ set-state-in-effect ของ React 19
//
// useSyncExternalStore คือเครื่องมือที่ React มีไว้สำหรับค่าที่ต่างกันระหว่าง
// server กับ client โดยเฉพาะ: server snapshot คืน false, client snapshot อ่านค่าจริง
// React จัดการเรื่อง hydration ให้เอง
export function useIsCapacitorNativeApp() {
  return useSyncExternalStore(
    subscribe,
    () => isCapacitorNativeApp(),
    () => false
  );
}
