"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  isBranchRealtimeEvent,
  isTableAlertForBranch,
  subscribeBranchTableRealtime,
  subscribeTableAlerts,
  type BranchRealtimePayload,
  type TableAlertPayload,
} from "@/lib/socket";
import type { FetchPosParams, PosZone } from "@/services/pos";

interface UseTableAlertsParams {
  branchUuid?: string;
  language: string;
  refreshTables: (params: FetchPosParams) => Promise<PosZone[]>;
}

// การแจ้งเตือนแบบ global (patch pos-store, เล่นเสียง, toast) ย้ายไปอยู่ที่
// src/hooks/use-pos-order-alert-listener.ts (mount ครั้งเดียวใน AppShell) เพื่อ
// ให้ทำงานได้ทุกหน้า ไม่ใช่แค่ตอนเปิดหน้านี้ค้างไว้ — hook นี้เหลือหน้าที่เดียวคือ
// รีเฟรชตารางโต๊ะทุกโซนให้ตรงกับ backend ล่าสุดเมื่อมีการแจ้งเตือนเข้ามา (ไม่ส่ง
// zone_uuid เพราะหน้านี้แสดงทุกโซนพร้อมกันเสมอ ไม่ได้กรองด้วย backend แล้ว)
export function useTableAlerts({ branchUuid, language, refreshTables }: UseTableAlertsParams) {
  const refreshAllTables = useCallback(async () => {
    if (!branchUuid) return;

    await refreshTables({
      branch_uuid_fk: branchUuid,
      zone_uuid: "",
      lang: language
    });
  }, [branchUuid, language, refreshTables]);

  // A single POS action can emit several events (table_status_changed +
  // order_queue_changed). Coalesce them into one table refetch.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshAllTables().catch(() => undefined);
    }, 250);
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

  useEffect(() => {
    if (!branchUuid) return;
    const activeBranchUuid = branchUuid;

    function handleTableAlert(payload: TableAlertPayload) {
      if (!isTableAlertForBranch(payload, activeBranchUuid)) return;
      scheduleRefresh();
    }

    return subscribeTableAlerts(activeBranchUuid, handleTableAlert);
  }, [branchUuid, scheduleRefresh]);

  // Keep the table grid live when another device opens a table, adds an order,
  // or sends items to the kitchen.
  useEffect(() => {
    if (!branchUuid) return;
    const activeBranchUuid = branchUuid;

    function handleBranchRealtime(payload: BranchRealtimePayload) {
      if (!isBranchRealtimeEvent(payload, activeBranchUuid)) return;
      scheduleRefresh();
    }

    return subscribeBranchTableRealtime(activeBranchUuid, handleBranchRealtime);
  }, [branchUuid, scheduleRefresh]);
}
