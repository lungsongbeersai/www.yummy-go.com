"use client";

import { AppShell } from "@/components/layout/web/app-shell";
import { NativeAppShell } from "@/components/layout/capacitor/app-shell";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { StaffWaiterNotifications } from "@/features/waiter-requests/staff-waiter-notifications";

// แยกเป็น client component เฉพาะจุดที่ต้องเรียก hook (useIsCapacitorNativeApp)
// เพื่อให้ (protected)/layout.tsx ยังเป็น server component ตามธรรมเนียม route file
// ของโปรเจกต์ (ดู src/lib/project-refactor-guards.test.ts:
// "keeps app route files as server components by default") — ถ้าใส่ "use client"
// ตรง ๆ ที่ layout.tsx จะชนกับเทสต์นี้ทันที
//
// NativeAppShell owns Android Back, keyboard and refresh lifecycle at every width.
// It shares only the browser's presentation frame on wide back-office screens;
// its mobile navigation and dedicated POS workspaces keep their native layout.
export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const isCapacitorNativeApp = useIsCapacitorNativeApp();
  const Shell = isCapacitorNativeApp ? NativeAppShell : AppShell;

  return (
    <>
      <StaffWaiterNotifications />
      <Shell>{children}</Shell>
    </>
  );
}
