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
  applyOfflineSessionChange,
  applyUserDismiss,
  initialOfflineDialogState,
} from "@/features/offline/offline-connectivity-domain";
import { useIsAndroidNativeApp } from "@/hooks/use-android-native-app";
import { useAuthStore } from "@/stores/auth-store";
import {
  probeAndroidBackend,
  requestImmediateReconcile,
} from "@/stores/offline-transport-monitor";

// ยิง reconcile แบบ desktop/electron แล้วรอผลจาก schedule() ภายใน monitor เอง (ไม่ได้ return
// promise ตรง ๆ) — ให้เวลาสั้น ๆ พอสำหรับ round-trip ไป agent/backend จริงก่อนเช็ค offlineSession อีกที
const RECONCILE_WAIT_MS = 1500;

async function probeActiveTransport() {
  const auth = useAuthStore.getState();
  if (!auth.token || !auth.user) return false;
  return probeAndroidBackend({
    token: auth.token,
    storeUuid: auth.user.store_uuid || auth.user.store_uuid_fk || "",
    branchUuid: auth.user.branch_uuid || "",
  });
}

export function OfflineConnectivityDialog() {
  const { t } = useTranslation();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const offlineSession = useAuthStore((state) => state.offlineSession);
  const isAndroidNative = useIsAndroidNativeApp();
  const [dialog, setDialog] = useState(initialOfflineDialogState);
  const [checking, setChecking] = useState(false);
  // ปิด popup + reset การ "ใช้งานโหมดออฟไลน์" ทันทีที่ offlineSession กลับเป็น false — เซ็ต state
  // จาก prop ที่เปลี่ยนตรงๆ ระหว่าง render (React "adjusting state during rendering" pattern)
  // ปลอดภัย ไม่โดน set-state-in-effect lint (state machine เต็มอยู่ที่ offline-connectivity-domain.ts)
  const [prevOfflineSession, setPrevOfflineSession] = useState(offlineSession);
  if (offlineSession !== prevOfflineSession) {
    setPrevOfflineSession(offlineSession);
    setDialog((state) => applyOfflineSessionChange(state, offlineSession));
  }

  // request เดียวที่ timeout ชั่วคราวก็ตั้ง offlineSession=true ได้ (ดู api.ts) — ก่อนโชว์ popup
  // ต้อง "ยืนยัน" ด้วย probe จริงก่อนเสมอ ไม่งั้นโชว์ทั้งที่เน็ตปกติ (เน็ต "ไม่นิ่ง" ไม่ใช่ "หลุดจริง")
  // ทำใน effect เพราะเป็น async work — setState ที่เรียกอยู่หลัง await ไม่ตรงกับ synchronous
  // set-state-in-effect ที่ lint กันไว้ (นั่นกันแค่ setState ทันทีในตัว effect body เอง) — ใช้ functional
  // updater ผ่าน applyConnectivityProbeResult() เพื่ออ่านค่า dismissedForThisOutage ล่าสุดเสมอ ไม่ใช่
  // ค่าที่ค้างอยู่ใน closure ตอน effect เริ่มรัน จึงไม่ต้องใส่ dialog ใน dependency array ด้านล่าง
  useEffect(() => {
    if (!isLoggedIn || !offlineSession) return;
    let cancelled = false;
    void (async () => {
      const online = await probeActiveTransport();
      if (cancelled) return;
      setDialog((state) => applyConnectivityProbeResult(state, online));
      if (online) {
        useAuthStore.getState().setOfflineSession(false);
        if (!isAndroidNative) {
          // ให้ desktop monitor เดินคิว Agent/IndexedDB ต่อแยกจากสถานะการเชื่อมต่อ
          // เพื่อไม่บังคับ request ใหม่ให้อยู่ Offline เพียงเพราะยังมีคิวรอ sync
          requestImmediateReconcile();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAndroidNative, isLoggedIn, offlineSession]);

  async function handleReconnect() {
    setChecking(true);
    try {
      const online = await probeActiveTransport();
      if (!online) return;
      setDialog((state) => applyConnectivityProbeResult(state, true));
      useAuthStore.getState().setOfflineSession(false);
      if (!isAndroidNative) {
        requestImmediateReconcile();
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
