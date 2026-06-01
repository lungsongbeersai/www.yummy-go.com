"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from "react";
import { subscribeTableAlerts, type TableAlertPayload } from "@/lib/socket";
import type { CartOrder, FetchPosParams, PosTable, PosZone } from "@/services/pos";

const orderAlertSoundUrl = "/sounds/orderNew1.mp3";
const audioUnlockEvents = ["click", "touchstart", "keydown"] as const;
const newOrderSoundCooldownMs = 1200;

type CartPanelData = CartOrder | CartOrder[] | null;

interface UseTableAlertsParams {
  branchUuid?: string;
  language: string;
  onCartRefreshError: (error: unknown) => void;
  refreshSelectedCart: (options?: { showLoading?: boolean }) => Promise<CartPanelData>;
  refreshTables: (params: FetchPosParams) => Promise<PosZone[]>;
  selectedTableUuid: string;
  selectedZoneUuid: string;
  setSelectedTable: Dispatch<SetStateAction<PosTable | null>>;
  setZoneOptions: Dispatch<SetStateAction<PosZone[]>>;
  updateTableCustomerOrderState: (tableUuid: string, customerOrderState: boolean) => void;
}

function isCurrentBranchAlert(payload: TableAlertPayload, branchUuid: string) {
  return Boolean(payload.table_uuid) && (!payload.branch_uuid_fk || payload.branch_uuid_fk === branchUuid);
}

function nextCustomerOrderState(payload: TableAlertPayload) {
  return payload.customer_order_state !== false;
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

export function useTableAlerts({
  branchUuid,
  language,
  onCartRefreshError,
  refreshSelectedCart,
  refreshTables,
  selectedTableUuid,
  selectedZoneUuid,
  setSelectedTable,
  setZoneOptions,
  updateTableCustomerOrderState
}: UseTableAlertsParams) {
  const playAlertSound = useAlertSoundPlayer();
  const lastSoundAtRef = useRef<Map<string, number>>(new Map());

  const playOrderAlertSoundWithCooldown = useCallback(
    (tableUuid: string) => {
      const now = Date.now();
      const lastPlayedAt = lastSoundAtRef.current.get(tableUuid) ?? 0;
      if (now - lastPlayedAt < newOrderSoundCooldownMs) return;

      lastSoundAtRef.current.set(tableUuid, now);
      playAlertSound();
    },
    [playAlertSound]
  );

  const refreshVisibleTables = useCallback(async () => {
    if (!branchUuid) return;

    const nextZones = await refreshTables({
      branch_uuid_fk: branchUuid,
      zone_uuid: selectedZoneUuid,
      lang: language
    });

    if (!selectedZoneUuid) setZoneOptions(nextZones);
  }, [branchUuid, language, refreshTables, selectedZoneUuid, setZoneOptions]);

  const updateTableAlertState = useCallback(
    (tableUuid: string, customerOrderState: boolean) => {
      updateTableCustomerOrderState(tableUuid, customerOrderState);
      setSelectedTable((currentTable) =>
        currentTable?.table_uuid === tableUuid
          ? { ...currentTable, customer_order_state: customerOrderState }
          : currentTable
      );
    },
    [setSelectedTable, updateTableCustomerOrderState]
  );

  useEffect(() => {
    if (!branchUuid) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refreshVisibleTables().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [branchUuid, refreshVisibleTables]);

  useEffect(() => {
    if (!branchUuid) return;
    const activeBranchUuid = branchUuid;

    function handleTableAlert(payload: TableAlertPayload) {
      if (!isCurrentBranchAlert(payload, activeBranchUuid)) return;

      const customerOrderState = nextCustomerOrderState(payload);
      updateTableAlertState(payload.table_uuid, customerOrderState);

      void refreshVisibleTables().catch(() => undefined);

      if (!customerOrderState) return;

      playOrderAlertSoundWithCooldown(payload.table_uuid);
      if (selectedTableUuid === payload.table_uuid) {
        void refreshSelectedCart({ showLoading: false }).catch(onCartRefreshError);
      }
    }

    return subscribeTableAlerts(activeBranchUuid, handleTableAlert);
  }, [
    branchUuid,
    onCartRefreshError,
    playOrderAlertSoundWithCooldown,
    refreshSelectedCart,
    refreshVisibleTables,
    selectedTableUuid,
    updateTableAlertState
  ]);
}
