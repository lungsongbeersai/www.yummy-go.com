"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  isBranchRealtimeEvent,
  subscribeBranchTableRealtime,
  type BranchRealtimePayload,
} from "@/lib/socket";

interface UsePublicOrderRealtimeParams {
  branchUuid?: string;
  refresh: () => Promise<void>;
}

// ลูกค้าสแกน QR แล้วเปิดหน้าค้างไว้บนมือถือ — ถ้าฝั่งแคชเชียร์ยืนยัน/ยกเลิก/
// เสิร์ฟ/เก็บเงิน ตะกร้า+สถานะออเดอร์ของลูกค้อยังเป็นค่าเก่าจนกว่าจะรีเฟรชมือ
// เอา event เดียวกับหน้าเลือกโต๊ะฝั่ง POS มาฟัง (table_status_changed +
// order_queue_changed) แล้ว coalesce เป็นการโหลด cart ใหม่ครั้งเดียว เหมือน
// use-table-alerts.ts
export function usePublicOrderRealtime({ branchUuid, refresh }: UsePublicOrderRealtimeParams) {
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh().catch(() => undefined);
    }, 250);
  }, [refresh]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refresh]);

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
