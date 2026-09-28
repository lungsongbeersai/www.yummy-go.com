"use client";

import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  QueueActionButton,
  QueueCancelButton,
  QueueItemMedia,
  QueueItemNote,
  QueueStateBadge,
  QueueWaitPill,
  isInteractiveClick
} from "@/features/pos/order-queue/order-queue-items";
import {
  manageQueueEdgeClass,
  manageQueueUrgencyTier
} from "@/features/pos/order-queue/order-queue-urgency";
import {
  formatQueueClock,
  formatQueueDateTime,
  groupQueueRowsByTable,
  queueItemAction,
  queueWaitEdgeClass,
  queueWaitUrgency,
  type OrderQueueRow,
  type QueueItemAction,
  type QueueTableGroup
} from "@/features/pos/order-queue/order-queue-view";
import {
  OrderItemStatus,
  type OrderItemStatus as OrderItemStatusType
} from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";

interface OrderQueueTicketBoardProps {
  rows: OrderQueueRow[];
  status: OrderItemStatusType;
  /** ออเดอร์ที่ค้าง 15+ นาทีในแท็บรอยืนยันส่งครัว — null เมื่อไม่มีใบไหนล็อก */
  lockedOrderItemUuid: string | null;
  lockedReason?: string;
  onToggle: (item: OrderQueueItem, checked: boolean) => void;
  onToggleMany: (items: OrderQueueItem[], checked: boolean) => void;
  onAction: (item: OrderQueueItem, action: QueueItemAction) => void;
  onCancel: (item: OrderQueueItem) => void;
}

/**
 * มุมมอง "ตามโต๊ะ" — หนึ่งใบต่อหนึ่งโต๊ะเหมือนใบออเดอร์ที่ห้อยไว้หน้าครัว พนักงานเห็นทีเดียวว่า
 * โต๊ะไหนรอนานสุดและต้องเอาอะไรไปบ้าง แทนการไล่อ่านทีละรายการที่ชื่อโต๊ะซ้ำกันเป็นสิบแถว
 * ลำดับใบ = ลำดับเข้าคิวเดิม (ดู groupQueueRowsByTable) การเลือก/ปุ่มทุกปุ่มยังเป็นรายรายการ
 * เหมือนเดิมทุกอย่าง ใช้ action ชุดเดียวกับมุมมองรายการ ไม่มีเส้นทางเปลี่ยนสถานะใหม่
 */
