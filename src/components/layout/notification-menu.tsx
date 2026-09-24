"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, ChevronRight, UtensilsCrossed, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectOrderAlerts, type OrderAlertEntry } from "@/lib/pos/order-alerts";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { OrderAlertSoundDialog } from "@/components/layout/order-alert-sound-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";
import { usePosStore } from "@/stores/pos-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";

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
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
  const zoneOptions = usePosStore((state) => state.zoneOptions);
  const orderAlertSound = useAppStore((state) => state.orderAlertSound);
  const [soundDialogOpen, setSoundDialogOpen] = useState(false);
  // เปิด dialog ตอนดรอปดาวน์ปิดเสร็จแล้ว (onCloseAutoFocus) ไม่ใช่ใน onSelect ตรง ๆ — ดรอปดาวน์
  // คืนโฟกัสให้ปุ่มกระดิ่งตอนปิด ซึ่งอยู่นอก dialog จน dialog ถือเป็น focus-outside แล้วปิดตัวเองทันที
  const openSoundDialogOnCloseRef = useRef(false);

  // รายการนี้มาจาก customer_order_state จริงของแต่ละโต๊ะ (ผ่าน pos-store ที่
  // อัปเดตด้วย socket table_alert) — ค้างอยู่จนกว่าจะกด "ยืนยันออเดอร์" ที่หน้า
  // โต๊ะจริงเท่านั้น การเปิดดรอปดาวน์นี้ไม่ถือว่ารับทราบ
  const orderAlerts = useMemo(() => collectOrderAlerts(zoneOptions), [zoneOptions]);

  const hasUnread = orderAlerts.length > 0;
  const badgeText = orderAlerts.length > 9 ? "9+" : String(orderAlerts.length);

  function openTableOrder(alert: OrderAlertEntry) {
    const params = new URLSearchParams({ table_uuid: alert.tableUuid, table_name: alert.tableName });
    runGuardedNavigation(() => {
      router.push(`/posAll/order?${params.toString()}`);
    });
  }

  return (
    <>
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
                  <Badge className="absolute right-2 top-2 h-4 min-w-4 justify-center bg-destructive px-1 text-2xs leading-none text-destructive-foreground sm:right-1 sm:top-1">
                    {badgeText}
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("notifications.title")}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="w-80 p-0 sm:w-88"
          onCloseAutoFocus={(event) => {
            if (!openSoundDialogOnCloseRef.current) return;
            openSoundDialogOnCloseRef.current = false;
            event.preventDefault();
            setSoundDialogOpen(true);
          }}
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <DropdownMenuLabel className="p-0 text-sm font-semibold">{t("notifications.title")}</DropdownMenuLabel>
              <p className="text-xs text-muted-foreground">
                {hasUnread ? t("notifications.pendingCount", { count: orderAlerts.length }) : t("notifications.empty")}
              </p>
            </div>
            {hasUnread ? (
              <Badge className="bg-destructive tabular-nums text-destructive-foreground">{badgeText}</Badge>
            ) : null}
          </div>
          <DropdownMenuSeparator className="my-0" />
          {hasUnread ? (
            <DropdownMenuGroup className="flex max-h-80 flex-col gap-1 overflow-y-auto p-1.5">
              {orderAlerts.map((alert) => (
                <LiveOrderAlertRow key={alert.tableUuid} alert={alert} onSelect={() => openTableOrder(alert)} />
              ))}
            </DropdownMenuGroup>
          ) : (
            <Empty className="gap-3 px-4 py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{t("notifications.empty")}</EmptyTitle>
                <EmptyDescription>{t("notifications.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <DropdownMenuSeparator className="my-0" />
          {/* dialog อยู่นอก DropdownMenu — ถ้าซ้อนข้างในจะโดน unmount ไปพร้อมเมนูที่ปิดตอน onSelect */}
          <div className="p-1.5">
            <DropdownMenuItem
              className="gap-3 px-2.5 py-2"
              onSelect={() => {
                openSoundDialogOnCloseRef.current = true;
              }}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Volume2 aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{t("notifications.sound.title")}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t(`notifications.sound.options.${orderAlertSound}`)}
                </span>
              </span>
              <ChevronRight aria-hidden className="text-muted-foreground" />
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <OrderAlertSoundDialog open={soundDialogOpen} onOpenChange={setSoundDialogOpen} />
    </>
  );
}

function LiveOrderAlertRow({ alert, onSelect }: { alert: OrderAlertEntry; onSelect: () => void }) {
  const { t } = useTranslation();

  return (
    <DropdownMenuItem className="gap-3 px-2.5 py-2" onSelect={onSelect}>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
        <UtensilsCrossed aria-hidden />
        <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-popover bg-destructive" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">
          {t("nav.table")} {alert.tableName}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {alert.zoneName} · {t("pos.tableStatusNewOrderAlert")}
        </span>
      </span>
      <ChevronRight aria-hidden className="text-muted-foreground" />
    </DropdownMenuItem>
  );
}
