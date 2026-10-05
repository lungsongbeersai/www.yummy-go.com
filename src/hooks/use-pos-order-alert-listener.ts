"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAlertSoundPlayer } from "@/hooks/use-alert-sound-player";
import { collectOrderAlerts } from "@/lib/pos/order-alerts";
import { isTableAlertForBranch, subscribeTableAlerts, type TableAlertPayload } from "@/lib/socket";
import { usePosStore } from "@/stores/pos-store";
import { useOrderAlertPopupStore } from "@/stores/order-alert-popup-store";

const newOrderAlertCooldownMs = 1200;

interface UsePosOrderAlertListenerParams {
  branchUuid?: string;
  language: string;
}

// Global, mount-once (AppShell) counterpart to
// features/pos/table-selection/hooks/use-table-alerts.ts — that hook only
// runs while the table grid screen is mounted, so a cashier working any
// other screen (checkout, products, reports) never heard the alert or saw
// pos-store update. This hook owns every branch-wide side effect (patch the
// store, play the sound, toast) so it fires regardless of route; the
// page-local hook is left with only its own screen's refetch.
export function usePosOrderAlertListener({ branchUuid, language }: UsePosOrderAlertListenerParams) {
  const playAlertSound = useAlertSoundPlayer("order");
  const lastAlertAtRef = useRef<Map<string, number>>(new Map());

  // แคชเชียร์เปิดหน้าตะกร้าโต๊ะนี้ค้างอยู่แล้ว (/posAll/order?table_uuid=...) ก็เห็น
  // อัปเดตสดผ่าน use-order-customer-realtime.ts อยู่แล้ว เสียงแจ้งเตือนซ้ำจึงไม่
  // จำเป็น — เก็บเป็น ref (ไม่ผูกกับ effect ที่ subscribe socket) กันไม่ให้
  // เปลี่ยนหน้าแล้วต้อง resubscribe ใหม่ทุกครั้ง
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeOrderTableUuidRef = useRef("");
  useEffect(() => {
    activeOrderTableUuidRef.current =
      pathname === "/posAll/order" ? searchParams.get("table_uuid") ?? "" : "";
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!branchUuid) return;
    // The table page owns this request. Skipping the global warm-up there
    // avoids two identical fetch_table calls racing during the same mount.
    if (pathname === "/posAll/tables") return;
    if (usePosStore.getState().zoneOptions.length > 0) return;

    // โหลด zoneOptions ล่วงหน้าไว้ตั้งแต่ล็อกอินเข้าแอป เผื่อแคชเชียร์ยังไม่เคย
    // เปิดหน้าเลือกโต๊ะเลยในเซสชันนี้ — กระดิ่งแจ้งเตือนจะได้มีข้อมูลให้แสดงทันที
    void usePosStore
      .getState()
      .loadTables({ branch_uuid_fk: branchUuid, zone_uuid: "", lang: language })
      .catch(() => undefined);
  }, [branchUuid, language, pathname]);

  useEffect(() => {
    if (!branchUuid) return;
    useOrderAlertPopupStore.getState().clear();
    lastAlertAtRef.current.clear();
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

      const isViewingThisTable = payload.table_uuid === activeOrderTableUuidRef.current;
      if (!isViewingThisTable) {
        playAlertSound();
      }

      const alert = collectOrderAlerts(usePosStore.getState().zoneOptions).find(
        (entry) => entry.tableUuid === payload.table_uuid
      );
      useOrderAlertPopupStore.getState().show(alert ?? {
        tableUuid: payload.table_uuid,
        tableName: typeof payload.table_name === "string" ? payload.table_name : "",
        zoneUuid: typeof payload.zone_uuid === "string" ? payload.zone_uuid : "",
        zoneName: typeof payload.zone_name === "string" ? payload.zone_name : "",
      });
    }

    const unsubscribe = subscribeTableAlerts(activeBranchUuid, handleTableAlert);
    return () => {
      unsubscribe();
      useOrderAlertPopupStore.getState().clear();
    };
  }, [branchUuid, playAlertSound]);
}