export function OrderQueueTicketBoard({
  rows,
  status,
  lockedOrderItemUuid,
  lockedReason,
  onToggle,
  onToggleMany,
  onAction,
  onCancel
}: OrderQueueTicketBoardProps) {
  const groups = groupQueueRowsByTable(rows);

  return (
    // items-start: ใบที่มีรายการน้อยไม่ถูกยืดสูงเท่าใบข้าง ๆ ในแถวเดียวกัน
    <div className="grid min-h-0 flex-1 auto-rows-min items-start gap-3 overflow-y-auto pb-1 md:grid-cols-2 md:gap-4 2xl:grid-cols-3">
      {groups.map((group) => (
        <OrderQueueTicket
          key={group.key || "__no_table__"}
          group={group}
          status={status}
          lockedOrderItemUuid={lockedOrderItemUuid}
          lockedReason={lockedReason}
          onToggle={onToggle}
          onToggleMany={onToggleMany}
          onAction={onAction}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}

function OrderQueueTicket({
  group,
  status,
  lockedOrderItemUuid,
  lockedReason,
  onToggle,
  onToggleMany,
  onAction,
  onCancel
}: Omit<OrderQueueTicketBoardProps, "rows"> & { group: QueueTableGroup<OrderQueueRow> }) {
  const { t } = useTranslation();
  const isManage = status === OrderItemStatus.WAITING_CONFIRM;
  const manageUrgency = isManage ? manageQueueUrgencyTier(group.oldestWait) : undefined;
  const selectableRows = group.rows.filter((row) => row.selectable);
  const selectedCount = selectableRows.filter((row) => row.selected).length;
  const groupChecked =
    selectableRows.length > 0 && selectedCount === selectableRows.length
      ? true
      : selectedCount > 0
        ? "indeterminate"
        : false;
  const tableLabel = group.key || t("orderQueue.noTable");
  const qtyTotal = group.rows.reduce((sum, row) => sum + (Number(row.item.qty) || 0), 0);
  // แท็บที่จบงานแล้ว (เสิร์ฟ/ยกเลิก) เวลาเป็นสถิติ ไม่ใช่สัญญาณเร่ง — ไม่ต้องย้อมสีขอบใบ
  const finished = status === OrderItemStatus.SERVED || status === OrderItemStatus.CANCELLED;
  const edgeClass = finished
    ? "bg-border"
    : manageUrgency
      ? manageQueueEdgeClass(manageUrgency)
      : queueWaitEdgeClass(queueWaitUrgency(group.oldestWait));

  return (
    <Card
      data-state={selectedCount > 0 ? "selected" : undefined}
      className={cn(
        // @container: บรรทัดรายการจัดปุ่มไว้ข้างขวาเมื่อใบกว้างพอ (ดู OrderQueueTicketLine)
        "@container relative gap-0 overflow-hidden p-0 py-0 transition-shadow",
        selectedCount > 0 && "ring-2 ring-primary"
      )}
    >
      <span aria-hidden="true" className={cn("h-1 w-full shrink-0", edgeClass)} />

      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        {selectableRows.length > 0 ? (
          <Checkbox
            aria-label={t("orderQueue.groupSelectAria", { table: tableLabel })}
            checked={groupChecked}
            onCheckedChange={(checked) =>
              onToggleMany(
                selectableRows.map((row) => row.item),
                checked === true
              )
            }
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-2xs font-bold uppercase tracking-wide text-muted-foreground">
            {group.key ? t("pos.table") : t("orderQueue.ticketLabel")}
          </span>
          <span
            className={cn(
              "truncate text-xl font-black leading-tight",
              group.key ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {tableLabel}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <QueueWaitPill
            waitMinutes={group.oldestWait}
            manageUrgency={finished ? undefined : manageUrgency}
          />
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {t("orderQueue.itemCount", { count: group.rows.length })}
            <span aria-hidden="true"> · </span>
            {t("orderQueue.portionCount", { count: qtyTotal })}
          </span>
        </div>
      </header>

      <ul className="divide-y divide-border">
        {group.rows.map((row) => (
          <OrderQueueTicketLine
            key={row.item.order_item_uuid}
            row={row}
            status={status}
            // เวลาเท่ากับหัวใบ = ข้อมูลซ้ำ โชว์เฉพาะรายการที่มาทีหลังจึงรอน้อยกว่าใบ
            showWait={row.waitMinutes !== group.oldestWait}
            blocking={row.item.order_item_uuid === lockedOrderItemUuid}
            lockedReason={
              lockedOrderItemUuid && row.item.order_item_uuid !== lockedOrderItemUuid
                ? lockedReason
                : undefined
            }
            onToggle={(checked) => onToggle(row.item, checked)}
            onAction={(action) => onAction(row.item, action)}
            onCancel={() => onCancel(row.item)}
          />
        ))}
      </ul>
    </Card>
  );
}

function OrderQueueTicketLine({
  row,
  status,
  showWait,
  blocking,
  lockedReason,
  onToggle,
  onAction,
  onCancel
}: {
  row: OrderQueueRow;
  status: OrderItemStatusType;
  /** false เมื่อเวลารอเท่ากับที่หัวใบโชว์อยู่แล้ว */
  showWait: boolean;
  /** รายการที่ค้างจนล็อกรายการอื่น — เน้นพื้นให้หาเจอในใบทันทีที่อ่านแบนเนอร์ */
  blocking: boolean;
  lockedReason?: string;
  onToggle: (checked: boolean) => void;
  onAction: (action: QueueItemAction) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { item, selectable, selected, acting, waitMinutes, position } = row;
  const action = queueItemAction(item);
  const isManage = status === OrderItemStatus.WAITING_CONFIRM;
  const finished = status === OrderItemStatus.SERVED || status === OrderItemStatus.CANCELLED;

  return (
    <li
      data-state={selected ? "selected" : undefined}
      className={cn(
        "flex flex-col gap-2.5 px-4 py-3 transition-colors @md:flex-row @md:items-center @md:gap-4",
        selectable && "cursor-pointer hover:bg-muted/40",
        selected && "bg-primary/5 hover:bg-primary/10",
        blocking && "bg-destructive/5"
      )}
      onClick={(event) => {
        if (!selectable || isInteractiveClick(event)) return;
        onToggle(!selected);
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {selectable ? (
          <Checkbox
            className="mt-1"
            aria-label={t("orderQueue.queuePosition", { position })}
            checked={selected}
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        ) : null}
        <QueueItemMedia item={item} className="size-12" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <p className="lao-tone-text min-w-0 text-pretty text-base font-black leading-tight text-foreground">
              {item.product_name}
            </p>
            <span className="shrink-0 text-lg font-black leading-none tabular-nums text-foreground">
              ×{item.qty}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums">#{item.order_it_q}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums" title={formatQueueDateTime(item.order_it_date_time)}>
              {formatQueueClock(item.order_it_date_time)}
            </span>
            {showWait ? (
              <QueueWaitPill
                size="sm"
                waitMinutes={waitMinutes}
                manageUrgency={isManage ? manageQueueUrgencyTier(waitMinutes) : undefined}
              />
            ) : null}
            {finished ? null : <QueueStateBadge item={item} status={status} />}
          </div>
          <QueueItemNote note={item.note} />
        </div>
      </div>

      {selectable || action || finished ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {finished ? <QueueStateBadge item={item} status={status} className="mr-auto" /> : null}
          {selectable ? <QueueCancelButton acting={acting} onCancel={onCancel} /> : null}
          {action ? (
            <QueueActionButton
              acting={acting}
              disabledReason={lockedReason}
              action={action}
              onAction={onAction}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
