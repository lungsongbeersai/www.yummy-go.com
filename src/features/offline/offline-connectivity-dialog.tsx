"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  applyConnectivityProbeResult,
  applyBackendOfflineChange,
  applyUserDismiss,
  initialOfflineDialogState,
} from "@/features/offline/offline-connectivity-domain";
import { useIsAndroidNativeApp } from "@/hooks/use-android-native-app";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import {
  probeBackendNow,
} from "@/stores/offline-transport-monitor";
import { useNetworkStore } from "@/stores/network-store";

// ยิง reconcile แบบ desktop/electron แล้วรอผลจาก schedule() ภายใน monitor เอง (ไม่ได้ return
// promise ตรง ๆ) — ให้เวลาสั้น ๆ พอสำหรับ Agent เริ่มเดิน pending sync หลัง Backend กลับมา
const RECONCILE_WAIT_MS = 1500;

async function probeActiveTransport() {
  const snapshot = await probeBackendNow();
  return snapshot.state === BACKEND_NETWORK_STATE.ONLINE;
}

export function OfflineConnectivityDialog() {
  const { t } = useTranslation();
  const networkState = useNetworkStore((state) => state.state);
  const backendOffline = networkState === BACKEND_NETWORK_STATE.OFFLINE;
  const isAndroidNative = useIsAndroidNativeApp();
  const [dialog, setDialog] = useState(initialOfflineDialogState);
  const [checking, setChecking] = useState(false);
  // ปิด popup + reset การ "ใช้งานโหมดออฟไลน์" ทันทีที่ Backend กลับมา reachable — เซ็ต state
  // จาก prop ที่เปลี่ยนตรงๆ ระหว่าง render (React "adjusting state during rendering" pattern)
  // ปลอดภัย ไม่โดน set-state-in-effect lint (state machine เต็มอยู่ที่ offline-connectivity-domain.ts)
  const [previousBackendOffline, setPreviousBackendOffline] = useState(backendOffline);
  if (backendOffline !== previousBackendOffline) {
    setPreviousBackendOffline(backendOffline);
    setDialog((state) => applyBackendOfflineChange(state, backendOffline));
  }

  // NetworkManager ผ่าน failure threshold แล้วจึงเข้าจุดนี้; probe อีกครั้งก่อนแสดง popup
  // เพื่อปิด race กรณีอินเทอร์เน็ตกลับมาพอดีระหว่าง state transition กับ render
  // ทำใน effect เพราะเป็น async work — setState ที่เรียกอยู่หลัง await ไม่ตรงกับ synchronous
  // set-state-in-effect ที่ lint กันไว้ (นั่นกันแค่ setState ทันทีในตัว effect body เอง) — ใช้ functional
  // updater ผ่าน applyConnectivityProbeResult() เพื่ออ่านค่า dismissedForThisOutage ล่าสุดเสมอ ไม่ใช่
  // ค่าที่ค้างอยู่ใน closure ตอน effect เริ่มรัน จึงไม่ต้องใส่ dialog ใน dependency array ด้านล่าง
  useEffect(() => {
    if (!backendOffline) return;
    let cancelled = false;
    void (async () => {
      const online = await probeActiveTransport();
      if (cancelled) return;
      setDialog((state) => applyConnectivityProbeResult(state, online));
    })();
    return () => {
      cancelled = true;
    };
  }, [backendOffline]);

  async function handleReconnect() {
    setChecking(true);
    try {
      const online = await probeActiveTransport();
      if (!online) return;
      setDialog((state) => applyConnectivityProbeResult(state, true));
      if (!isAndroidNative) {
        await new Promise((resolve) => setTimeout(resolve, RECONCILE_WAIT_MS));
      }
    } finally {
      setChecking(false);
    }
  }

  function handleOpenChange(next: boolean) {
    // ปิดผ่าน UI (กด "ใช้งานโหมดออฟไลน์") = ผู้ใช้ตัดสินใจแล้ว ไม่เปิดคืนจนกว่าจะออนไลน์จริง
    setDialog((state) => (next ? { ...state, open: true } : applyUserDismiss()));
  }

  return (
    <AlertDialog open={dialog.open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <WifiOff />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("offlineMode.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("offlineMode.dialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("offlineMode.useOfflineMode")}</AlertDialogCancel>
          <Button type="button" disabled={checking} onClick={() => void handleReconnect()}>
            {checking ? t("offlineMode.reconnecting") : t("offlineMode.reconnect")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
