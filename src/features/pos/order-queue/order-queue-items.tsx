"use client";

import { Ban, ChefHat, CircleCheck, Clock, StickyNote, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  formatQueueClock,
  formatQueueDateTime,
  formatQueueWait,
  queueItemAction,
  queueWaitEdgeClass,
  queueWaitToneClass,
  queueWaitUrgency,
  resolveProductMedia,
  waitBadgeVariant,
  type QueueItemAction
} from "@/features/pos/order-queue/order-queue-view";
import {
  OrderItemStatus,
  type OrderItemStatus as OrderItemStatusType
} from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";

/** ปุ่ม/ลิงก์/checkbox ในการ์ดมี action ของตัวเองอยู่แล้ว คลิกที่จุดเหล่านี้ต้องไม่ toggle selection ซ้ำ */
const INTERACTIVE_SELECTOR = 'button, a, [data-slot="checkbox"]';

function isInteractiveClick(event: React.MouseEvent<HTMLElement>) {
  return (event.target as HTMLElement).closest(INTERACTIVE_SELECTOR) !== null;
}

interface QueueItemViewProps {
  item: OrderQueueItem;
  /** เวลารอที่เดินต่อฝั่ง client แล้ว (open_minutes + เวลาที่ผ่านไปตั้งแต่โหลด) */
  waitMinutes: number;
  position: number;
  status: OrderItemStatusType;
  selected: boolean;
  selectable: boolean;
  acting: boolean;
  onToggle: (checked: boolean) => void;
  onAction: (action: QueueItemAction) => void;
}

/**
 * รูปสินค้าอาจเป็น URL หรือ hex color (สินค้าที่ไม่ได้อัปรูป) — Radix Avatar
 * สลับไป fallback ให้เองเมื่อรูปโหลดไม่ขึ้น เลย์เอาต์จึงไม่พังไม่ว่ากรณีไหน
 */
function QueueItemMedia({
  item,
  className
}: {
  item: OrderQueueItem;
  className?: string;
}) {
  const media = resolveProductMedia(item.product_image);

  return (
    <Avatar
      className={cn("rounded-lg after:rounded-lg", className)}
      style={media.type === "color" ? { backgroundColor: media.color } : undefined}
    >
      {media.type === "image" ? (
        <AvatarImage
          className="rounded-lg"
          src={media.src}
          alt={item.product_name}
        />
      ) : null}
      <AvatarFallback
        className={cn("rounded-lg", media.type === "color" && "bg-transparent text-white")}
      >
        <Utensils />
      </AvatarFallback>
    </Avatar>
  );
}

/** เวลารอคือข้อมูลชิ้นแรกที่พนักงานต้องเห็น จึงเป็นจุดเดียวที่ใช้สีบอกความเร่งด่วน */
function QueueWaitPill({ waitMinutes }: { waitMinutes: number }) {
  const { t } = useTranslation();
  const urgency = queueWaitUrgency(waitMinutes);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-black tabular-nums",
        queueWaitToneClass(urgency)
      )}
    >
      <Clock aria-hidden="true" className="size-4 shrink-0" />
      {formatQueueWait(waitMinutes, t)}
    </span>
  );
}

