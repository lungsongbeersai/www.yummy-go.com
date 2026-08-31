"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAndroidNativeApp } from "@/lib/capacitor-platform";
import {
  getOfflineAllowedPaths,
  OFFLINE_INFRA_PATHS,
} from "@/lib/offline-routes";
import { internalRoute } from "@/lib/routes";
import { useAuthStore } from "@/stores/auth-store";
import {
  startAndroidOfflineMonitor,
  startOfflineTransportMonitor,
} from "@/stores/offline-transport-monitor";

export function OfflineAppRuntime() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Android พิมพ์ผ่าน Native TCP โดยตรงและไม่มี Desktop Printer Agent ที่ 127.0.0.1:7777 ให้
    // configureLocalSync/reconcileBrowserSyncQueue พึ่งพา (ดู offline-sync.ts) จึงใช้ monitor เต็ม
    // ของ desktop ไม่ได้ (จะขึ้น "Agent ปิดอยู่" เท็จตลอด) แต่ยังต้องตรวจ online/offline จริงเพื่อ
    // gate หน้า/เมนู (อ่านอย่างเดียว) กับ popup แจ้งเตือน จึงใช้ monitor เบาแทนแทนที่จะไม่ทำอะไรเลย
    if (isAndroidNativeApp()) return startAndroidOfflineMonitor();

    return startOfflineTransportMonitor();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    let reloadingForNewWorker = false;

    const handleControllerChange = () => {
      if (reloadingForNewWorker) return;
      reloadingForNewWorker = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const warmRoutes = [...OFFLINE_INFRA_PATHS, ...getOfflineAllowedPaths(isAndroidNativeApp())];

    void navigator.serviceWorker.register("/offline-sw.js", { scope: "/" }).then(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!active) return;
      registration.active?.postMessage({ type: "WARM_OFFLINE_ROUTES", routes: warmRoutes });
      if (isLoggedIn && navigator.onLine) {
        warmRoutes.forEach((route) => router.prefetch(internalRoute(route)));
        void Promise.all([
          import("@/features/pos/table-selection/payment-dialog"),
          import("@/features/pos/order-customer/order-customer-category-icon"),
        ]).catch(() => undefined);
      }
    }).catch(() => undefined);

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [isLoggedIn, router]);

  return null;
}
