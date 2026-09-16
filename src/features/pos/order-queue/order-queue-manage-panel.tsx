"use client";

import { useTranslation } from "react-i18next";
import { ChefHat, Clock } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { OrderQueueTableRow } from "@/features/pos/order-queue/order-queue-items";
import {
  OrderQueueTableBody,
  OrderQueueTableFoot,
  OrderQueueTableHead,
  useOrderQueueTableScrollSync
} from "@/features/pos/order-queue/order-queue-table-frame";
import {
  formatQueueWait,
  type QueueItemAction
} from "@/features/pos/order-queue/order-queue-view";
import { manageQueueUrgencyTier } from "@/features/pos/order-queue/order-queue-urgency";
import { OrderItemStatus } from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";

export interface OrderQueueManageRow {
  item: OrderQueueItem;
  position: number;
  waitMinutes: number;
  selected: boolean;
  selectable: boolean;
  acting: boolean;
}

interface OrderQueueManagePanelProps {
  rows: OrderQueueManageRow[];
  headerChecked: boolean | "indeterminate";
  isSelectable: boolean;
  hasSelectableItems: boolean;
  /** ออเดอร์เดียวที่ค้าง 15+ นาที (เก่าสุดถ้ามีหลายใบ) — null เมื่อไม่มีใบไหนล็อกอยู่ */
  lockedOrderItemUuid: string | null;
  onToggle: (item: OrderQueueItem, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onAction: (item: OrderQueueItem, action: QueueItemAction) => void;
  onCancel: (item: OrderQueueItem) => void;
}

/**
 * แท็บ "รอยืนยันส่งครัว" เท่านั้น — ตารางเดิมทั้งหมด (สี/กะพริบตามเวลารอ) ถ้ามีรายการ
 * ค้าง 15+ นาทีจะมีแบนเนอร์ปักหัวตารางด้วย (เคยมีคอลัมน์ "Manage" แยกทางขวา ถูกเอาออก
 * ตามที่ขอ แต่ยังคงพฤติกรรมสี/กะพริบ/ล็อกทั้งหมดไว้ในตารางเดียวนี้)
 */
export function OrderQueueManagePanel({
  rows,
  headerChecked,
  isSelectable,
  hasSelectableItems,
  lockedOrderItemUuid,
  onToggle,
  onToggleAll,
  onAction,
  onCancel
}: OrderQueueManagePanelProps) {
  const { t } = useTranslation();
  const { headRef, footRef, handleBodyScroll } = useOrderQueueTableScrollSync();

  const blockingRow = lockedOrderItemUuid
    ? rows.find((row) => row.item.order_item_uuid === lockedOrderItemUuid) ?? null
    : null;
  // ข้อความนี้ใช้กับปุ่ม "ส่งครัว/เสิร์ฟ" ของออเดอร์อื่นทุกใบเท่านั้น — ปุ่มยกเลิกไม่ถูกล็อก
  // เพราะยกเลิกไม่ใช่การส่งออเดอร์ใหม่เข้าครัวซ้อนออเดอร์ที่ค้างอยู่
  const lockedReason = blockingRow
    ? t("orderQueue.lockedActionDisabled", {
        table: blockingRow.item.table_name || t("orderQueue.noTable"),
        wait: formatQueueWait(blockingRow.waitMinutes, t)
      })
    : undefined;
  const oldestWait = rows.reduce((longest, row) => Math.max(longest, row.waitMinutes), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {blockingRow ? (
        <Alert variant="destructive" className="shrink-0 items-center py-2 pr-36 sm:pr-40">
          <Clock />
          <AlertTitle>{t("orderQueue.lockedBannerTitle")}</AlertTitle>
          <AlertDescription>
            {t("orderQueue.lockedBannerDescription", {
              table: blockingRow.item.table_name || t("orderQueue.noTable"),
              wait: formatQueueWait(blockingRow.waitMinutes, t)
            })}
          </AlertDescription>
          <AlertAction>
            {/* เดิมทำเป็นไอคอนอย่างเดียว + tooltip เพื่อให้พอดีช่องที่ AlertAction กันไว้
                (pr-18 = 4.5rem ใน alert.tsx) — แต่จอ POS นี้ใช้นิ้วแตะเป็นหลัก ไม่มี hover
                ให้เห็น tooltip เลย ปุ่มไม่มีข้อความจะไม่มีทางรู้ความหมายได้เลยบนอุปกรณ์สัมผัส
                จึงเพิ่ม padding ขวาของ Alert เอง (pr-36/pr-40) ให้กว้างพอใส่ไอคอน+ข้อความจริง
                แทนที่จะยอมเสียการเข้าถึงบนจอสัมผัสเพื่อประหยัดที่ */}
            <Button
              type="button"
              size="sm"
              className="h-8 font-black"
              disabled={blockingRow.acting}
              onClick={() => onAction(blockingRow.item, "send")}
            >
              {blockingRow.acting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ChefHat data-icon="inline-start" />
              )}
              {t("orderQueue.sendToKitchen")}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0 py-0">
        <OrderQueueTableHead
          headerChecked={headerChecked}
          showCheckbox={isSelectable && hasSelectableItems}
          onToggleAll={onToggleAll}
          scrollContainerRef={headRef}
        />
        <OrderQueueTableBody onScroll={handleBodyScroll}>
          {rows.map((row) => (
            <OrderQueueTableRow
              key={row.item.order_item_uuid}
              acting={row.acting}
              item={row.item}
              position={row.position}
              selectable={row.selectable}
              selected={row.selected}
              status={OrderItemStatus.WAITING_CONFIRM}
              waitMinutes={row.waitMinutes}
              manageUrgency={manageQueueUrgencyTier(row.waitMinutes)}
              lockedReason={
                lockedOrderItemUuid && row.item.order_item_uuid !== lockedOrderItemUuid
                  ? lockedReason
                  : undefined
              }
              onAction={(action) => onAction(row.item, action)}
              onCancel={() => onCancel(row.item)}
              onToggle={(checked) => onToggle(row.item, checked)}
            />
          ))}
        </OrderQueueTableBody>
        <OrderQueueTableFoot
          count={rows.length}
          oldestWait={oldestWait}
          scrollContainerRef={footRef}
        />
      </Card>
    </div>
  );
}
