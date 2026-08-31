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
import { useIsAndroidNativeApp } from "@/hooks/use-android-native-app";
import { useAuthStore } from "@/stores/auth-store";
import {
  probeAndroidBackend,
  probeConnectivity,
  requestImmediateReconcile,
} from "@/stores/offline-transport-monitor";

// ยิง reconcile แบบ desktop/electron แล้วรอผลจาก schedule() ภายใน monitor เอง (ไม่ได้ return
// promise ตรง ๆ) — ให้เวลาสั้น ๆ พอสำหรับ round-trip ไป agent/backend จริงก่อนเช็ค offlineSession อีกที
const RECONCILE_WAIT_MS = 1500;

async function probeActiveTransport(isAndroidNative: boolean) {
  if (!isAndroidNative) return probeConnectivity();
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
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  // ปิด popup ทันทีที่ offlineSession กลับเป็น false — เซ็ต state จาก prop ที่เปลี่ยนตรงๆ ระหว่าง
  // render (React "adjusting state during rendering" pattern) ปลอดภัย ไม่โดน set-state-in-effect lint
  const [prevOfflineSession, setPrevOfflineSession] = useState(offlineSession);
  if (offlineSession !== prevOfflineSession) {
    setPrevOfflineSession(offlineSession);
    if (!offlineSession) setOpen(false);
  }

  // request เดียวที่ timeout ชั่วคราวก็ตั้ง offlineSession=true ได้ (ดู api.ts) — ก่อนโชว์ popup
  // ต้อง "ยืนยัน" ด้วย probe จริงก่อนเสมอ ไม่งั้นโชว์ทั้งที่เน็ตปกติ (เน็ต "ไม่นิ่ง" ไม่ใช่ "หลุดจริง")
  // ทำใน effect เพราะเป็น async work — setState ที่เรียกอยู่หลัง await ไม่ตรงกับ synchronous
  // set-state-in-effect ที่ lint กันไว้ (นั่นกันแค่ setState ทันทีในตัว effect body เอง)
  useEffect(() => {
    if (!isLoggedIn || !offlineSession) return;
    let cancelled = false;
    void (async () => {
      const online = await probeActiveTransport(isAndroidNative);
      if (cancelled) return;
      if (online) {
        setOpen(false);
        if (isAndroidNative) {
          useAuthStore.getState().setOfflineSession(false);
        } else {
          // ให้ desktop monitor ตรวจคิว Agent/IndexedDB ก่อนออกจาก offline mode เพื่อไม่ให้
          // การซ่อน popup ทำรายการขายที่ยังไม่ sync หล่นหาย
          requestImmediateReconcile();
        }
      } else {
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAndroidNative, isLoggedIn, offlineSession]);

  async function handleReconnect() {
    setChecking(true);
    try {
      const online = await probeActiveTransport(isAndroidNative);
      if (!online) return;
      setOpen(false);
      if (isAndroidNative) {
        useAuthStore.getState().setOfflineSession(false);
      } else {
        requestImmediateReconcile();
        await new Promise((resolve) => setTimeout(resolve, RECONCILE_WAIT_MS));
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
