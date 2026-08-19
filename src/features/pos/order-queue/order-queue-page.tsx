"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Check, ChefHat, Circle, CircleCheck, Clock, ListChecks, RefreshCcw, StickyNote, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable, type TableColumn } from "@/components/common/data-table";
import { LoadingState } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";
import { useOrderQueueAlerts } from "@/features/pos/order-queue/hooks/use-order-queue-alerts";
import { OrderQueueCancelDialog } from "@/features/pos/order-queue/order-queue-cancel-dialog";
import { OrderItemStatus, type OrderItemStatus as OrderItemStatusType } from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosOrderQueueStore } from "@/stores/pos-order-queue-store";
import { useToastStore } from "@/stores/toast-store";

type StepColor = "neutral" | "warning" | "primary" | "destructive";

// สีต่อ step สื่อความหมายสถานะจริง ไม่ใช้ primary ซ้ำกันทุกอันแบบเดิม — ยกเลิกต้องแดง
// (destructive) ตามที่ขอ ที่เหลือไล่จากกลาง(ใหม่) -> เหลือง(กำลังทำ) -> เขียว(เสร็จ)
const STEP_COLORS: Record<StepColor, { active: string; inactive: string; label: string }> = {
  neutral: {
    active: "border-secondary-foreground/30 bg-secondary text-secondary-foreground",
    inactive: "border-border bg-card text-muted-foreground group-hover/step:border-secondary-foreground/30",
    label: "text-secondary-foreground"
  },
  warning: {
    active: "border-warning bg-warning text-warning-foreground shadow-warning/30",
    inactive: "border-warning/45 bg-warning/10 text-warning group-hover/step:border-warning/70",
    label: "text-warning"
  },
  primary: {
    active: "border-primary bg-primary text-primary-foreground shadow-primary/30",
    inactive: "border-primary/40 bg-primary/10 text-primary group-hover/step:border-primary/70",
    label: "text-primary"
  },
  destructive: {
    active: "border-destructive bg-destructive text-destructive-foreground shadow-destructive/30",
    inactive: "border-destructive/40 bg-destructive/10 text-destructive group-hover/step:border-destructive/70",
    label: "text-destructive"
  }
};

const TABS: Array<{ status: OrderItemStatusType; labelKey: string; icon: typeof Clock; color: StepColor }> = [
  { status: OrderItemStatus.WAITING_CONFIRM, labelKey: "orderQueue.tabs.waitingConfirm", icon: Clock, color: "neutral" },
  { status: OrderItemStatus.SENT_TO_KITCHEN, labelKey: "orderQueue.tabs.sentToKitchen", icon: ChefHat, color: "warning" },
  { status: OrderItemStatus.SERVED, labelKey: "orderQueue.tabs.served", icon: CircleCheck, color: "primary" },
  { status: OrderItemStatus.CANCELLED, labelKey: "orderQueue.tabs.cancelled", icon: Ban, color: "destructive" }
];

