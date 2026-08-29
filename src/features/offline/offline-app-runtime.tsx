"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

const OFFLINE_ROUTES = [
  "/", "/login", "/pos/tables", "/pos/order", "/order_manage",
  "/products", "/stock", "/sales/sales-list", "/report/daily-closing",
  "/report/daily-sales", "/report/best-selling-products",
  "/report/payment-methods", "/report/category-sales",
  "/settings/user", "/settings/branch",
] as const;

export function OfflineAppRuntime() {
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

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
