"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { collectOrderAlerts } from "@/lib/pos/order-alerts";
import { isTableAlertForBranch, subscribeTableAlerts, type TableAlertPayload } from "@/lib/socket";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";

const orderAlertSoundUrl = "/sounds/orderNew1.mp3";
const audioUnlockEvents = ["click", "touchstart", "keydown"] as const;
const newOrderAlertCooldownMs = 1200;

interface UsePosOrderAlertListenerParams {
  branchUuid?: string;
  language: string;
}

function useAlertSoundPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(orderAlertSoundUrl);
    audio.preload = "auto";
    audioRef.current = audio;
    return audio;
  }, []);

  const unlockAudio = useCallback(() => {
    const audio = ensureAudio();
    if (unlockedRef.current) return;

    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        unlockedRef.current = true;
      })
      .catch(() => {});
  }, [ensureAudio]);

  useEffect(() => {
    ensureAudio();
    audioUnlockEvents.forEach((eventName) => {
      document.addEventListener(eventName, unlockAudio, { capture: true, once: true });
    });

    return () => {
      audioUnlockEvents.forEach((eventName) => {
        document.removeEventListener(eventName, unlockAudio, { capture: true });
      });
      audioRef.current?.pause();
      audioRef.current = null;
      unlockedRef.current = false;
    };
  }, [ensureAudio, unlockAudio]);

  return useCallback(() => {
    const audio = ensureAudio();
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [ensureAudio]);
}

// Global, mount-once (AppShell) counterpart to
// features/pos/table-selection/hooks/use-table-alerts.ts — that hook only
// runs while the table grid screen is mounted, so a cashier working any
// other screen (checkout, products, reports) never heard the alert or saw
// pos-store update. This hook owns every branch-wide side effect (patch the
// store, play the sound, toast) so it fires regardless of route; the
// page-local hook is left with only its own screen's refetch.
export function usePosOrderAlertListener({ branchUuid, language }: UsePosOrderAlertListenerParams) {
  const { t } = useTranslation();
  const playAlertSound = useAlertSoundPlayer();
  const lastAlertAtRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!branchUuid) return;
    if (usePosStore.getState().zoneOptions.length > 0) return;

    // โหลด zoneOptions ล่วงหน้าไว้ตั้งแต่ล็อกอินเข้าแอป เผื่อแคชเชียร์ยังไม่เคย
    // เปิดหน้าเลือกโต๊ะเลยในเซสชันนี้ — กระดิ่งแจ้งเตือนจะได้มีข้อมูลให้แสดงทันที
    void usePosStore
      .getState()
      .loadTables({ branch_uuid_fk: branchUuid, zone_uuid: "", lang: language })
      .catch(() => undefined);
  }, [branchUuid, language]);

  useEffect(() => {
    if (!branchUuid) return;
    const activeBranchUuid = branchUuid;

    function handleTableAlert(payload: TableAlertPayload) {
      if (!isTableAlertForBranch(payload, activeBranchUuid)) return;

      const customerOrderState = payload.customer_order_state !== false;
      usePosStore.getState().updateTableCustomerOrderState(payload.table_uuid, customerOrderState);
      if (!customerOrderState) return;

      const now = Date.now();
      const lastAlertAt = lastAlertAtRef.current.get(payload.table_uuid) ?? 0;
      if (now - lastAlertAt < newOrderAlertCooldownMs) return;
      lastAlertAtRef.current.set(payload.table_uuid, now);

      playAlertSound();

      const alert = collectOrderAlerts(usePosStore.getState().zoneOptions).find(
        (entry) => entry.tableUuid === payload.table_uuid
      );
      useToastStore.getState().show({
        title: t("notifications.newOrderToast.title"),
        description: alert
          ? t("notifications.newOrderToast.description", { table: alert.tableName, zone: alert.zoneName })
          : undefined,
        tone: "info"
      });
    }

    return subscribeTableAlerts(activeBranchUuid, handleTableAlert);
  }, [branchUuid, playAlertSound, t]);
}
