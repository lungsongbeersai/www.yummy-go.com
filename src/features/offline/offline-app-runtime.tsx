"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { useAuthStore } from "@/stores/auth-store";
import {
  startBackendNetworkMonitor,
  startOfflineTransportMonitor,
} from "@/stores/offline-transport-monitor";

const OFFLINE_ROUTES = [
  "/", "/login", "/pos", "/pos/tables", "/pos/order", "/order_manage",
  "/products", "/stock", "/printers", "/sales/sales-list", "/report/daily-closing",
  "/report/daily-sales", "/report/best-selling-products",
  "/report/payment-methods", "/report/category-sales",
  "/settings/user", "/settings/branch",
] as const;

export function OfflineAppRuntime() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => startBackendNetworkMonitor(), []);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Android prints through Native TCP and has no Desktop Local Agent. Backend
    // reachability is already owned by startBackendNetworkMonitor above.
    if (isCapacitorAndroidApp()) return;

    return startOfflineTransportMonitor();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // ห้าม register ใน dev เสมอ — next.config.ts ปิด InjectManifest ตอน Turbopack dev เพราะไม่รองรับ
    // (ดู providers.tsx: unregisterStaleServiceWorkersInDev) ถ้า register ที่นี่แบบไม่เช็คโหมด จะไป
    // แย่ง register ใหม่ทับ SW ที่เพิ่งถูกล้างไป กลายเป็น loop ที่ SW เก่า (จาก `npm run build` ครั้ง
    // ก่อนหน้าที่ยังไม่ถูกลบออกจาก public/offline-sw.js) พยายาม precache ไฟล์ hash เก่าที่ dev server
    // ไม่มีจริง (404 รัว ๆ) จนบล็อก fetch ของทั้งหน้ารวมถึง request ล็อกอิน
    if (process.env.NODE_ENV !== "production") return;
    let active = true;
    let reloadingForNewWorker = false;
    let stopUpdateChecks: (() => void) | undefined;

    const handleControllerChange = () => {
      if (reloadingForNewWorker) return;
      reloadingForNewWorker = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker.register("/offline-sw.js", { scope: "/" }).then(async (registration) => {
      await navigator.serviceWorker.ready;
      if (!active) return;
      registration.active?.postMessage({ type: "WARM_OFFLINE_ROUTES", routes: OFFLINE_ROUTES });
      if (isLoggedIn && navigator.onLine) {
        OFFLINE_ROUTES.forEach((route) => router.prefetch(route));
        void Promise.all([
          import("@/features/pos/table-selection/payment-dialog"),
          import("@/features/pos/order-customer/order-customer-category-icon"),
        ]).catch(() => undefined);
      }

      // Without this a tab left open across a deploy keeps running the old
      // bundle until the browser's own ~24h check. Re-check for a new worker
      // whenever the tab refocuses or the network returns; serwist's
      // skipWaiting + clientsClaim then triggers controllerchange -> reload.
      const checkForUpdate = () => {
        if (document.visibilityState === "hidden") return;
        void registration.update().catch(() => undefined);
      };
      document.addEventListener("visibilitychange", checkForUpdate);
      window.addEventListener("online", checkForUpdate);
      stopUpdateChecks = () => {
        document.removeEventListener("visibilitychange", checkForUpdate);
        window.removeEventListener("online", checkForUpdate);
      };
    }).catch(() => undefined);

    return () => {
      active = false;
      stopUpdateChecks?.();
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [isLoggedIn, router]);

  return null;
}
