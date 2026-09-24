"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  isBranchRealtimeEvent,
  subscribeTableStatusChanges,
  type BranchRealtimePayload,
} from "@/lib/socket";
import type { FetchPosParams, PosZone } from "@/services/pos";

interface UseTableAlertsParams {
  branchUuid?: string;
  language: string;
  refreshTables: (params: FetchPosParams) => Promise<PosZone[]>;
  updateTableStatus: (tableUuid: string, tableStatus: number) => void;
}

// การแจ้งเตือนออเดอร์ (patch customer_order_state, เสียง, toast) อยู่ที่ listener
// กลางใน AppShell ส่วน hook นี้รับผิดชอบเฉพาะ table_status และการ reconcile เมื่อ
// กลับเข้า foreground จึงไม่มี subscriber ซ้ำหรือ fetch ซ้ำจาก event เดียวกัน
export function useTableAlerts({
  branchUuid,
  language,
  refreshTables,
  updateTableStatus,
}: UseTableAlertsParams) {
  const refreshAllTables = useCallback(async () => {
    if (!branchUuid) return;

    await refreshTables({
      branch_uuid_fk: branchUuid,
      zone_uuid: "",
      lang: language
    });
  }, [branchUuid, language, refreshTables]);

  // Socket payloads patch the changed card immediately. The delayed fetch is a
  // reconciliation pass for derived fields (such as opened_at), not the primary
  // realtime path. A burst of table changes therefore costs one request.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshAllTables().catch(() => undefined);
    }, 1000);
  }, [refreshAllTables]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!branchUuid) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refreshAllTables().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [branchUuid, refreshAllTables]);

  // order_queue_changed does not alter any field rendered by the table grid.
  // table_status_changed is the authoritative compact event for occupancy, so
  // avoid downloading the whole grid for quantity/kitchen queue changes.
  useEffect(() => {
    if (!branchUuid) return;
    const activeBranchUuid = branchUuid;

    function handleBranchRealtime(payload: BranchRealtimePayload) {
      if (!isBranchRealtimeEvent(payload, activeBranchUuid)) return;
      const tableUuid = typeof payload.table_uuid === "string" ? payload.table_uuid : "";
      const tableStatus = Number(payload.to_status);
      if (!tableUuid || !Number.isInteger(tableStatus)) return;

      updateTableStatus(tableUuid, tableStatus);
      scheduleRefresh();
    }

    return subscribeTableStatusChanges(activeBranchUuid, handleBranchRealtime);
  }, [branchUuid, scheduleRefresh, updateTableStatus]);
}
