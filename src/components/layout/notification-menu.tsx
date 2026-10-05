"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, ChevronRight, Settings2, UtensilsCrossed } from "lucide-react";
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
import { StaffWaiterPanel } from "@/features/waiter-requests/staff-waiter-panel";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { useAuthStore } from "@/stores/auth-store";
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
  const branch = useAuthStore((state) => state.user?.branch_uuid ?? "");
  const staffRequests = useWaiterRequestsStore((state) => state.staffRequests);
  const staffKey = useWaiterRequestsStore((state) => state.staffKey);
  const staffError = useWaiterRequestsStore((state) => state.staffError);
  const waiterRows = staffKey === branch ? staffRequests : [];
  const waiterCount = waiterRows.length;
  // ชื่อโต๊ะที่เรียกอยู่ (ไม่ซ้ำ) — พนักงานรู้ทันทีว่าต้องไปโต๊ะไหนโดยไม่ต้องเปิดแผงรายการ
  const waiterTables = [...new Set(waiterRows.map((row) => row.table_name_la || row.table_name_eng).filter(Boolean))];
  const [waiterOpen, setWaiterOpen] = useState(false);
  const openWaiterOnCloseRef = useRef(false);
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
  const zoneOptions = usePosStore((state) => state.zoneOptions);
  const orderAlertSound = useAppStore((state) => state.orderAlertSound);
  const waiterAlertSound = useAppStore((state) => state.waiterAlertSound);
  const soundEnabled = useAppStore((state) => state.alertSoundEnabled);
  const [soundDialogOpen, setSoundDialogOpen] = useState(false);
  // เปิด dialog ตอนดรอปดาวน์ปิดเสร็จแล้ว (onCloseAutoFocus) ไม่ใช่ใน onSelect ตรง ๆ — ดรอปดาวน์
  // คืนโฟกัสให้ปุ่มกระดิ่งตอนปิด ซึ่งอยู่นอก dialog จน dialog ถือเป็น focus-outside แล้วปิดตัวเองทันที
  const openSoundDialogOnCloseRef = useRef(false);

  // รายการนี้มาจาก customer_order_state จริงของแต่ละโต๊ะ (ผ่าน pos-store ที่
  // อัปเดตด้วย socket table_alert) — ค้างอยู่จนกว่าจะกด "ยืนยันออเดอร์" ที่หน้า
  // โต๊ะจริงเท่านั้น การเปิดดรอปดาวน์นี้ไม่ถือว่ารับทราบ
  const orderAlerts = useMemo(() => collectOrderAlerts(zoneOptions), [zoneOptions]);

  const pendingCount = orderAlerts.length + waiterCount;
  const hasUnread = pendingCount > 0;
  const badgeText = pendingCount > 9 ? "9+" : String(pendingCount);

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
            if (openWaiterOnCloseRef.current) {
              openWaiterOnCloseRef.current = false;
              event.preventDefault();
              setWaiterOpen(true);
              return;
            }
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
                {hasUnread ? t("notifications.pendingSummary", { count: pendingCount }) : t("notifications.empty")}
              </p>
            </div>
            {hasUnread ? (
              <Badge className="bg-destructive tabular-nums text-destructive-foreground">{badgeText}</Badge>
            ) : null}
          </div>
          <DropdownMenuSeparator className="my-0" />
          {hasUnread || staffError ? (
            <DropdownMenuGroup className="flex max-h-80 flex-col gap-1 overflow-y-auto p-1.5">
              {waiterCount > 0 || staffError ? (
                <DropdownMenuItem className="gap-3 px-2.5 py-2" onSelect={() => { openWaiterOnCloseRef.current = true; }}>
                  {/* ทรงเดียวกับแถวออเดอร์ (กล่องไอคอน + จุด) ให้กวาดตาอ่านเป็นรายการชุดเดียวกัน */}
                  <span className="relative grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <BellRing aria-hidden />
                    {waiterCount > 0 ? (
                      <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-popover bg-destructive" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{t("waiter.title")}</span>
                    {staffError ? (
                      <span className="truncate text-xs text-destructive">{t("waiter.failed")}</span>
                    ) : (
                      <span className="truncate text-xs text-muted-foreground">
                        {t("nav.table")} {waiterTables.join(", ")} · {t("waiter.requestCount", { count: waiterCount })}
                      </span>
                    )}
                  </span>
                  {waiterCount > 0 ? (
                    <Badge variant="secondary" className="tabular-nums">{waiterCount}</Badge>
                  ) : null}
                  <ChevronRight aria-hidden className="text-muted-foreground" />
                </DropdownMenuItem>
              ) : null}
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
                <Settings2 aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{t("notifications.sound.title")}</span>
                {/* สรุปเสียงที่ตั้งไว้ทั้งสองแบบ — เห็นค่าปัจจุบันโดยไม่ต้องเปิด dialog */}
                <span className="truncate text-xs text-muted-foreground">
                  {t("notifications.sound.kinds.order")}:{" "}
                  {soundEnabled.order ? t(`notifications.sound.options.${orderAlertSound}`) : t("notifications.sound.off")} ·{" "}
                  {t("notifications.sound.kinds.waiter")}:{" "}
                  {soundEnabled.waiter ? t(`notifications.sound.options.${waiterAlertSound}`) : t("notifications.sound.off")}
                </span>
              </span>
              <ChevronRight aria-hidden className="text-muted-foreground" />
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <StaffWaiterPanel branch={branch} open={waiterOpen} onOpenChange={setWaiterOpen} />
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
