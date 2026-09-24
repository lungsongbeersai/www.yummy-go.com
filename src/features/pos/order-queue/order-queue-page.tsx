"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, LayoutGrid, ListChecks, Rows3, RefreshCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { HorizontalScrollArrows } from "@/components/common/horizontal-scroll-arrows";
import { LoadingState } from "@/components/common/loading-state";
import { useIsNativeShellActive } from "@/hooks/use-native-shell-active";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { useOrderQueueAlerts } from "@/features/pos/order-queue/use-order-queue-alerts";
import { OrderQueueCancelDialog } from "@/features/pos/order-queue/order-queue-cancel-dialog";
import {
  OrderQueueCard,
  OrderQueueTableRow
} from "@/features/pos/order-queue/order-queue-items";
import { OrderQueueManagePanel } from "@/features/pos/order-queue/order-queue-manage-panel";
import {
  OrderQueueTableBody,
  OrderQueueTableFoot,
  OrderQueueTableHead,
  useOrderQueueTableScrollSync
} from "@/features/pos/order-queue/order-queue-table-frame";
import { manageQueueUrgencyTier } from "@/features/pos/order-queue/order-queue-urgency";
import {
  buildOrderQueueTabs,
  canSelectQueueItem,
  displayWaitMinutes,
  formatQueueWait,
  liveWaitMinutes,
  queueTabFallbackKey,
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
  const { headRef, footRef, handleBodyScroll } = useOrderQueueTableScrollSync();

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
  const tabsRailRef = useRef<HTMLDivElement | null>(null);
  const [tabsRailOverflowing, setTabsRailOverflowing] = useState(false);

  // isMobile ต้องชนะ viewOverride เสมอ ไม่ใช่แค่ค่า fallback — ปุ่มสลับมุมมองถูกซ่อนแล้ว
  // ตอนจอแคบกว่า md แต่ viewOverride เป็น state ที่ค้างอยู่ได้ (เช่น กดปุ่ม "ตาราง" ไว้ตอน
  // จอกว้าง แล้วย่อ/หมุนจอแคบลงโดยไม่รีโหลดหน้า) ถ้ายังปล่อยให้ viewOverride ชนะ ตารางคอลัมน์
  // คงที่ 9 คอลัมน์จะโผล่มาบนจอโทรศัพท์ทั้งที่ควบคุมปิดการเข้าถึงไว้แล้ว
  const view: QueueListView = isMobile ? "card" : (viewOverride ?? "table");
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
  // แสดงในแถบสรุปท้ายตาราง (TableFooter) ไม่ใช่ page header อีกต่อไป — เรียงตามเวลายืนยัน
  // ไม่ได้เรียงตามเวลารอ จึงต้องหาค่าสูงสุดจากทุกรายการแทนการอาศัยแถวแรก
  const oldestWait = items.reduce(
    (longest, item) =>
      Math.max(longest, displayWaitMinutes(item.open_minutes, minutesSinceLoad, status)),
    0
  );
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

  function renderList() {
    if (loading) return <LoadingState variant="table" />;

    if (!items.length) {
      return (
        <EmptyState
          title={t("orderQueue.emptyTitle")}
          description={t("orderQueue.emptyDescription", { tab: activeTabTitle })}
        />
      );
    }

    const rows = items.map((item, index) => ({
      item,
      position: index + 1,
      waitMinutes: displayWaitMinutes(item.open_minutes, minutesSinceLoad, status),
      selected: selectedUuids.has(item.order_item_uuid),
      selectable: isSelectable && canSelectQueueItem(item, status),
      acting: actingUuid === item.order_item_uuid
    }));

    if (view === "card") {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {isSelectable && selectableItems.length > 0 ? (
            <Label className="flex w-fit shrink-0 items-center gap-2 text-xs font-bold text-muted-foreground">
              <Checkbox
                checked={headerChecked}
                onCheckedChange={(checked) => toggleAllItems(checked === true)}
              />
              {t("common.selectAll")}
            </Label>
          ) : null}
          <div className="grid min-h-0 flex-1 auto-rows-min gap-3 overflow-y-auto md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((row) => (
              <OrderQueueCard
                key={row.item.order_item_uuid}
                acting={row.acting}
                item={row.item}
                position={row.position}
                selectable={row.selectable}
                selected={row.selected}
                status={status}
                waitMinutes={row.waitMinutes}
                manageUrgency={
                  status === OrderItemStatus.WAITING_CONFIRM
                    ? manageQueueUrgencyTier(row.waitMinutes)
                    : undefined
                }
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
          </div>
        </div>
      );
    }

    if (status === OrderItemStatus.WAITING_CONFIRM) {
      return (
        <OrderQueueManagePanel
          rows={rows}
          headerChecked={headerChecked}
          isSelectable={isSelectable}
          hasSelectableItems={selectableItems.length > 0}
          lockedOrderItemUuid={lockedOrderItemUuid}
          onToggle={(item, checked) => toggleItem(item, checked)}
          onToggleAll={toggleAllItems}
          onAction={(item, action) => void handleItemAction(item, action)}
          onCancel={openCancelDialogForItem}
        />
      );
    }

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
              onAction={(action) => void handleItemAction(row.item, action)}
              onCancel={() => openCancelDialogForItem(row.item)}
              onToggle={(checked) => toggleItem(row.item, checked)}
            />
          ))}
        </OrderQueueTableBody>
        <OrderQueueTableFoot
          count={items.length}
          oldestWait={oldestWait}
          scrollContainerRef={footRef}
        />
      </Card>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <Tabs
        value={String(status)}
        onValueChange={(value) => void handleTabChange(value)}
        className="min-h-0 flex-1 gap-4"
      >
        {/* แท็บ + ปุ่มควบคุม (สลับมุมมอง/รีเฟรช) รวมเป็นแถวเดียวกัน — เดิมแยกเป็น header
            ลอยแถวบนสุดต่างหาก เหลือแค่ปุ่มไม่กี่ปุ่มชิดขวา ด้านซ้ายว่างเป็นแถบเปล่ายาว
            ดูเหมือนของหลุดค้าง ทั้งที่ header หลักของแอป (breadcrumb) บอกชื่อหน้าอยู่แล้ว
            ไม่ต้องมีอะไรค้างไว้ฝั่งซ้ายเลย — รวมเข้าแถวแท็บแทนให้เป็นแถบเครื่องมือเดียว
            (แท็บชิดซ้าย/เลื่อนได้ในตัวมันเอง, ปุ่มควบคุมชิดขวา, native shell ตัดปุ่มออกเหมือนเดิม
            เพราะ NativeTopBar มีปุ่มรีเฟรชของตัวเองแล้ว) — border-b/pb-3 ทำให้ทั้งแถบนี้ดูเป็น
            เครื่องมือชิ้นเดียวที่ตั้งใจวางไว้ ไม่ใช่ปุ่มลอยเดี่ยว ๆ เบียดกันมุมขวาบนจอกว้าง
            ที่เหลือพื้นที่ว่างตรงกลางเยอะจนดูเหมือนของขาดหาย */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border pb-3">
          <div className="relative min-w-0 flex-1">
            {/* ใช้ variant ปกติ ไม่ใช่ "line" — variant line บังคับ data-active:bg-transparent
                ด้วย selector ที่ specificity สูงกว่า (group-data-[variant=line]/tabs-list:)
                คลาสสีที่ส่งเข้ามาตรงนี้เลยแพ้เสมอ แท็บที่เลือกอยู่จะพื้นใสจนดูไม่ออกว่าอันไหนถูกเลือก */}
            {/* py-1 ไม่ใช่แค่ pb-1 เดิม — overflow-x ที่ไม่ใช่ visible ทำให้ browser บังคับ
                overflow-y เป็น auto ไปด้วยตามสเปก (ตั้งใจ visible ไว้ก็ไม่มีผล) เงา/ขอบโฟกัส
                ของปุ่มที่ไม่มี padding บนกันไว้เลยโดนตัดขอบบนได้ */}
            {/* pl-8/pr-8 พอดีกับปุ่มลูกศร size-8 เป๊ะ เฉพาะตอนล้นจริง (tabsRailOverflowing)
                — เผื่อที่ให้แท็บแรก/สุดท้ายไม่โดนปุ่มลูกศรบังจนอ่าน/กดไม่ได้ ตามที่รายงานมา
                บนมือถือ/Capacitor ไม่ใส่ตลอดเพราะจอกว้างที่ไม่มีลูกศรจะเห็นเป็นที่ว่างเกินจำเป็น
                (เดิม size-9/pl-10 กินพื้นที่มากไปจนแท็บแรกดูห่างขอบจอเกินจำเป็นบนมือถือ)
                overflow-y-hidden ตัดเลื่อนแนวตั้งออก — overflow-x ที่ไม่ใช่ visible ทำให้
                เบราว์เซอร์บังคับ overflow-y เป็น auto ไปด้วยตามสเปก แถวนี้ต้องเลื่อนแนวนอนอย่างเดียว */}
            <div
              ref={tabsRailRef}
              className={cn(
                "-mx-1 overflow-x-auto overflow-y-hidden px-1 py-1",
                tabsRailOverflowing && "pl-8 pr-8"
              )}
            >
              {/* group-data-horizontal/tabs:h-auto ไม่ใช่แค่ h-auto เฉย ๆ — TabsList พื้นฐาน
                  มี group-data-horizontal/tabs:h-8 (32px) ที่ใช้ attribute selector ทำให้
                  specificity สูงกว่า .h-auto ธรรมดา ชนะเสมอไม่ว่าจะเขียนลำดับคลาสยังไง (แพทเทิร์น
                  เดียวกับ payment-dialog-content.tsx) ไม่งั้นปุ่มแท็บสูง h-10 (40px) โดนตัดขอบ
                  บน-ล่างเพราะ container ถูกบังคับสูงแค่ 32px */}
              <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto">
                {visibleTabs.map((tab) => {
                  const active = status === tab.status;
                  return (
                    <TabsTrigger
                      key={tab.status}
                      value={String(tab.status)}
                      className={cn(
                        "h-10 flex-none gap-1.5 rounded-full border border-transparent px-3.5 font-black shadow-sm transition",
                        "data-active:bg-primary data-active:text-primary-foreground data-active:shadow-primary/20",
                        "dark:data-active:bg-primary dark:data-active:text-primary-foreground",
                        !active &&
                          "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5"
                      )}
                    >
                      {tab.title || t(queueTabFallbackKey(tab.status))}
                      <Badge
                        className={cn(
                          "border-transparent px-1.5 tabular-nums",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tab.total}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
            {/* แถวแท็บสถานะ 5 อันกว้างเกินจอมือถือ/แท็บเล็ตแน่นอน — mobile browser ซ่อน
                scrollbar เป็นค่าเริ่มต้น ไม่มีลูกศรนี้ผู้ใช้จะไม่รู้ว่าต้องเลื่อนดู เข้าใจผิดว่า
                แท็บท้าย ๆ "หายไป" หรือ "ถูกบัง" (ตามที่รายงานมา) ทั้งที่จริงแค่ล้นขอบจอ */}
            <HorizontalScrollArrows
              className="size-8"
              scrollRef={tabsRailRef}
              onOverflowChange={setTabsRailOverflowing}
            />
          </div>

          {nativeShellActive ? null : (
            // native shell ตัดออกเหมือนเดิม — NativeTopBar มีปุ่มรีเฟรชของตัวเองอยู่แล้ว
            <div className="flex shrink-0 items-center gap-3">
              {/* เดิมแยกปุ่ม "ตาราง"/"การ์ด" เป็นคนละกล่อง (มีขอบ+เงาของตัวเอง) ดูเหมือน
                  3 ปุ่มเดี่ยว ๆ เรียงกันโดยไม่รู้ว่าปุ่มไหนเป็นกลุ่มเดียวกัน — เปลี่ยนเป็น
                  segmented control จริง: ครอบด้วยรางเดียว (border+bg-muted) แล้วให้แต่ละ
                  item โปร่งใส เห็นแค่ pill สีทึบตอนถูกเลือกเท่านั้น ตัดปุ่มรีเฟรชออกมาไว้
                  นอกราง เว้นระยะห่างชัดเจน (gap-3) ให้รู้ทันทีว่าไม่ใช่ตัวเลือกมุมมองที่ 3
                  — ซ่อนทั้งกลุ่มบนจอแคบกว่า md (isMobile) เพราะมุมมองตารางคอลัมน์คงที่ 9
                  คอลัมน์ใช้งานจริงไม่ได้บนจอโทรศัพท์อยู่แล้ว (isMobile บังคับ view เป็น
                  "card" เสมอ) การเปิดปุ่มสลับไว้จะยิ่งชวนกดไปเจอตารางที่ใช้งานไม่ได้ */}
              {isMobile ? null : (
                <ToggleGroup
                  aria-label={t("orderQueue.viewToggleAria")}
                  type="single"
                  value={view}
                  onValueChange={(value) => {
                    if (value) setViewOverride(value as QueueListView);
                  }}
                  className="gap-1 rounded-full border border-border bg-muted p-1"
                >
                  <ToggleGroupItem
                    value="table"
                    aria-label={t("orderQueue.viewTable")}
                    className="h-8 gap-1.5 rounded-full px-3.5 font-black data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                  >
                    <Rows3 data-icon="inline-start" />
                    <span className="hidden sm:inline">{t("orderQueue.viewTable")}</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="card"
                    aria-label={t("orderQueue.viewCard")}
                    className="h-8 gap-1.5 rounded-full px-3.5 font-black data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                  >
                    <LayoutGrid data-icon="inline-start" />
                    <span className="hidden sm:inline">{t("orderQueue.viewCard")}</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="rounded-full"
                    aria-label={t("actions.refresh")}
                    disabled={loading}
                    onClick={() => void refresh()}
                  >
                    {loading ? <Spinner /> : <RefreshCcw />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("actions.refresh")}</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {visibleTabs.map((tab) => (
          <TabsContent
            key={tab.status}
            value={String(tab.status)}
            className={cn(
              "flex min-h-0 flex-col overflow-hidden",
              // แถบ action เป็น fixed จึงไม่กินพื้นที่ใน flow ตามปกติ ถ้าไม่กันพื้นที่ไว้
              // แถวสุดท้ายและ TableFoot จะอยู่ใต้ปุ่มยกเลิก/เสิร์ฟพอดี จองความสูงตามจำนวน
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
          แล้วปิดใช้งานปุ่มแทนตอนยังไม่ได้เลือกอะไร ตามที่ขอ */}
      {showBulkActionBar ? (
        <Card
          className="fixed right-4 z-40 max-w-[calc(100vw-2rem)] gap-0 p-0 shadow-lg"
          // เดิมชนกับ NativeBottomNav บน Capacitor เพราะ z-40 เท่ากันแต่นับแค่
          // safe-area-inset-bottom ไม่ได้เผื่อความสูงแถบ bottom nav (~64px) เลย —
          // การ์ดนี้เลยโผล่ไปโดน bottom nav บังทับครึ่งหนึ่งหรือทั้งใบ ตามที่รายงานมา
          // --app-shell-bottom-nav-height ไม่มีค่าบนเว็บ (fallback 0px) จึงไม่กระทบ
          // พฤติกรรมเดิมของเว็บเลย ค่านี้รวม safe-area-inset-bottom ไว้ในตัวมันเองแล้ว
          // (ดู .app-shell[data-platform="capacitor"] ใน globals.css) ไม่ต้องบวกซ้ำ
          style={{
            bottom: "calc(var(--app-shell-bottom-nav-height, 0px) + 1rem)"
          }}
        >
          <CardContent className="flex flex-wrap items-center justify-end gap-2 p-3">
            <Badge variant="secondary" className="mr-auto gap-1.5">
              <ListChecks data-icon="inline-start" />
              {selectedTableCount > 1
                ? t("orderQueue.selectedAcrossTables", {
                    count: selectedItems.length,
                    tables: selectedTableCount
                  })
                : t("common.selectedCount", { count: selectedItems.length })}
            </Badge>

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

            {status === OrderItemStatus.WAITING_CONFIRM ? (
              <>
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
                {(() => {
                  const confirmButton = (
                    <Button
                      type="button"
                      className="h-11 font-black"
                      disabled={busy || selectedItems.length === 0 || bulkSendLocked}
                      onClick={() =>
                        void runSendToKitchen(
                          selectedItems.map((item) => item.order_item_uuid)
                        )
                      }
                    >
                      {saving ? <Spinner data-icon="inline-start" /> : null}
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
                })()}
              </>
            ) : null}

            {status === OrderItemStatus.SENT_TO_KITCHEN ? (
              <>
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
                <Button
                  type="button"
                  className="h-11 font-black"
                  disabled={busy || selectedItems.length === 0}
                  onClick={() =>
                    void runConfirmServed(
                      selectedItems.map((item) => item.order_item_uuid)
                    )
                  }
                >
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {t("orderQueue.confirmServed")}
                </Button>
              </>
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
