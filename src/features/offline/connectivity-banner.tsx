"use client";

import { AlertTriangle, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { useNetworkStore } from "@/stores/network-store";

// แบนเนอร์คงที่ ไม่บล็อกหน้าจอ (ตามที่ตกลงไว้ — POS ต้องใช้งานต่อได้ระหว่างที่
// เชื่อมต่อมีปัญหา) แสดงเฉพาะตอน OFFLINE (ยืนยันแล้วจาก health-probe ที่ถี่สุด
// ทุก 3 วิตอนหลุด) หรือ isSlow (probe สำเร็จแต่ช้ากว่าเกณฑ์) — ไม่มี alert ตอน
// CHECKING/ONLINE ปกติ เพื่อไม่ให้กะพริบทุกครั้งที่โหลดหน้า
export function ConnectivityBanner() {
  const { t } = useTranslation();
  const state = useNetworkStore((store) => store.state);
  const isSlow = useNetworkStore((store) => store.isSlow);

  const tone =
    state === BACKEND_NETWORK_STATE.OFFLINE ? "offline" : isSlow ? "slow" : null;

  if (!tone) return null;

  const isOffline = tone === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // z-50 ต้องสูงกว่า .app-header (sticky z-40) ไม่งั้น header ที่ render
        // ทีหลังใน DOM (อยู่ใต้ {children}) จะทับแบนเนอร์นี้ทั้งที่ z-index เท่ากัน
        // ก็ยังแพ้เพราะ DOM หลังชนะ — เจอบั๊กนี้จริงตอนเทสในเบราว์เซอร์
        "fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-3 py-1.5 text-center text-xs font-medium",
        "pt-[calc(0.375rem+env(safe-area-inset-top,0px))]",
        isOffline
          ? "bg-destructive text-destructive-foreground"
          : "bg-warning text-warning-foreground"
      )}
    >
      {isOffline ? (
        <WifiOff className="size-3.5 shrink-0" />
      ) : (
        <AlertTriangle className="size-3.5 shrink-0" />
      )}
      <span>{t(isOffline ? "connectivity.offlineTitle" : "connectivity.slowTitle")}</span>
      <span className="hidden opacity-80 sm:inline">
        {t(isOffline ? "connectivity.offlineDescription" : "connectivity.slowDescription")}
      </span>
    </div>
  );
}
