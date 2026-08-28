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
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { HorizontalScrollArrows } from "@/components/common/horizontal-scroll-arrows";
import { LoadingState } from "@/components/common/loading-state";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { useOrderQueueAlerts } from "@/features/pos/order-queue/use-order-queue-alerts";
import { OrderQueueCancelDialog } from "@/features/pos/order-queue/order-queue-cancel-dialog";
import {
  OrderQueueCard,
  OrderQueueTableRow
} from "@/features/pos/order-queue/order-queue-items";
import {
  buildOrderQueueTabs,
  canSelectQueueItem,
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
  const isCapacitorNativeApp = useIsCapacitorNativeApp();
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
  const tabsRailRef = useRef<HTMLDivElement | null>(null);
  const [tabsRailOverflowing, setTabsRailOverflowing] = useState(false);

  const view: QueueListView = viewOverride ?? (isMobile ? "card" : "table");
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
  // items เรียงจากรอนานสุดมาก่อนแล้วตั้งแต่ชั้น service (sortOrderQueueItems)
  const oldestWait = items.length
    ? liveWaitMinutes(items[0].open_minutes, minutesSinceLoad)
    : 0;
  const activeTab = tabs.find((tab) => tab.status === status);
  const activeTabTitle = activeTab?.title || t(queueTabFallbackKey(status));
  const reasonInvalid = reasonTouched && !cancelReason.trim();
  const busy = saving || Boolean(actingUuid);

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
    if (!isCapacitorNativeApp) return;
    setHeaderRefreshAction({ loading, onClick: () => void refresh() });
    return () => setHeaderRefreshAction(null);
  }, [isCapacitorNativeApp, loading, refresh, setHeaderRefreshAction]);

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
    if (!branchUuid || !user?.uuid || !orderItemUuids.length) return;

    try {
      await sendToKitchen({
        order_item_uuids: orderItemUuids,
        branch_uuid_fk: branchUuid,
        login_uuid_fk: user.uuid,
        lang: language
      });
      clearSelection();
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

  async function runConfirmServed(orderItemUuids: string[]) {
    if (!branchUuid || !orderItemUuids.length) return;

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
      waitMinutes: liveWaitMinutes(item.open_minutes, minutesSinceLoad),
      selected: selectedUuids.has(item.order_item_uuid),
      selectable: isSelectable && canSelectQueueItem(item, status),
      acting: actingUuid === item.order_item_uuid
    }));

    if (view === "card") {
      return (
        <div className="flex flex-col gap-3">
          {isSelectable && selectableItems.length > 0 ? (
            <Label className="flex w-fit items-center gap-2 text-xs font-bold text-muted-foreground">
              <Checkbox
                checked={headerChecked}
                onCheckedChange={(checked) => toggleAllItems(checked === true)}
              />
              {t("common.selectAll")}
            </Label>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
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
                onAction={(action) => void handleItemAction(row.item, action)}
                onToggle={(checked) => toggleItem(row.item, checked)}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                {isSelectable && selectableItems.length > 0 ? (
                  <Checkbox
                    aria-label={t("common.selectAll")}
                    checked={headerChecked}
                    onCheckedChange={(checked) => toggleAllItems(checked === true)}
                  />
                ) : null}
              </TableHead>
              <TableHead>{t("orderQueue.wait")}</TableHead>
              <TableHead>{t("pos.table")}</TableHead>
              <TableHead>{t("pos.product")}</TableHead>
              <TableHead>{t("pos.qty")}</TableHead>
              <TableHead>{t("orderQueue.orderNumber")}</TableHead>
              <TableHead>{t("orderQueue.arrived")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">
                {t("orderQueue.actionColumn")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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
                onToggle={(checked) => toggleItem(row.item, checked)}
              />
            ))}
          </TableBody>
        </Table>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {isCapacitorNativeApp ? (
        // Capacitor: ตัด h1/ตัวสลับมุมมองตาราง-การ์ด/ปุ่มรีเฟรชในหน้าออกทั้งหมด
        // — ชื่อหน้าซ้ำกับ NativeTopBar อยู่แล้ว, มุมมองตารางใช้งานจริงไม่ได้บนจอแคบขนาด
        // นี้เลย (isMobile บังคับ view เป็น "card" อยู่แล้วเสมอ ปุ่มสลับเลยไม่มีประโยชน์
        // แถมกินที่), ปุ่มรีเฟรชย้ายไปลงทะเบียนเข้า top bar แทนแล้วด้านบน — เหลือแค่บรรทัด
        // สรุปที่มีข้อมูลไม่ซ้ำใคร (จำนวน/เวลารอนานสุด)
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{activeTabTitle}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {t("orderQueue.activeOrders", { count: items.length })}
          </span>
          {oldestWait > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t("orderQueue.oldestWait", {
                  wait: formatQueueWait(oldestWait, t)
                })}
              </span>
            </>
          ) : null}
        </p>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-xl font-black text-foreground">
              {t("orderQueue.title")}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{activeTabTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t("orderQueue.activeOrders", { count: items.length })}
              </span>
              {oldestWait > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {t("orderQueue.oldestWait", {
                      wait: formatQueueWait(oldestWait, t)
                    })}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* pill + ตัวอักษรหนา + shadow ตามแพทเทิร์นเดียวกับ StatusToggleItem ใน
                table-list-section.tsx — เดิมใช้ ToggleGroup variant="outline" ค่า default
                (h-7, border บาง) ซึ่งเป็นขนาด/น้ำหนักสำหรับ control ย่อยในฟอร์ม ไม่ใช่ปุ่มระดับ
                page-level ผลคือดูเป็นกล่องเล็ก ๆ จิ๋วเบียดกัน ไม่ match กับส่วนอื่นของแอป */}
            <ToggleGroup
              aria-label={t("orderQueue.viewToggleAria")}
              type="single"
              value={view}
              onValueChange={(value) => {
                if (value) setViewOverride(value as QueueListView);
              }}
              className="gap-1.5"
            >
              <ToggleGroupItem
                value="table"
                aria-label={t("orderQueue.viewTable")}
                className="h-10 gap-1.5 rounded-full border border-border bg-card px-3.5 font-black shadow-sm data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20"
              >
                <Rows3 data-icon="inline-start" />
                <span className="hidden sm:inline">{t("orderQueue.viewTable")}</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="card"
                aria-label={t("orderQueue.viewCard")}
                className="h-10 gap-1.5 rounded-full border border-border bg-card px-3.5 font-black shadow-sm data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20"
              >
                <LayoutGrid data-icon="inline-start" />
                <span className="hidden sm:inline">{t("orderQueue.viewCard")}</span>
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-3.5 font-black shadow-sm"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCcw data-icon="inline-start" />
              )}
              <span className="hidden sm:inline">{t("actions.refresh")}</span>
            </Button>
          </div>
        </header>
      )}

      <Tabs
        value={String(status)}
        onValueChange={(value) => void handleTabChange(value)}
        className="gap-4"
      >
        <div className="relative">
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

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.status} value={String(tab.status)}>
            {renderList()}
          </TabsContent>
        ))}
      </Tabs>

      {/* จอมือถือยังใช้พฤติกรรมเดิม (โชว์เฉพาะมีเลือก) เพราะพื้นที่จำกัด — จอแท็บเล็ต/
          เดสก์ท็อป (isMobile=false, >=768px) โชว์ค้างไว้เสมอเมื่อแท็บนี้มีรายการเลือกได้
          แล้วปิดใช้งานปุ่มแทนตอนยังไม่ได้เลือกอะไร ตามที่ขอ */}
      {isSelectable &&
      selectableItems.length > 0 &&
      (!isMobile || selectedItems.length > 0) ? (
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" className="h-11" disabled>
                        <Ban data-icon="inline-start" />
                        {t("actions.cancel")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("orderQueue.cancelDisabledTooltip")}
                  </TooltipContent>
                </Tooltip>
                <Button
                  type="button"
                  className="h-11 font-black"
                  disabled={busy || selectedItems.length === 0}
                  onClick={() =>
                    void runSendToKitchen(
                      selectedItems.map((item) => item.order_item_uuid)
                    )
                  }
                >
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {t("orderQueue.confirmToKitchen")}
                </Button>
              </>
            ) : null}

            {status === OrderItemStatus.SENT_TO_KITCHEN ? (
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
            ) : null}

            {status === OrderItemStatus.SERVED ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11 font-black"
                disabled={busy || selectedItems.length === 0}
                onClick={openCancelDialog}
              >
                <Ban data-icon="inline-start" />
                {t("actions.cancel")}
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
        title={t("orderQueue.cancelDialogTitle")}
      />
    </div>
  );
}
