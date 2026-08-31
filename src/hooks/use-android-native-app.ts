"use client";

import { useSyncExternalStore } from "react";
import { isAndroidNativeApp } from "@/lib/capacitor-platform";

const subscribe = () => () => {};

// ตาม pattern เดียวกับ useIsCapacitorNativeApp — server snapshot คืน false เสมอ กัน
// hydration flash ที่ค่าฝั่ง client ต่างจาก server (ดู use-capacitor-native-app.ts)
export function useIsAndroidNativeApp() {
  return useSyncExternalStore(
    subscribe,
    () => isAndroidNativeApp(),
    () => false
  );
}
