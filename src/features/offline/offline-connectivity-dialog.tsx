"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import { useNetworkStore } from "@/stores/network-store";

const OFFLINE_TOAST_ID = "offline-connectivity";
const BACK_ONLINE_TOAST_ID = "offline-connectivity-back";
const NOTICE_DURATION_MS = 3000;

// เน็ตหลุด/กลับมา แจ้งเป็น toast ด้านล่างจอ หายเองใน 3 วิ ไม่บล็อกจอ ไม่มีปุ่ม ผู้ใช้ทำงานต่อ
// ได้ทันที — ออฟไลน์ใช้โทน warning + ไอคอน WifiOff ผูกกับ design token ผ่าน sonner (richColors),
// กลับมาออนไลน์ใช้ toast สีเขียวเดิม
export function OfflineConnectivityDialog() {
  const { t } = useTranslation();
  const backendOffline =
    useNetworkStore((state) => state.state) === BACKEND_NETWORK_STATE.OFFLINE;
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (backendOffline) {
      wasOfflineRef.current = true;
      toast.warning(t("offlineMode.dialogTitle"), {
        id: OFFLINE_TOAST_ID,
        description: t("offlineMode.toastDescription"),
        icon: <WifiOffIcon className="size-4" />,
        duration: NOTICE_DURATION_MS,
        position: "bottom-center",
      });
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    toast.dismiss(OFFLINE_TOAST_ID);
    toast.success(t("offlineMode.backOnline"), {
      id: BACK_ONLINE_TOAST_ID,
      duration: NOTICE_DURATION_MS,
      position: "bottom-center",
    });
  }, [backendOffline, t]);

  useEffect(
    () => () => {
      toast.dismiss(OFFLINE_TOAST_ID);
    },
    [],
  );

  return null;
}
