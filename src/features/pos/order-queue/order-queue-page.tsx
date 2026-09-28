"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, ChefHat, Clock, Inbox, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { LoadingState } from "@/components/common/loading-state";
import { useIsNativeShellActive } from "@/hooks/use-native-shell-active";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { useOrderQueueAlerts } from "@/features/pos/order-queue/use-order-queue-alerts";
import { OrderQueueCancelDialog } from "@/features/pos/order-queue/order-queue-cancel-dialog";
import { OrderQueueTableRow } from "@/features/pos/order-queue/order-queue-items";
import { OrderQueueStatusTabs } from "@/features/pos/order-queue/order-queue-status-tabs";
import { OrderQueueSummaryBar } from "@/features/pos/order-queue/order-queue-summary-bar";
import {
  OrderQueueTableBody,
  OrderQueueTableHead,
  useOrderQueueTableScrollSync
} from "@/features/pos/order-queue/order-queue-table-frame";
import { OrderQueueTicketBoard } from "@/features/pos/order-queue/order-queue-ticket-board";
import { manageQueueUrgencyTier } from "@/features/pos/order-queue/order-queue-urgency";
import {
  buildOrderQueueTabs,
  canSelectQueueItem,
  displayWaitMinutes,
  formatQueueWait,
  liveWaitMinutes,
  queueTabFallbackKey,
  summarizeQueue,
  type OrderQueueRow,
  type QueueItemAction,
  type QueueListView
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

// เวลารอเดินเองฝั่ง client ไม่ต้องยิง API ซ้ำ — 30 วิพอให้ตัวเลขนาทีไม่ค้าง
// โดยไม่ทำให้ re-render ถี่จนกินแรงเครื่องบนจอครัวที่เปิดค้างทั้งวัน
const QUEUE_TICK_MS = 30_000;

type QueueLoadingAction = {
  count: number;
  kind: "send" | "serve";
};

function useMinutesSinceLoad(loadedAt: number) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), QUEUE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!now || !loadedAt) return 0;
  return Math.max(0, Math.floor((now - loadedAt) / 60_000));
}

