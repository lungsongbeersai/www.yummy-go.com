"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectOrderAlerts, type OrderAlertEntry } from "@/lib/pos/order-alerts";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePosStore } from "@/stores/pos-store";

interface NotificationMenuProps {
  triggerClassName?: string;
  triggerSize?: ButtonProps["size"];
  triggerVariant?: ButtonProps["variant"];
}

export function NotificationMenu({
  triggerClassName,
  triggerSize = "icon",
  triggerVariant = "ghost"
}: NotificationMenuProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const zoneOptions = usePosStore((state) => state.zoneOptions);

  // รายการนี้มาจาก customer_order_state จริงของแต่ละโต๊ะ (ผ่าน pos-store ที่
  // อัปเดตด้วย socket table_alert) — ค้างอยู่จนกว่าจะกด "ยืนยันออเดอร์" ที่หน้า
  // โต๊ะจริงเท่านั้น การเปิดดรอปดาวน์นี้ไม่ถือว่ารับทราบ
  const orderAlerts = useMemo(() => collectOrderAlerts(zoneOptions), [zoneOptions]);

  const hasUnread = orderAlerts.length > 0;
  const badgeText = orderAlerts.length > 9 ? "9+" : String(orderAlerts.length);

  function openTableOrder(alert: OrderAlertEntry) {
    const params = new URLSearchParams({ table_uuid: alert.tableUuid, table_name: alert.tableName });
    router.push(`/pos/order?${params.toString()}`);
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant={triggerVariant}
              size={triggerSize}
              aria-label={t("notifications.title")}
              className={cn("relative", hasUnread && "notification-bell-alert", triggerClassName)}
            >
              {hasUnread ? <BellRing data-icon="inline-start" /> : <Bell data-icon="inline-start" />}
              {hasUnread ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                  {badgeText}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("notifications.title")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-[13px] font-bold">
            {t("notifications.title")}
          </DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator className="mt-0" />
        {orderAlerts.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            <li className="flex items-center gap-2 px-3 pb-1 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("notifications.liveOrders.title")}
              </span>
              <Badge className="h-4.5 min-w-4.5 justify-center border-transparent bg-destructive px-1 text-[10px] text-destructive-foreground">
                {orderAlerts.length}
              </Badge>
            </li>
            {orderAlerts.map((alert) => (
              <LiveOrderAlertRow key={alert.tableUuid} alert={alert} onSelect={() => openTableOrder(alert)} />
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LiveOrderAlertRow({ alert, onSelect }: { alert: OrderAlertEntry; onSelect: () => void }) {
  const { t } = useTranslation();

  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        className="h-auto w-full items-center justify-start gap-3 rounded-none bg-muted/30 px-3 py-2.5 text-left font-normal hover:bg-muted/60"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <UtensilsCrossed className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {t("notifications.liveOrders.item", { table: alert.tableName, zone: alert.zoneName })}
        </p>
      </Button>
    </li>
  );
}
