"use client";

import { Ban, ChefHat, CircleCheck, Clock, StickyNote, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  formatQueueClock,
  formatQueueDateTime,
  queueWaitUrgency,
  resolveProductMedia,
  waitBadgeVariant
} from "@/features/pos/order-queue/order-queue-view";
import { OrderItemStatus, type OrderItemStatus as OrderItemStatusType } from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";

interface OrderQueueItemRowProps {
  item: OrderQueueItem;
  position: number;
  status: OrderItemStatusType;
  selected: boolean;
  selectable: boolean;
  onToggle: (checked: boolean) => void;
}

export function OrderQueueItemRow({
  item,
  position,
  status,
  selected,
  selectable,
  onToggle
}: OrderQueueItemRowProps) {
  const { t } = useTranslation();
  const minutes = Math.max(0, Number(item.open_minutes ?? 0));
  const urgency = queueWaitUrgency(minutes);
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  const media = resolveProductMedia(item.product_image);

  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        {selectable ? (
          <Checkbox
            aria-label={t("orderQueue.queuePosition", { position })}
            checked={selected}
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        ) : null}
      </TableCell>
      <TableCell>{position}</TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Badge variant={waitBadgeVariant(urgency)}>
            {t("orderQueue.openMinutesAgo", { count: minutes })}
          </Badge>
          {hours > 0 ? (
            <span className="text-muted-foreground">
              {t("orderQueue.hoursMinutes", {
                hours,
                minutes: remainMinutes
              })}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        {item.table_name || t("orderQueue.noTable")}
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex items-start gap-2">
          <Avatar size="lg">
            {media.type === "image" ? (
              <AvatarImage src={media.src} alt={item.product_name} />
            ) : null}
            <AvatarFallback>
              <Utensils />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium">{item.product_name}</p>
            {item.note ? (
              <p className="flex items-start gap-1 text-muted-foreground">
                <StickyNote />
                <span className="line-clamp-2">{item.note}</span>
              </p>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">× {item.qty}</Badge>
      </TableCell>
      <TableCell>#{item.order_it_q}</TableCell>
      <TableCell title={formatQueueDateTime(item.order_it_date_time)}>
        {formatQueueClock(item.order_it_date_time)}
      </TableCell>
      <TableCell>
        <QueueStateBadge item={item} status={status} />
      </TableCell>
    </TableRow>
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
    if (item.can_send_to_kitchen) {
      return (
        <Badge>
          <Clock data-icon="inline-start" />
          {t("orderQueue.readyToSend")}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock data-icon="inline-start" />
        {t("orderQueue.waiting")}
      </Badge>
    );
  }

  if (status === OrderItemStatus.SENT_TO_KITCHEN) {
    if (item.can_confirm_served) {
      return (
        <Badge>
          <ChefHat data-icon="inline-start" />
          {t("orderQueue.readyToServe")}
        </Badge>
      );
    }

    return (
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