export function OrderQueuePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);

  const status = usePosOrderQueueStore((state) => state.status);
  const items = usePosOrderQueueStore((state) => state.items);
  const total = usePosOrderQueueStore((state) => state.total);
  const loading = usePosOrderQueueStore((state) => state.loading);
  const saving = usePosOrderQueueStore((state) => state.saving);
  const setStatus = usePosOrderQueueStore((state) => state.setStatus);
  const load = usePosOrderQueueStore((state) => state.load);
  const sendToKitchen = usePosOrderQueueStore((state) => state.sendToKitchen);
  const confirmServed = usePosOrderQueueStore((state) => state.confirmServed);
  const cancelOrderItems = usePosOrderQueueStore((state) => state.cancelOrderItems);

  const branchUuid = user?.branch_uuid ?? "";
  // ทุก tab เลือกได้ ยกเว้น "ยกเลิก" ที่ไม่มี action ใดๆ ต่อได้อีกแล้ว
  const isSelectable = status !== OrderItemStatus.CANCELLED;
  const [selectedRows, setSelectedRows] = useState<OrderQueueItem[]>([]);
  // เปลี่ยนทุกครั้งที่โหลดข้อมูลใหม่ (สลับ tab / โหลดซ้ำ / action สำเร็จแล้ว reload) เพื่อ
  // บังคับ remount DataTable — DataTable เก็บ selection ไว้ภายในตัวเอง ไม่มี prop ให้ set
  // ตรงๆ ต้อง remount พร้อม defaultSelectedIds ชุดใหม่ทุกครั้งที่อยากติ๊กทุกแถวให้อัตโนมัติ
  const [resetToken, setResetToken] = useState(0);
  // ใช้ pattern "adjusting state during render" ของ React แทน useEffect — ต้อง sync
  // selectedRows ให้ตรงกับ items ทันทีที่ items เปลี่ยน reference (เลือกทุกแถวอัตโนมัติทุก
  // ครั้งที่ API โหลดเสร็จตามที่ขอ) แต่ทำใน effect จะเกิด extra render รอบเปล่าๆ เสมอ
  const [syncedItems, setSyncedItems] = useState(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    setSelectedRows(isSelectable ? items : []);
    setResetToken((token) => token + 1);
  }

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const reasonInvalid = reasonTouched && !cancelReason.trim();

  const columns = useMemo<TableColumn<OrderQueueItem>[]>(
    () => [
      {
        key: "table_name",
        label: t("orderQueue.columns.table"),
        render: (row) => (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
            {row.table_name}
          </span>
        )
      },
      {
        key: "title",
        label: t("orderQueue.columns.productName"),
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.title}</span>
            {row.toppings.length ? (
              <span className="flex flex-wrap gap-x-2 text-muted-foreground">
                {row.toppings.map((topping) => (
                  <span key={topping.prod_topping_uuid_fk} className="inline-flex items-center gap-0.5">
                    <Circle className="size-1.5 shrink-0 fill-current" />
                    {topping.topping_name} x{topping.topping_qty}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        )
      },
      {
        key: "order_qty",
        label: t("orderQueue.columns.qty"),
        align: "center",
        render: (row) => <Badge variant="secondary">{row.order_qty}</Badge>
      },
      {
        key: "order_note",
        label: t("orderQueue.columns.note"),
        render: (row) =>
          row.order_note ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <StickyNote className="size-3.5 shrink-0" />
              {row.order_note}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )
      }
    ],
    [t]
  );

  const refresh = useCallback(async () => {
    if (!branchUuid) return;
    await load({ branch_uuid_fk: branchUuid, lang: language });
  }, [branchUuid, language, load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useOrderQueueAlerts({ branchUuid, refresh });

  function handleTabChange(value: string) {
    setStatus(Number(value) as OrderItemStatusType);
    // setStatus เคลียร์ items ทันที ซึ่ง effect ข้างบนจะเคลียร์ selection/remount ให้เอง
    // แต่ refresh() มี dep แค่ branchUuid/language/load (ไม่มี status) เลยไม่รีเฟทช์เอง
    // ตอนสลับแท็บ ต้องยิงตรงนี้
    void refresh();
  }

  async function handleConfirm() {
    if (!branchUuid || !user?.uuid || !selectedRows.length) return;
    const orderUuids = Array.from(new Set(selectedRows.map((row) => row.order_uuid)));

    try {
      await sendToKitchen({ order_uuids: orderUuids, branch_uuid_fk: branchUuid, login_uuid_fk: user.uuid, lang: language });
      showToast({ title: t("orderQueue.confirmSuccess", { count: orderUuids.length }), tone: "success" });
    } catch (error) {
      showToast({
        title: t("orderQueue.confirmError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  async function handleConfirmServed() {
    if (!branchUuid || !selectedRows.length) return;
    const orderItemUuids = selectedRows.map((row) => row.order_item_uuid);

    try {
      await confirmServed({ order_item_uuids: orderItemUuids, branch_uuid_fk: branchUuid, lang: language });
      showToast({ title: t("orderQueue.confirmServedSuccess", { count: orderItemUuids.length }), tone: "success" });
    } catch (error) {
      showToast({
        title: t("orderQueue.confirmServedError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  function openCancelDialog() {
    if (!selectedRows.length) return;
    setCancelReason("");
    setReasonTouched(false);
    setCancelDialogOpen(true);
  }

  async function submitCancel() {
    setReasonTouched(true);
    const reason = cancelReason.trim();
    if (!branchUuid || !user?.uuid || !reason || !selectedRows.length || saving) return;
    const orderItemUuids = selectedRows.map((row) => row.order_item_uuid);

    try {
      await cancelOrderItems({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        login_uuid_fk: user.uuid,
        cancel_reason: reason,
        lang: language
      });
      showToast({ title: t("orderQueue.cancelSuccess", { count: orderItemUuids.length }), tone: "success" });
      setCancelDialogOpen(false);
    } catch (error) {
      showToast({
        title: t("orderQueue.cancelError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5 lg:gap-3 lg:px-5 lg:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="size-4.5" />
          </span>
          <p className="text-base font-black text-primary">{t("orderQueue.title")}</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shadow-sm" disabled={loading} onClick={() => void refresh()}>
          <RefreshCcw data-icon="inline-start" className={cn(loading && "animate-spin")} />
          {t("actions.refresh")}
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0">
        <Tabs value={String(status)} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col gap-0">
          <CardHeader className="shrink-0 border-t border-border/70 bg-muted/10 px-4 py-4 lg:px-8 lg:py-5">
            <TabsList variant="line" className="h-auto w-full items-start justify-between gap-0 bg-transparent p-0">
              {TABS.map((tab, index) => {
                const currentIndex = TABS.findIndex((item) => item.status === status);
                const isActive = status === tab.status;
                const isReached = index <= currentIndex;

                return (
                  <Fragment key={tab.status}>
                    {index > 0 ? (
                      <div
                        aria-hidden
                        className={cn("mt-6 h-0.5 flex-1 rounded-full transition-colors", isReached ? "bg-foreground/25" : "bg-border")}
                      />
                    ) : null}
                    <TabsTrigger
                      value={String(tab.status)}
                      className="group/step flex shrink-0 flex-col items-center gap-2 rounded-none border-0 bg-transparent p-0 after:hidden data-active:bg-transparent"
                    >
                      <span className="relative flex items-center justify-center">
                        <span
                          className={cn(
                            "flex size-12 items-center justify-center rounded-full border-2 shadow-sm transition-all",
                            isActive ? cn("scale-110", STEP_COLORS[tab.color].active) : STEP_COLORS[tab.color].inactive
                          )}
                        >
                          <tab.icon className="size-5" />
                        </span>
                        {isActive && total > 0 ? (
                          <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-full border-2 border-card px-1">
                            {total}
                          </Badge>
                        ) : null}
                      </span>
                      <span className={cn("text-xs font-bold", isActive ? STEP_COLORS[tab.color].label : "text-muted-foreground")}>
                        {t(tab.labelKey)}
                      </span>
                    </TabsTrigger>
                  </Fragment>
                );
              })}
            </TabsList>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 overflow-auto p-0">
            <TabsContent value={String(status)} className="m-0 h-full">
              {loading ? (
                <LoadingState variant="table" />
              ) : (
                <DataTable
                  key={resetToken}
                  rows={items}
                  columns={columns}
                  idKey="order_item_uuid"
                  selectable={isSelectable}
                  defaultSelectedIds={isSelectable ? new Set(items.map((row) => row.order_item_uuid)) : undefined}
                  onSelectionChange={setSelectedRows}
                />
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {isSelectable && selectedRows.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:sticky">
          <Badge className="bg-primary/10 text-primary">{t("common.selectedCount", { count: selectedRows.length })}</Badge>
          <div className="flex items-center gap-2">
            {status === OrderItemStatus.WAITING_CONFIRM ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" className="text-destructive" disabled>
                        <Ban data-icon="inline-start" />
                        {t("actions.cancel")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("orderQueue.cancelDisabledTooltip")}</TooltipContent>
                </Tooltip>
                <Button onClick={handleConfirm} disabled={saving}>
                  <Check data-icon="inline-start" />
                  {t("orderQueue.confirmToKitchen")}
                </Button>
              </>
            ) : null}

            {status === OrderItemStatus.SENT_TO_KITCHEN ? (
              <Button onClick={handleConfirmServed} disabled={saving}>
                <CircleCheck data-icon="inline-start" />
                {t("orderQueue.confirmServed")}
              </Button>
            ) : null}

            {status === OrderItemStatus.SERVED ? (
              <Button variant="destructive" onClick={openCancelDialog} disabled={saving}>
                <Ban data-icon="inline-start" />
                {t("actions.cancel")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <OrderQueueCancelDialog
        cancelling={saving}
        count={selectedRows.length}
        open={cancelDialogOpen}
        reason={cancelReason}
        reasonInvalid={reasonInvalid}
        onOpenChange={setCancelDialogOpen}
        onReasonBlur={() => setReasonTouched(true)}
        onReasonChange={setCancelReason}
        onSubmit={() => void submitCancel()}
      />
    </div>
  );
}
