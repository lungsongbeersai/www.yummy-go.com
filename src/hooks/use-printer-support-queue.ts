"use client";

import { useEffect } from "react";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";

export function usePrinterSupportQueue() {
  const login = useAuthStore((state) => state.user?.uuid);
  const branch = useAuthStore((state) => state.user?.branch_uuid);
  const role = useAuthStore((state) => state.user?.status);
  const storeStatus = useAuthStore((state) => state.user?.store_status);
  const start = usePrinterStore((state) => state.startPrinterSupportBridge);
  useEffect(() => {
    if (!login || !branch || isCapacitorMobileApp()) return;
    const runner = start();
    const wake = () => { void runner.poll(); };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    return () => {
      runner.stop();
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
    };
  }, [login, branch, role, storeStatus, start]);
}
