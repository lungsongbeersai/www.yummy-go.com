"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Check, CircleCheck, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { useOrderQueueAlerts } from "@/features/pos/order-queue/use-order-queue-alerts";
import { OrderQueueCancelDialog } from "@/features/pos/order-queue/order-queue-cancel-dialog";
import { OrderQueueItemRow } from "@/features/pos/order-queue/order-queue-item-row";
import {
  buildOrderQueueTabs,
  canSelectQueueItem,
  queueTabFallbackKey
} from "@/features/pos/order-queue/order-queue-view";
import {
  OrderItemStatus,
  type OrderItemStatus as OrderItemStatusType
} from "@/config/pos-constants";
import type { OrderQueueItem } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosOrderQueueStore } from "@/stores/pos-order-queue-store";
import { useToastStore } from "@/stores/toast-store";

export function OrderQueuePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);

  const status = usePosOrderQueueStore((state) => state.status);
  const items = usePosOrderQueueStore((state) => state.items);
  const sections = usePosOrderQueueStore((state) => state.sections);
  const loading = usePosOrderQueueStore((state) => state.loading);
  const saving = usePosOrderQueueStore((state) => state.saving);
  const setStatus = usePosOrderQueueStore((state) => state.setStatus);
  const load = usePosOrderQueueStore((state) => state.load);
  const sendToKitchen = usePosOrderQueueStore((state) => state.sendToKitchen);
  const confirmServed = usePosOrderQueueStore((state) => state.confirmServed);
  const cancelOrderItems = usePosOrderQueueStore((state) => state.cancelOrderItems);

  const branchUuid = user?.branch_uuid ?? "";
  const isSelectable = status !== OrderItemStatus.CANCELLED && status !== OrderItemStatus.ORDERED;

  const [selectedItems, setSelectedItems] = useState<OrderQueueItem[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [cancelProgress, setCancelProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  const tabs = useMemo(() => buildOrderQueueTabs(sections), [sections]);
  const selectedIds = useMemo(
    () => new Set(selectedItems.map((item) => item.order_item_uuid)),
    [selectedItems]
  );
  const selectedTableCount = useMemo(
    () => new Set(selectedItems.map((item) => item.table_name ?? "")).size,
    [selectedItems]
  );
  const selectableItems = useMemo(
    () => items.filter((item) => canSelectQueueItem(item, status)),
    [items, status]
  );
  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.has(item.order_item_uuid));
  const oldestWait = items[0]?.open_minutes ?? 0;
  const reasonInvalid = reasonTouched && !cancelReason.trim();

  const refresh = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await load({
        branch_uuid_fk: branchUuid,
        lang: language
      });
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

  useOrderQueueAlerts({
    branchUuid,
    refresh
  });

  useEffect(() => {
    setSelectedItems((current) =>
      current.filter((selected) =>
        items.some((item) => item.order_item_uuid === selected.order_item_uuid)
      )
    );
  }, [items]);

  function toggleItem(item: OrderQueueItem, checked: boolean) {
    if (!canSelectQueueItem(item, status)) return;

    setSelectedItems((prev) => {
      const without = prev.filter(
        (selected) => selected.order_item_uuid !== item.order_item_uuid
      );
      if (!checked) return without;
      return [...without, item];
    });
  }

  function toggleAllItems(checked: boolean) {
    setSelectedItems(checked ? selectableItems : []);
  }

  async function handleTabChange(value: string) {
    const nextStatus = Number(value) as OrderItemStatusType;
    setSelectedItems([]);
    setStatus(nextStatus);

    try {
      if (!branchUuid) return;
      await load({
        branch_uuid_fk: branchUuid,
        lang: language
      });
    } catch (error) {
      showToast({
        title: t("orderQueue.loadError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  async function handleConfirm() {
    if (!branchUuid || !user?.uuid || !selectedItems.length) return;

    const orderItemUuids = selectedItems.map((item) => item.order_item_uuid);

    try {
      await sendToKitchen({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        login_uuid_fk: user.uuid,
        lang: language
      });
      setSelectedItems([]);
      showToast({
        title: t("orderQueue.confirmSuccess", { count: orderItemUuids.length }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("orderQueue.confirmError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  async function handleConfirmServed() {
    if (!branchUuid || !selectedItems.length) return;

    const orderItemUuids = selectedItems.map((item) => item.order_item_uuid);

    try {
      await confirmServed({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        lang: language
      });
      setSelectedItems([]);
      showToast({
        title: t("orderQueue.confirmServedSuccess", { count: orderItemUuids.length }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("orderQueue.confirmServedError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    }
  }

  function openCancelDialog() {
    if (!selectedItems.length) return;
    setCancelReason("");
    setReasonTouched(false);
    setCancelDialogOpen(true);
  }

  async function submitCancel() {
    setReasonTouched(true);
    const reason = cancelReason.trim();

    if (!branchUuid || !user?.uuid || !reason || !selectedItems.length || saving) return;

    const orderItemUuids = selectedItems.map((item) => item.order_item_uuid);
    setCancelDialogOpen(false);
    setCancelProgress({ completed: 0, total: orderItemUuids.length });

    try {
      await cancelOrderItems({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        login_uuid_fk: user.uuid,
        cancel_reason: reason,
        lang: language,
        onProgress: (completed, totalProgress) =>
          setCancelProgress({ completed, total: totalProgress })
      });
      setSelectedItems([]);
      showToast({
        title: t("orderQueue.cancelSuccess", { count: orderItemUuids.length }),
        tone: "success"
      });
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

  const visibleTabs = tabs.length
    ? tabs
    : [
        { status: OrderItemStatus.WAITING_CONFIRM, title: t("orderQueue.tabs.waitingConfirm"), total: 0 }
      ];

  const headerChecked = allSelectableSelected
    ? true
    : selectedItems.length > 0
      ? "indeterminate"
      : false;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none ring-0">
      <CardHeader className="shrink-0 border-b">
        <CardTitle>{t("orderQueue.title")}</CardTitle>
        <CardDescription>{t("orderQueue.subtitle")}</CardDescription>
        <CardAction>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCcw data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
        </CardAction>
      </CardHeader>

      <Tabs
        value={String(status)}
        onValueChange={(value) => void handleTabChange(value)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 overflow-x-auto px-(--card-spacing)">
          <TabsList variant="line">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.status} value={String(tab.status)}>
                {tab.title || t(queueTabFallbackKey(tab.status))}
                <Badge variant={status === tab.status ? "default" : "secondary"}>
                  {tab.total}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <CardContent className="min-h-0 flex-1 overflow-auto">
          {visibleTabs.map((tab) => (
            <TabsContent key={tab.status} value={String(tab.status)}>
              {loading ? (
                <LoadingState variant="table" />
              ) : items.length === 0 ? (
                <EmptyState
                  title={t("orderQueue.emptyTitle")}
                  description={t("orderQueue.emptyDescription", {
                    tab: tab.title || t(queueTabFallbackKey(status))
                  })}
                />
              ) : (
                <div className="flex flex-col gap-3 pb-4">
                  <CardDescription>
                    {t("orderQueue.queueHint", {
                      count: items.length,
                      minutes: oldestWait
                    })}
                  </CardDescription>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          {isSelectable && selectableItems.length > 0 ? (
                            <Checkbox
                              aria-label={t("common.selectAll")}
                              checked={headerChecked}
                              onCheckedChange={(checked) =>
                                toggleAllItems(checked === true)
                              }
                            />
                          ) : null}
                        </TableHead>
                        <TableHead>{t("common.order")}</TableHead>
                        <TableHead>{t("orderQueue.wait")}</TableHead>
                        <TableHead>{t("pos.table")}</TableHead>
                        <TableHead>{t("pos.product")}</TableHead>
                        <TableHead>{t("pos.qty")}</TableHead>
                        <TableHead>{t("orderQueue.orderNumber")}</TableHead>
                        <TableHead>{t("orderQueue.arrived")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <OrderQueueItemRow
                          key={item.order_item_uuid}
                          item={item}
                          position={index + 1}
                          status={status}
                          selected={selectedIds.has(item.order_item_uuid)}
                          selectable={
                            isSelectable && canSelectQueueItem(item, status)
                          }
                          onToggle={(checked) => toggleItem(item, checked)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </CardContent>
      </Tabs>

      {isSelectable && selectedItems.length > 0 ? (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
          <Badge variant="secondary">
            {selectedTableCount > 1
              ? t("orderQueue.selectedAcrossTables", {
                  count: selectedItems.length,
                  tables: selectedTableCount
                })
              : t("common.selectedCount", { count: selectedItems.length })}
          </Badge>

          <div className="flex items-center gap-2">
            {status === OrderItemStatus.WAITING_CONFIRM ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" disabled>
                        <Ban data-icon="inline-start" />
                        {t("actions.cancel")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("orderQueue.cancelDisabledTooltip")}</TooltipContent>
                </Tooltip>
                <Button onClick={() => void handleConfirm()} disabled={saving}>
                  <Check data-icon="inline-start" />
                  {t("orderQueue.confirmToKitchen")}
                </Button>
              </>
            ) : null}

            {status === OrderItemStatus.SENT_TO_KITCHEN ? (
              <Button onClick={() => void handleConfirmServed()} disabled={saving}>
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
        </CardFooter>
      ) : null}

      <OrderQueueCancelDialog
        cancelling={saving}
        count={selectedItems.length}
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
            ? t("orderQueue.cancelProgressDetail", {
                completed: cancelProgress.completed,
                total: cancelProgress.total
              })
            : undefined
        }
        open={Boolean(cancelProgress)}
        progressLabel={
          cancelProgress
            ? t("orderQueue.cancelProgressDetail", {
                completed: cancelProgress.completed,
                total: cancelProgress.total
              })
            : undefined
        }
        progressValue={
          cancelProgress
            ? Math.round(
                (cancelProgress.completed / Math.max(cancelProgress.total, 1)) * 100
              )
            : null
        }
        title={t("orderQueue.cancelDialogTitle")}
      />
    </Card>
  );
}