export function OrderQueuePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const isMobile = useIsMobile();
  const nativeShellActive = useIsNativeShellActive();
  const setHeaderRefreshAction = useNativeHeaderStore((state) => state.setRefreshAction);

  const status = usePosOrderQueueStore((state) => state.status);
  const items = usePosOrderQueueStore((state) => state.items);
  const sections = usePosOrderQueueStore((state) => state.sections);
  const loadedAt = usePosOrderQueueStore((state) => state.loadedAt);
  const loading = usePosOrderQueueStore((state) => state.loading);
  const saving = usePosOrderQueueStore((state) => state.saving);
  const setStatus = usePosOrderQueueStore((state) => state.setStatus);
  const load = usePosOrderQueueStore((state) => state.load);
  const sendToKitchen = usePosOrderQueueStore((state) => state.sendToKitchen);
  const confirmServed = usePosOrderQueueStore((state) => state.confirmServed);
  const cancelOrderItems = usePosOrderQueueStore((state) => state.cancelOrderItems);

  const branchUuid = user?.branch_uuid ?? "";
  const isSelectable =
    status !== OrderItemStatus.CANCELLED && status !== OrderItemStatus.ORDERED;
  const { headRef, handleBodyScroll } = useOrderQueueTableScrollSync();

  // เก็บแค่ uuid แล้ว derive ตัวรายการจาก items ตอน render — รายการที่หลุดจากคิวไปแล้ว
  // (ถูกส่งครัว/ยกเลิก) จะหายจาก selection เองโดยไม่ต้องมี effect คอยไล่ prune
  const [selectedUuids, setSelectedUuids] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [actingUuid, setActingUuid] = useState("");
  // ค่าที่ผู้ใช้เลือกเองต้องชนะเสมอ ส่วนค่าเริ่มต้นเดาจากขนาดจอ (มือถือ = การ์ด)
  // เก็บเป็น null แทนการ sync state กับ isMobile ผ่าน effect
  const [viewOverride, setViewOverride] = useState<QueueListView | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [cancelProgress, setCancelProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [loadingAction, setLoadingAction] =
    useState<QueueLoadingAction | null>(null);

  // isMobile ต้องชนะ viewOverride เสมอ ไม่ใช่แค่ค่า fallback — ปุ่มสลับมุมมองถูกซ่อนแล้ว
  // ตอนจอแคบกว่า md แต่ viewOverride เป็น state ที่ค้างอยู่ได้ (เช่น กดปุ่ม "ตาราง" ไว้ตอน
  // จอกว้าง แล้วย่อ/หมุนจอแคบลงโดยไม่รีโหลดหน้า) ถ้ายังปล่อยให้ viewOverride ชนะ ตารางคอลัมน์
  // คงที่ 9 คอลัมน์จะโผล่มาบนจอโทรศัพท์ทั้งที่ควบคุมปิดการเข้าถึงไว้แล้ว
  // ค่าเริ่มต้นคือมุมมองตามโต๊ะทุกขนาดจอ — ตารางยังเลือกได้บนจอกว้างสำหรับคนที่ต้องกวาด
  // รายการจำนวนมากแบบแน่น ๆ
  const view: QueueListView = isMobile ? "card" : (viewOverride ?? "card");
  const minutesSinceLoad = useMinutesSinceLoad(loadedAt);

  const tabs = useMemo(() => buildOrderQueueTabs(sections), [sections]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedUuids.has(item.order_item_uuid)),
    [items, selectedUuids]
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
    selectableItems.every((item) => selectedUuids.has(item.order_item_uuid));
  const rows: OrderQueueRow[] = items.map((item, index) => ({
    item,
    position: index + 1,
    waitMinutes: displayWaitMinutes(item.open_minutes, minutesSinceLoad, status),
    selected: selectedUuids.has(item.order_item_uuid),
    selectable: isSelectable && canSelectQueueItem(item, status),
    acting: actingUuid === item.order_item_uuid
  }));
  // เรียงตามเวลายืนยัน ไม่ได้เรียงตามเวลารอ — summarizeQueue หาค่าสูงสุดจากทุกแถวเอง
  const summary = summarizeQueue(rows, status);
  // แท็บรอยืนยันส่งครัวเท่านั้น — ออเดอร์ที่ค้าง 15+ นาทีล็อกปุ่ม action ของออเดอร์อื่น
  // ทั้งหมด (รวมปุ่มกลุ่มด้านล่าง) จนกว่าจะกดส่งครัวใบนี้ก่อน
  const lockedOrderItemUuid =
    status === OrderItemStatus.WAITING_CONFIRM
      ? items.reduce<string | null>((lockedUuid, item) => {
          const wait = liveWaitMinutes(item.open_minutes, minutesSinceLoad);
          if (wait < 15) return lockedUuid;
          if (!lockedUuid) return item.order_item_uuid;
          const lockedWait = liveWaitMinutes(
            items.find((candidate) => candidate.order_item_uuid === lockedUuid)
              ?.open_minutes ?? 0,
            minutesSinceLoad
          );
          return wait > lockedWait ? item.order_item_uuid : lockedUuid;
        }, null)
      : null;
  // ยกเลิกไม่ถูกล็อก (ไม่ใช่การส่งออเดอร์ใหม่เข้าครัว) — ล็อกเฉพาะปุ่ม "ยืนยันส่งครัว"
  // รวมของด้านล่าง เว้นแต่สิ่งที่เลือกไว้คือออเดอร์ที่ค้างอยู่ใบนั้นเป๊ะ ๆ (ใช้ปุ่มนี้เพื่อ
  // acknowledge มันได้)
  const lockedItem = lockedOrderItemUuid
    ? items.find((item) => item.order_item_uuid === lockedOrderItemUuid)
    : undefined;
  const bulkSendLocked =
    Boolean(lockedOrderItemUuid) &&
    !(selectedItems.length === 1 && selectedItems[0].order_item_uuid === lockedOrderItemUuid);
  const bulkSendLockedReason = lockedItem
    ? t("orderQueue.lockedActionDisabled", {
        table: lockedItem.table_name || t("orderQueue.noTable"),
        wait: formatQueueWait(liveWaitMinutes(lockedItem.open_minutes, minutesSinceLoad), t)
      })
    : undefined;
  const activeTab = tabs.find((tab) => tab.status === status);
  const activeTabTitle = activeTab?.title || t(queueTabFallbackKey(status));
  const reasonInvalid = reasonTouched && !cancelReason.trim();
  const busy = saving || Boolean(actingUuid) || Boolean(loadingAction);
  const showBulkActionBar =
    isSelectable &&
    selectableItems.length > 0 &&
    (!isMobile || selectedItems.length > 0);

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

  // ปุ่มรีเฟรชในหัวข้อหน้าซ้ำกับที่ลงทะเบียนเข้า NativeTopBar ได้แล้วบน Capacitor
  // (ตามแพทเทิร์นเดียวกับหน้า table-selection/order-customer) — เว็บยังใช้ปุ่มในหน้าเดิม
  useEffect(() => {
    if (!nativeShellActive) return;
    setHeaderRefreshAction({ loading, onClick: () => void refresh() });
    return () => setHeaderRefreshAction(null);
  }, [nativeShellActive, loading, refresh, setHeaderRefreshAction]);

  useOrderQueueAlerts({
    branchUuid,
    refresh
  });

  function clearSelection() {
    setSelectedUuids(new Set());
  }

  function toggleItem(item: OrderQueueItem, checked: boolean) {
    if (!canSelectQueueItem(item, status)) return;

    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (checked) next.add(item.order_item_uuid);
      else next.delete(item.order_item_uuid);
      return next;
    });
  }

  // เลือก/เลิกเลือกทั้งใบของโต๊ะเดียว — ไม่แตะรายการของโต๊ะอื่นที่เลือกค้างไว้
  function toggleManyItems(targets: OrderQueueItem[], checked: boolean) {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      for (const item of targets) {
        if (!canSelectQueueItem(item, status)) continue;
        if (checked) next.add(item.order_item_uuid);
        else next.delete(item.order_item_uuid);
      }
      return next;
    });
  }

  function toggleAllItems(checked: boolean) {
    setSelectedUuids(
      checked
        ? new Set(selectableItems.map((item) => item.order_item_uuid))
        : new Set()
    );
  }

  async function handleTabChange(value: string) {
    const nextStatus = Number(value) as OrderItemStatusType;
    clearSelection();
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

  async function runSendToKitchen(orderItemUuids: string[]) {
    if (
      !branchUuid ||
      !user?.uuid ||
      !orderItemUuids.length ||
      loadingAction
    ) return;

    setLoadingAction({ count: orderItemUuids.length, kind: "send" });
    try {
      const printResult = await sendToKitchen({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        login_uuid_fk: user.uuid,
        lang: language
      });

      const printFailed = Number(printResult?.failedCount || 0) > 0;
      const printPending = printResult?.pending === true;
      // Backend has already committed status 1 -> 2 after creating the durable
      // print job. A SHARED printer can still be pending on its owner device,
      // but these rows no longer belong to the status-1 selection.
      clearSelection();
      showToast({
        title: printFailed
          ? t("orderQueue.confirmError")
          : printPending
            ? t("orderQueue.kitchenPrintQueued")
            : t("orderQueue.confirmSuccess", { count: orderItemUuids.length }),
        description: printFailed
          ? [t("report.printFailed"), printResult?.errorMessage]
              .filter(Boolean)
              .join(" — ")
          : undefined,
        tone: printFailed ? "warning" : printPending ? "info" : "success"
      });
    } catch (error) {
      showToast({
        title: t("orderQueue.confirmError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function runConfirmServed(orderItemUuids: string[]) {
    if (!branchUuid || !orderItemUuids.length || loadingAction) return;

    setLoadingAction({ count: orderItemUuids.length, kind: "serve" });
    try {
      await confirmServed({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        lang: language
      });
      clearSelection();
      showToast({
        title: t("orderQueue.confirmServedSuccess", {
          count: orderItemUuids.length
        }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("orderQueue.confirmServedError"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error"
      });
    } finally {
      setLoadingAction(null);
    }
  }

  // ปุ่มบนรายการเดียว — ยิง action ทันทีโดยไม่ต้องติ๊ก checkbox ก่อน
  async function handleItemAction(item: OrderQueueItem, action: QueueItemAction) {
    if (busy) return;
    setActingUuid(item.order_item_uuid);

    try {
      if (action === "send") {
        await runSendToKitchen([item.order_item_uuid]);
        return;
      }
      await runConfirmServed([item.order_item_uuid]);
    } finally {
      setActingUuid("");
    }
  }

  function openCancelDialog() {
    if (!selectedItems.length) return;
    setCancelReason("");
    setReasonTouched(false);
    setCancelDialogOpen(true);
  }

  // ปุ่ม cancel บนรายการเดียวในลิสต์ — เลือกแค่ใบนี้ใบเดียวแล้วเปิด dialog ทันที ใช้ flow
  // ขอเหตุผล + cancelOrderItems เดียวกับการยกเลิกแบบติ๊กเลือกหลายใบทุกอย่าง ไม่มี API แยก
  function openCancelDialogForItem(item: OrderQueueItem) {
    setSelectedUuids(new Set([item.order_item_uuid]));
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
      clearSelection();
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
        {
          status: OrderItemStatus.WAITING_CONFIRM,
          title: t("orderQueue.tabs.waitingConfirm"),
          total: 0
        }
      ];

  const headerChecked = allSelectableSelected
    ? true
    : selectedItems.length > 0
      ? "indeterminate"
      : false;

  const lockedActing = lockedItem ? actingUuid === lockedItem.order_item_uuid : false;

  function renderList() {
    if (loading) return <LoadingState variant={view === "card" ? "grid" : "table"} />;

    if (!rows.length) {
      return (
        <Empty className="min-h-64 flex-1 border border-dashed border-border bg-muted/25">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>{t("orderQueue.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("orderQueue.emptyDescription", { tab: activeTabTitle })}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    if (view === "card") {
      return (
        <OrderQueueTicketBoard
          rows={rows}
          status={status}
          lockedOrderItemUuid={lockedOrderItemUuid}
          lockedReason={bulkSendLockedReason}
          onToggle={toggleItem}
          onToggleMany={toggleManyItems}
          onAction={(item, action) => void handleItemAction(item, action)}
          onCancel={openCancelDialogForItem}
        />
      );
    }

    const isManage = status === OrderItemStatus.WAITING_CONFIRM;

    return (
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0 py-0">
        <OrderQueueTableHead
          headerChecked={headerChecked}
          showCheckbox={isSelectable && selectableItems.length > 0}
          onToggleAll={toggleAllItems}
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
              status={status}
              waitMinutes={row.waitMinutes}
              manageUrgency={isManage ? manageQueueUrgencyTier(row.waitMinutes) : undefined}
              lockedReason={
                lockedOrderItemUuid && row.item.order_item_uuid !== lockedOrderItemUuid
                  ? bulkSendLockedReason
                  : undefined
              }
              onAction={(action) => void handleItemAction(row.item, action)}
              onCancel={() => openCancelDialogForItem(row.item)}
              onToggle={(checked) => toggleItem(row.item, checked)}
            />
          ))}
        </OrderQueueTableBody>
      </Card>
    );
  }

  return (
    // /order_manage เป็น fixed data screen (app-shell ไม่ใส่ padding ให้) — กันขอบเองที่นี่
    // พื้น muted อ่อนแบบเดียวกับ sales-list ให้ใบโต๊ะสีขาวแยกจากพื้นหลังชัด
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-muted/20 p-3 sm:p-4 lg:p-5">
      <Tabs
        value={String(status)}
        onValueChange={(value) => void handleTabChange(value)}
        className="min-h-0 flex-1 gap-3"
      >
        <OrderQueueStatusTabs tabs={visibleTabs} status={status} />

        <OrderQueueSummaryBar
          summary={summary}
          loadedAt={loadedAt}
          view={view}
          showViewToggle={!isMobile}
          showRefresh={!nativeShellActive}
          loading={loading}
          // มุมมองตารางมี checkbox เลือกทั้งหมดที่หัวตารางอยู่แล้ว
          selectAll={
            view === "card" && isSelectable && selectableItems.length > 0
              ? { checked: headerChecked, onChange: toggleAllItems }
              : null
          }
          onViewChange={setViewOverride}
          onRefresh={() => void refresh()}
        />

        {/* ย้ายขึ้นมาระดับหน้า (เดิมอยู่ใน manage panel ของมุมมองตารางเท่านั้น มุมมองการ์ด
            ไม่เห็นแบนเนอร์เลยทั้งที่ปุ่มถูกล็อกเหมือนกัน) */}
        {lockedItem && !loading ? (
          <Alert variant="destructive" className="shrink-0 items-center py-2 pr-36 sm:pr-40">
            <Clock />
            <AlertTitle>{t("orderQueue.lockedBannerTitle")}</AlertTitle>
            <AlertDescription>
              {t("orderQueue.lockedBannerDescription", {
                table: lockedItem.table_name || t("orderQueue.noTable"),
                wait: formatQueueWait(liveWaitMinutes(lockedItem.open_minutes, minutesSinceLoad), t)
              })}
            </AlertDescription>
            <AlertAction>
              {/* ข้อความจริงคู่ไอคอน ไม่ใช่ไอคอน+tooltip — จอสัมผัสไม่มี hover ให้เห็น tooltip */}
              <Button
                type="button"
                size="sm"
                className="h-8 font-black"
                disabled={lockedActing || busy}
                onClick={() => void handleItemAction(lockedItem, "send")}
              >
                {lockedActing ? <Spinner data-icon="inline-start" /> : <ChefHat data-icon="inline-start" />}
                {t("orderQueue.sendToKitchen")}
              </Button>
            </AlertAction>
          </Alert>
        ) : null}

        {visibleTabs.map((tab) => (
          <TabsContent
            key={tab.status}
            value={String(tab.status)}
            className={cn(
              "flex min-h-0 flex-col overflow-hidden",
              // แถบ action เป็น fixed จึงไม่กินพื้นที่ใน flow ตามปกติ ถ้าไม่กันพื้นที่ไว้
              // แถวสุดท้ายจะอยู่ใต้ปุ่มยกเลิก/เสิร์ฟพอดี จองความสูงตามจำนวน
              // แถวที่ปุ่มอาจ wrap บนมือถือ และรวม bottom nav/safe area ของ Capacitor ด้วย
              showBulkActionBar &&
                "pb-[calc(9.5rem+max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px)))] sm:pb-[calc(6rem+max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px)))]"
            )}
          >
            {renderList()}
          </TabsContent>
        ))}
      </Tabs>

      {/* จอมือถือยังใช้พฤติกรรมเดิม (โชว์เฉพาะมีเลือก) เพราะพื้นที่จำกัด — จอแท็บเล็ต/
          เดสก์ท็อป (isMobile=false, >=768px) โชว์ค้างไว้เสมอเมื่อแท็บนี้มีรายการเลือกได้
          แล้วปิดใช้งานปุ่มแทนตอนยังไม่ได้เลือกอะไร */}
      {showBulkActionBar ? (
        <Card
          className={cn(
            "fixed right-4 z-40 max-w-[calc(100vw-2rem)] gap-0 rounded-2xl p-0 py-0 shadow-xl transition-shadow",
            selectedItems.length > 0 && "ring-2 ring-primary"
          )}
          // --app-shell-bottom-nav-height (Capacitor) รวม safe-area-inset-bottom ไว้แล้ว
          // (ดู .app-shell[data-platform="capacitor"] ใน globals.css) เว็บไม่มีค่า = 0px
          style={{
            bottom: "calc(var(--app-shell-bottom-nav-height, 0px) + 1rem)"
          }}
        >
          <CardContent className="flex flex-wrap items-center justify-end gap-2 p-2.5 sm:gap-3 sm:p-3">
            <div className="mr-auto flex items-center gap-2.5 pr-2">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl text-base font-black tabular-nums",
                  selectedItems.length > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {selectedItems.length}
              </span>
              <span className="text-sm font-bold text-foreground">
                {selectedTableCount > 1
                  ? t("orderQueue.selectedAcrossTables", {
                      count: selectedItems.length,
                      tables: selectedTableCount
                    })
                  : t("common.selectedCount", { count: selectedItems.length })}
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={busy || selectedItems.length === 0}
              onClick={clearSelection}
            >
              <X data-icon="inline-start" />
              {t("orderQueue.clearSelection")}
            </Button>

            {status === OrderItemStatus.WAITING_CONFIRM || status === OrderItemStatus.SENT_TO_KITCHEN ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive hover:brightness-90 dark:bg-destructive dark:hover:bg-destructive"
                disabled={busy || selectedItems.length === 0}
                onClick={openCancelDialog}
              >
                <Ban data-icon="inline-start" />
                {t("actions.cancel")}
              </Button>
            ) : null}

            {status === OrderItemStatus.WAITING_CONFIRM ? (
              (() => {
                const confirmButton = (
                  <Button
                    type="button"
                    className="h-11 px-5 font-black"
                    disabled={busy || selectedItems.length === 0 || bulkSendLocked}
                    onClick={() =>
                      void runSendToKitchen(selectedItems.map((item) => item.order_item_uuid))
                    }
                  >
                    {saving ? <Spinner data-icon="inline-start" /> : <ChefHat data-icon="inline-start" />}
                    {t("orderQueue.confirmToKitchen")}
                  </Button>
                );

                if (!bulkSendLocked || !bulkSendLockedReason) return confirmButton;

                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex" tabIndex={0}>
                        {confirmButton}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{bulkSendLockedReason}</TooltipContent>
                  </Tooltip>
                );
              })()
            ) : null}

            {status === OrderItemStatus.SENT_TO_KITCHEN ? (
              <Button
                type="button"
                className="h-11 px-5 font-black"
                disabled={busy || selectedItems.length === 0}
                onClick={() =>
                  void runConfirmServed(selectedItems.map((item) => item.order_item_uuid))
                }
              >
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {t("orderQueue.confirmServed")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
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
        title={t("orderQueue.cancelLoadingTitle")}
      />

      <BlockingLoadingDialog
        description={
          loadingAction
            ? t(
                loadingAction.kind === "send"
                  ? "orderQueue.sendLoadingDescription"
                  : "orderQueue.confirmServedLoadingDescription",
                { count: loadingAction.count }
              )
            : undefined
        }
        open={Boolean(loadingAction)}
        title={
          loadingAction?.kind === "send"
            ? t("orderQueue.sendLoadingTitle")
            : t("orderQueue.confirmServedLoadingTitle")
        }
      />
    </div>
  );
}