function QueueTableName({ item }: { item: OrderQueueItem }) {
  const { t } = useTranslation();
  const tableName = item.table_name?.trim();

  if (!tableName) {
    return (
      <span className="text-sm font-medium text-muted-foreground">
        {t("orderQueue.noTable")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-2xs font-bold uppercase text-muted-foreground">
        {t("pos.table")}
      </span>
      <span className="text-base font-black leading-none text-foreground">
        {tableName}
      </span>
    </span>
  );
}

function QueueItemNote({ note }: { note: string }) {
  const { t } = useTranslation();
  const value = note.trim();
  if (!value) return null;

  return (
    <p className="flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
      <StickyNote aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0">
        <span className="sr-only">{t("pos.note")}: </span>
        {value}
      </span>
    </p>
  );
}

function QueueActionButton({
  action,
  acting,
  className,
  onAction
}: {
  action: QueueItemAction;
  acting: boolean;
  className?: string;
  onAction: (action: QueueItemAction) => void;
}) {
  const { t } = useTranslation();
  const label =
    action === "send" ? t("orderQueue.sendToKitchen") : t("orderQueue.confirmServed");
  const Icon = action === "send" ? ChefHat : CircleCheck;

  return (
    <Button
      type="button"
      className={cn("h-11 px-4 font-black", className)}
      disabled={acting}
      onClick={() => onAction(action)}
    >
      {acting ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <Icon data-icon="inline-start" />
      )}
      {label}
    </Button>
  );
}

function QueueStateBadge({
  item,
  status
}: {
  item: OrderQueueItem;
  status: OrderItemStatusType;
}) {
  const { t } = useTranslation();

  if (item.kitchen_print_queued) {
    return (
      <Badge variant="secondary">
        <ChefHat data-icon="inline-start" />
        {t("orderQueue.kitchenPrintQueued")}
      </Badge>
    );
  }

  if (status === OrderItemStatus.WAITING_CONFIRM) {
    return item.can_send_to_kitchen ? (
      <Badge>
        <Clock data-icon="inline-start" />
        {t("orderQueue.readyToSend")}
      </Badge>
    ) : (
      <Badge variant="secondary">
        <Clock data-icon="inline-start" />
        {t("orderQueue.waiting")}
      </Badge>
    );
  }

  if (status === OrderItemStatus.SENT_TO_KITCHEN) {
    return item.can_confirm_served ? (
      <Badge>
        <ChefHat data-icon="inline-start" />
        {t("orderQueue.readyToServe")}
      </Badge>
    ) : (
      <Badge variant="secondary">
        <ChefHat data-icon="inline-start" />
        {t("orderQueue.inKitchen")}
      </Badge>
    );
  }

  if (status === OrderItemStatus.SERVED) {
    return (
      <Badge>
        <CircleCheck data-icon="inline-start" />
        {t("orderQueue.served")}
      </Badge>
    );
  }

  if (status === OrderItemStatus.CANCELLED) {
    return (
      <Badge variant="destructive">
        <Ban data-icon="inline-start" />
        {t("orderQueue.cancelled")}
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      <Clock data-icon="inline-start" />
      {t("orderQueue.waitingCustomer")}
    </Badge>
  );
}

/**
 * การ์ด — ลำดับสายตา: เวลารอ → โต๊ะ → สินค้า → จำนวน → ปุ่ม
 * เหมาะกับจอสัมผัส/จอครัวที่ยืนอ่านห่าง ๆ และกดด้วยนิ้ว
 */
export function OrderQueueCard({
  item,
  waitMinutes,
  position,
  status,
  selected,
  selectable,
  acting,
  onToggle,
  onAction
}: QueueItemViewProps) {
  const { t } = useTranslation();
  const action = queueItemAction(item);
  const urgency = queueWaitUrgency(waitMinutes);

  return (
    <Card
      data-state={selected ? "selected" : undefined}
      className={cn(
        "relative gap-0 overflow-hidden p-0 transition-shadow",
        selected && "ring-2 ring-primary",
        selectable && "cursor-pointer"
      )}
      onClick={(event) => {
        if (!selectable || isInteractiveClick(event)) return;
        onToggle(!selected);
      }}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-0 left-0 w-1", queueWaitEdgeClass(urgency))}
      />

      <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {selectable ? (
            <Checkbox
              aria-label={t("orderQueue.queuePosition", { position })}
              checked={selected}
              onCheckedChange={(checked) => onToggle(checked === true)}
            />
          ) : null}
          <QueueWaitPill waitMinutes={waitMinutes} />
        </div>
        <QueueTableName item={item} />
      </div>

      <div className="flex min-w-0 items-start gap-3 p-3 pl-4">
        <QueueItemMedia item={item} className="size-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="lao-tone-text text-pretty text-base font-black leading-tight text-foreground">
            {item.product_name}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="text-sm font-black tabular-nums text-foreground">
              × {item.qty}
            </span>
            <span className="tabular-nums">#{item.order_it_q}</span>
            <span
              className="tabular-nums"
              title={formatQueueDateTime(item.order_it_date_time)}
            >
              {formatQueueClock(item.order_it_date_time)}
            </span>
          </div>
          <QueueItemNote note={item.note} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5 pl-4">
        <QueueStateBadge item={item} status={status} />
        {action ? (
          <QueueActionButton
            acting={acting}
            action={action}
            className="shrink-0"
            onAction={onAction}
          />
        ) : null}
      </div>
    </Card>
  );
}

/** แถวตาราง — ความหนาแน่นสูง เหมาะกับจอกว้างที่ต้องกวาดหลายสิบรายการพร้อมกัน */
export function OrderQueueTableRow({
  item,
  waitMinutes,
  position,
  status,
  selected,
  selectable,
  acting,
  onToggle,
  onAction
}: QueueItemViewProps) {
  const { t } = useTranslation();
  const action = queueItemAction(item);
  const urgency = queueWaitUrgency(waitMinutes);

  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className={cn(selectable && "cursor-pointer")}
      onClick={(event) => {
        if (!selectable || isInteractiveClick(event)) return;
        onToggle(!selected);
      }}
    >
      <TableCell>
        {selectable ? (
          <Checkbox
            aria-label={t("orderQueue.queuePosition", { position })}
            checked={selected}
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant={waitBadgeVariant(urgency)} className="tabular-nums">
          <Clock data-icon="inline-start" />
          {formatQueueWait(waitMinutes, t)}
        </Badge>
      </TableCell>
      <TableCell>
        <QueueTableName item={item} />
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex min-w-0 items-start gap-2.5">
          <QueueItemMedia item={item} className="size-10" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="lao-tone-text font-bold text-foreground">
              {item.product_name}
            </p>
            <QueueItemNote note={item.note} />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm font-black tabular-nums">× {item.qty}</TableCell>
      <TableCell className="tabular-nums">#{item.order_it_q}</TableCell>
      <TableCell
        className="tabular-nums"
        title={formatQueueDateTime(item.order_it_date_time)}
      >
        {formatQueueClock(item.order_it_date_time)}
      </TableCell>
      <TableCell>
        <QueueStateBadge item={item} status={status} />
      </TableCell>
      <TableCell className="text-right">
        {action ? (
          <QueueActionButton acting={acting} action={action} onAction={onAction} />
        ) : null}
      </TableCell>
    </TableRow>
  );
}
