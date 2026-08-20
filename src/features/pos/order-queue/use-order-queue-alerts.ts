"use client";

import { useCallback, useEffect } from "react";
import { isTableAlertForBranch, subscribeTableAlerts, type TableAlertPayload } from "@/lib/socket";

interface UseOrderQueueAlertsParams {
  branchUuid?: string;
  refresh: () => Promise<void>;
}

// ใช้ event table_alert เดิม (ไม่มี event เฉพาะ order-queue ฝั่ง backend) เป็น
// signal ว่ามีอะไรเปลี่ยน แล้วรีโหลดคิวของ tab ที่เปิดอยู่ใหม่ทั้งก้อน — เหมือน
// use-table-alerts.ts ของหน้าเลือกโต๊ะ พร้อม fallback รีเฟรชตอนกลับมาที่แท็บ
export function useOrderQueueAlerts({ branchUuid, refresh }: UseOrderQueueAlertsParams) {
  const refreshQueue = useCallback(async () => {
    if (!branchUuid) return;
    await refresh();
  }, [branchUuid, refresh]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refreshQueue().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshQueue]);

  useEffect(() => {
    if (!branchUuid) return;
    const activeBranchUuid = branchUuid;

    function handleTableAlert(payload: TableAlertPayload) {
      if (!isTableAlertForBranch(payload, activeBranchUuid)) return;
      void refreshQueue().catch(() => undefined);
    }

    return subscribeTableAlerts(activeBranchUuid, handleTableAlert);
  }, [branchUuid, refreshQueue]);
}
