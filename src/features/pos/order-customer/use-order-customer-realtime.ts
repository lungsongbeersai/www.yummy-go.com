"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  isBranchRealtimeEvent,
  subscribeBranchTableRealtime,
  type BranchRealtimePayload,
} from "@/lib/socket";

interface UseOrderCustomerRealtimeParams {
  branchUuid?: string;
  refresh: () => Promise<void>;
}

// หน้าตะกร้า/สั่งอาหารต่อโต๊ะของแคชเชียร์ — ถ้าอีกเครื่อง (แคชเชียร์อีกคน หรือ
// ลูกค้าเองผ่าน QR) แก้จำนวน/ยกเลิก/เสิร์ฟ/จ่ายเงินโต๊ะเดียวกันพร้อมกัน หน้านี้
// ต้องรีเฟรช cart ให้ตรงข้อมูลจริงด้วย ไม่ใช่รอ mount ครั้งแรกอย่างเดียว — ใช้
// event ชุดเดียวกับหน้าเลือกโต๊ะ (table_status_changed + order_queue_changed)
// coalesce เป็นการโหลด cart ใหม่ครั้งเดียวเหมือน use-table-alerts.ts
export function useOrderCustomerRealtime({ branchUuid, refresh }: UseOrderCustomerRealtimeParams) {
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
