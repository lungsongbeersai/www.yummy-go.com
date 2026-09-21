"use client";

import { useEffect } from "react";
import { startNativeNetworkMonitor } from "@/lib/native-network";
import { startBackendNetworkMonitor } from "@/stores/offline-transport-monitor";

/**
 * ตัวเดียวที่ start ลูป probe /api/v1/sync/health จริงๆ — ก่อนหน้านี้
 * startBackendNetworkMonitor ถูกเขียน+เทสไว้แต่ไม่มีใคร call ในแอปเลย
 * (network-store จึงค้าง CHECKING ตลอด ไม่มีใคร report state ให้) ต่อจากนี้
 * mount ที่นี่จุดเดียว คู่กับ native network listener (มีผลเฉพาะ Capacitor)
 */
export function ConnectivityRuntime() {
  useEffect(() => {
    const stopBackendMonitor = startBackendNetworkMonitor();
    const stopNativeMonitor = startNativeNetworkMonitor();

    return () => {
      stopBackendMonitor();
      stopNativeMonitor();
    };
  }, []);

  return null;
}
