"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Ban, Check, ChefHat, CircleCheck, Clock, ListChecks, RefreshCcw, StickyNote, Table2, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";
import { useOrderQueueAlerts } from "@/features/pos/order-queue/use-order-queue-alerts";
import { OrderQueueCancelDialog } from "@/features/pos/order-queue/order-queue-cancel-dialog";
import { groupOrderQueueRows, resolveProductMedia, type OrderQueueGroup } from "@/features/pos/order-queue/order-queue-view";
import { OrderItemStatus, type OrderItemStatus as OrderItemStatusType } from "@/config/pos-constants";
import type { OrderQueueRow } from "@/services/pos";
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

// backend ส่ง can_send_to_kitchen/can_confirm_served มาต่อแถว (เช่นรายการที่ถูกส่งเข้า
// คิวพิมพ์ครัวไปแล้วแต่ order_item_status ยังไม่เปลี่ยนจะได้ can_send_to_kitchen: false) ต้อง
// ใช้ gate การเลือกแถว/bulk action ไม่งั้นกดซ้ำแล้วโดน backend reject บางแถว — ฝั่ง "เสิร์ฟแล้ว"
// ไม่มี flag ยกเลิกมาให้ต่อแถว จึงเลือกได้ทุกแถวเหมือนเดิม
function canSelectQueueItem(row: OrderQueueRow, status: OrderItemStatusType): boolean {
  if (status === OrderItemStatus.WAITING_CONFIRM) return row.can_send_to_kitchen;
  if (status === OrderItemStatus.SENT_TO_KITCHEN) return row.can_confirm_served;
  return status === OrderItemStatus.SERVED;
}

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
  const [selectedRows, setSelectedRows] = useState<OrderQueueRow[]>([]);
  // ใช้ pattern "adjusting state during render" ของ React แทน useEffect — ต้อง sync
  // selectedRows ให้ตรงกับ items ทันทีที่ items เปลี่ยน reference (เลือกทุกแถวที่เลือกได้
  // อัตโนมัติทุกครั้งที่ API โหลดเสร็จตามที่ขอ) แต่ทำใน effect จะเกิด extra render รอบเปล่าๆ เสมอ
  const [syncedItems, setSyncedItems] = useState(items);
  if (items !== syncedItems) {
    setSyncedItems(items);
    setSelectedRows(isSelectable ? items.filter((row) => canSelectQueueItem(row, status)) : []);
  }

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const reasonInvalid = reasonTouched && !cancelReason.trim();
  // ยกเลิกทีละรายการ (ดู cancelOrderItems ใน pos-order-queue-store.ts) — ใช้ progress นี้แสดง
  // BlockingLoadingDialog ระหว่างประมวลผล แทนที่จะรอเงียบ ๆ จนกว่าทุกรายการจะยกเลิกเสร็จ
  const [cancelProgress, setCancelProgress] = useState<{ completed: number; total: number } | null>(null);

  const groups = useMemo(() => groupOrderQueueRows(items), [items]);
  const selectedIds = useMemo(() => new Set(selectedRows.map((row) => row.order_item_uuid)), [selectedRows]);
  const selectedTableCount = useMemo(
    () => new Set(selectedRows.map((row) => row.table_name ?? "")).size,
    [selectedRows]
  );

  function toggleRow(row: OrderQueueRow) {
    setSelectedRows((prev) =>
      prev.some((item) => item.order_item_uuid === row.order_item_uuid)
        ? prev.filter((item) => item.order_item_uuid !== row.order_item_uuid)
        : [...prev, row]
    );
  }

  function toggleGroup(group: OrderQueueGroup) {
    const selectableRows = group.rows.filter((row) => canSelectQueueItem(row, status));
    if (!selectableRows.length) return;
    const allSelected = selectableRows.every((row) => selectedIds.has(row.order_item_uuid));

    setSelectedRows((prev) => {
      const selectableRowIds = new Set(selectableRows.map((row) => row.order_item_uuid));
      if (allSelected) return prev.filter((row) => !selectableRowIds.has(row.order_item_uuid));
      const prevIds = new Set(prev.map((row) => row.order_item_uuid));
      return [...prev, ...selectableRows.filter((row) => !prevIds.has(row.order_item_uuid))];
    });
  }

  const refresh = useCallback(async () => {
    if (!branchUuid) return;
    try {
      await load({ branch_uuid_fk: branchUuid, lang: language });
    } catch (error) {
      showToast({
        title: t("orderQueue.loadError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }, [branchUuid, language, load, showToast, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useOrderQueueAlerts({ branchUuid, refresh });

  function handleTabChange(value: string) {
    setStatus(Number(value) as OrderItemStatusType);
    // setStatus เคลียร์ items ทันที ซึ่ง effect ข้างบนจะเคลียร์ selection ให้เอง
    // แต่ refresh() มี dep แค่ branchUuid/language/load (ไม่มี status) เลยไม่รีเฟทช์เอง
    // ตอนสลับแท็บ ต้องยิงตรงนี้
    void refresh();
  }

  async function handleConfirm() {
    if (!branchUuid || !user?.uuid || !selectedRows.length) return;
    const orderItemUuids = selectedRows.map((row) => row.order_item_uuid);

    try {
      await sendToKitchen({ order_item_uuids: orderItemUuids, branch_uuid_fk: branchUuid, login_uuid_fk: user.uuid, lang: language });
      showToast({ title: t("orderQueue.confirmSuccess", { count: orderItemUuids.length }), tone: "success" });
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

    setCancelDialogOpen(false);
    setCancelProgress({ completed: 0, total: orderItemUuids.length });
    try {
      await cancelOrderItems({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        login_uuid_fk: user.uuid,
        cancel_reason: reason,
        lang: language,
        onProgress: (completed, total) => setCancelProgress({ completed, total })
      });
      showToast({ title: t("orderQueue.cancelSuccess", { count: orderItemUuids.length }), tone: "success" });
    } catch (error) {
      showToast({
        title: t("orderQueue.cancelError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    } finally {
      setCancelProgress(null);
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
            <TabsList variant="line" className="h-auto w-full items-start justify-between gap-0 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
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
                <LoadingState variant="posGrid" />
              ) : groups.length === 0 ? (
                <EmptyState title={t("orderQueue.emptyTitle")} description={t("orderQueue.emptyDescription", { tab: t(TABS.find((tab) => tab.status === status)?.labelKey ?? "") })} />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-3 p-4 pb-24 lg:gap-4 lg:p-5">
                  {groups.map((group) => (
                    <OrderQueueGroupCard
                      key={group.order_uuid}
                      group={group}
                      isSelectable={isSelectable}
                      selectedIds={selectedIds}
                      status={status}
                      onToggleGroup={toggleGroup}
                      onToggleRow={toggleRow}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {isSelectable && selectedRows.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:sticky">
          <Badge className="bg-primary/10 text-primary">
            {selectedTableCount > 1
              ? t("orderQueue.selectedAcrossTables", { count: selectedRows.length, tables: selectedTableCount })
              : t("common.selectedCount", { count: selectedRows.length })}
          </Badge>
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

      <BlockingLoadingDialog
        description={
          cancelProgress
            ? t("orderQueue.cancelProgressDetail", { completed: cancelProgress.completed, total: cancelProgress.total })
            : undefined
        }
        open={Boolean(cancelProgress)}
        progressLabel={
          cancelProgress
            ? t("orderQueue.cancelProgressDetail", { completed: cancelProgress.completed, total: cancelProgress.total })
            : undefined
        }
        progressValue={cancelProgress ? Math.round((cancelProgress.completed / Math.max(cancelProgress.total, 1)) * 100) : null}
        title={t("orderQueue.cancelDialogTitle")}
      />
    </div>
  );
}

function OrderQueueGroupCard({
  group,
  isSelectable,
  selectedIds,
  status,
  onToggleGroup,
  onToggleRow
}: {
  group: OrderQueueGroup;
  isSelectable: boolean;
  selectedIds: Set<string>;
  status: OrderItemStatusType;
  onToggleGroup: (group: OrderQueueGroup) => void;
  onToggleRow: (row: OrderQueueRow) => void;
}) {
  const { t } = useTranslation();
  const tableLabel = group.table_name ?? t("orderQueue.noTable");
  const selectableRows = useMemo(
    () => group.rows.filter((row) => canSelectQueueItem(row, status)),
    [group.rows, status]
  );
  const selectedCount = selectableRows.filter((row) => selectedIds.has(row.order_item_uuid)).length;
  const groupCheckState: boolean | "indeterminate" =
    selectableRows.length === 0 || selectedCount === 0
      ? false
      : selectedCount === selectableRows.length
        ? true
        : "indeterminate";

  return (
    <Card className="flex flex-col gap-0 overflow-hidden rounded-xl border-border bg-card p-0 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {isSelectable && selectableRows.length > 0 ? (
            <Checkbox
              aria-label={t("orderQueue.groupSelectAria", { table: tableLabel })}
              checked={groupCheckState}
              onCheckedChange={() => onToggleGroup(group)}
              className="size-5 shrink-0"
            />
          ) : null}
          <Table2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-foreground">{tableLabel}</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{group.order_invoice}</p>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {t("orderQueue.itemCount", { count: group.rows.length })}
        </Badge>
      </div>

      <div className="divide-y divide-border/60">
        {group.rows.map((row) => (
          <OrderQueueItemRow
            key={row.order_item_uuid}
            row={row}
            selectable={isSelectable && canSelectQueueItem(row, status)}
            showCheckboxSlot={isSelectable}
            selected={selectedIds.has(row.order_item_uuid)}
            onToggle={() => onToggleRow(row)}
          />
        ))}
      </div>
    </Card>
  );
}

function OrderQueueItemRow({
  onToggle,
  row,
  selectable,
  selected,
  showCheckboxSlot
}: {
  onToggle: () => void;
  row: OrderQueueRow;
  selectable: boolean;
  selected: boolean;
  showCheckboxSlot: boolean;
}) {
  const checkboxId = `order-queue-item-${row.order_item_uuid}`;
  const content = (
    <>
      <OrderQueueItemMedia image={row.product_image} name={row.product_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{row.product_name}</p>
        {row.note ? (
          <p className="mt-0.5 inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <StickyNote className="size-3 shrink-0" />
            <span className="truncate">{row.note}</span>
          </p>
        ) : null}
      </div>
      <Badge variant="secondary" className="shrink-0">
        {row.qty}
      </Badge>
    </>
  );

  if (selectable) {
    return (
      <FieldLabel
        htmlFor={checkboxId}
        className="min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
      >
        <Checkbox id={checkboxId} checked={selected} onCheckedChange={onToggle} className="size-5 shrink-0" />
        {content}
      </FieldLabel>
    );
  }

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      {showCheckboxSlot ? <span aria-hidden="true" className="size-5 shrink-0" /> : null}
      {content}
    </div>
  );
}

function OrderQueueItemMedia({ image, name }: { image: string; name: string }) {
  const media = resolveProductMedia(image);

  if (media.type === "image") {
    return (
      <span className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        <Image src={media.src} alt={name} fill sizes="40px" className="object-cover" />
      </span>
    );
  }

  if (media.type === "color") {
    return (
      <span
        aria-hidden="true"
        className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60"
        style={{ backgroundColor: media.color }}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-black/25 text-white shadow-sm backdrop-blur-[1px]">
          <Utensils className="size-3.5" />
        </span>
      </span>
    );
  }

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
      <Utensils className="size-4" />
    </span>
  );
}
