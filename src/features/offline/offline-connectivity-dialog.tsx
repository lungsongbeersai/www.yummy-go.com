"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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

// เดิมเป็น AlertDialog ที่บล็อกทั้งจอ — เปลี่ยนเป็น toast ค้างอยู่ด้านล่างแทน ผู้ใช้ยังทำงานต่อ
// ได้ระหว่างออฟไลน์ กดปิด toast = "ใช้งานโหมดออฟไลน์", ปุ่มใน toast = "เชื่อมต่อใหม่".
const OFFLINE_TOAST_ID = "offline-connectivity";
const BACK_ONLINE_TOAST_ID = "offline-connectivity-back";

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
  // ปิด toast + reset การ "ใช้งานโหมดออฟไลน์" ทันทีที่ Backend กลับมา reachable — เซ็ต state
  // จาก prop ที่เปลี่ยนตรงๆ ระหว่าง render (React "adjusting state during rendering" pattern)
  // ปลอดภัย ไม่โดน set-state-in-effect lint (state machine เต็มอยู่ที่ offline-connectivity-domain.ts)
  const [previousBackendOffline, setPreviousBackendOffline] = useState(backendOffline);
  if (backendOffline !== previousBackendOffline) {
    setPreviousBackendOffline(backendOffline);
    setDialog((state) => applyBackendOfflineChange(state, backendOffline));
  }

  // NetworkManager ผ่าน failure threshold แล้วจึงเข้าจุดนี้; probe อีกครั้งก่อนแสดง toast
  // เพื่อปิด race กรณีอินเทอร์เน็ตกลับมาพอดีระหว่าง state transition กับ render
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

  const handleReconnect = useCallback(async () => {
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
  }, [isAndroidNative]);

  // แสดง/อัปเดต/ปิด toast ตามสถานะ state machine เดิม (dialog.open)
  useEffect(() => {
    if (!dialog.open) {
      toast.dismiss(OFFLINE_TOAST_ID);
      return;
    }
    toast.warning(t("offlineMode.dialogTitle"), {
      id: OFFLINE_TOAST_ID,
      description: t("offlineMode.dialogDescription"),
      duration: Infinity,
      position: "bottom-center",
      dismissible: true,
      action: {
        label: checking
          ? t("offlineMode.reconnecting")
          : t("offlineMode.reconnect"),
        onClick: () => void handleReconnect(),
      },
      // ปัดปิด/กดกากบาท = ผู้ใช้เลือก "ใช้งานโหมดออฟไลน์" ไม่เด้งซ้ำจนกว่าจะออนไลน์จริง
      onDismiss: () => setDialog(() => applyUserDismiss()),
    });
  }, [dialog.open, checking, t, handleReconnect]);

  // ยืนยันการกลับมาออนไลน์ด้วย toast สั้น ๆ (แทน popup เดิม)
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (backendOffline) {
      wasOfflineRef.current = true;
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    toast.dismiss(OFFLINE_TOAST_ID);
    toast.success(t("offlineMode.backOnline"), {
      id: BACK_ONLINE_TOAST_ID,
      duration: 3000,
      position: "bottom-center",
    });
  }, [backendOffline, t]);

  useEffect(() => () => {
    toast.dismiss(OFFLINE_TOAST_ID);
  }, []);

  return null;
}
