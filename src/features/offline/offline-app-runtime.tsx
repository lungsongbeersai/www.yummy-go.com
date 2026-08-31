"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { useAuthStore } from "@/stores/auth-store";
import {
  startAndroidOnlineRecoveryMonitor,
  startOfflineTransportMonitor,
} from "@/stores/offline-transport-monitor";

const OFFLINE_ROUTES = [
  "/", "/login", "/pos", "/pos/tables", "/pos/order", "/order_manage",
  "/products", "/stock", "/sales/sales-list", "/report/daily-closing",
  "/report/daily-sales", "/report/best-selling-products",
  "/report/payment-methods", "/report/category-sales",
  "/settings/user", "/settings/branch",
] as const;

export function OfflineAppRuntime() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Android พิมพ์ผ่าน Native TCP โดยตรงและไม่มี Desktop Printer Agent
    // ที่ 127.0.0.1:7777 จึงตรวจ Backend โดยตรงเพื่อออกจาก offlineSession
    // โดยไม่เริ่ม Agent monitor ของ Desktop
    if (isCapacitorAndroidApp()) {
      return startAndroidOnlineRecoveryMonitor();
    }

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

    void navigator.serviceWorker.register("/offline-sw.js", { scope: "/" }).then(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!active) return;
      registration.active?.postMessage({ type: "WARM_OFFLINE_ROUTES", routes: OFFLINE_ROUTES });
      if (isLoggedIn && navigator.onLine) {
        OFFLINE_ROUTES.forEach((route) => router.prefetch(route));
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
