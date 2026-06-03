"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import {
  CUSTOMER_DISPLAY_CHANNEL,
  CUSTOMER_DISPLAY_STORAGE_KEY,
  type CustomerDisplayPayload,
} from "@/features/customer-display/customer-display-sync";
import { cn } from "@/lib/utils";
import type { CartItem, CartOrder, PosTable, PosZone } from "@/services/pos";
import type { PrintProgress } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import type {
  CartItemActionTarget,
  CartTab,
  ConfirmAllProgress,
  DiscountDraft,
} from "./types";
import {
  CartDiscountDialog,
  CartNoteDialog,
  CartPanelLoading,
  ConfirmAllLoadingDialog,
} from "./cart-dialogs";
import { CustomerDisplayPickerDialog } from "./customer-display-picker-dialog";
import {
  CUSTOMER_DISPLAY_TARGET_STORAGE_KEY,
  customerDisplayIdFromStorage,
  defaultCustomerDisplayId,
  displayIsConnected,
} from "./customer-display-picker-utils";
import { CartSummaryDock } from "./cart-summary-dock";
import { CartTabItems, CartTabTrigger } from "./cart-items";
import type { PaymentDialogProps } from "./payment-dialog";
import { TableActionsOverlay } from "./table-actions-overlay";
import { TableQrDialog } from "./table-qr-dialog";
import {
  billDiscountButtonValue,
  buildCustomerDisplayPayload,
  cartItemActionUuid,
  cartItemDiscountMaxAmount,
  cartItemUuid,
  cartOrderInvoice,
  cartOrders,
  cartOrderUuidForItem,
  cartSummary,
  discountDraftValue,
  firstCartOrderUuid,
  formatRate,
  isNewOrderCartItem,
  isOrderHistoryCartItem,
  isSplitPaymentEligibleItem,
  newOrderConfirmGroups,
  normalizeDiscountType,
  optionalNumber,
  optionalString,
  splitPaymentSelection,
  visibleCartItems,
} from "./utils";

const PaymentDialog = dynamic<PaymentDialogProps>(
  () => import("./payment-dialog").then((mod) => mod.PaymentDialog),
  {
    ssr: false,
    loading: () => <PaymentDialogLoadingFallback />,
  },
);

function PaymentDialogLoadingFallback() {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      aria-busy="true"
    >
      <Card className="w-full max-w-[320px] rounded-lg border-white/20 bg-background p-4 text-center shadow-xl">
        <div className="mx-auto grid size-11 animate-pulse place-items-center rounded-lg bg-primary/10 text-primary">
          <ReceiptText className="size-5" />
        </div>
      </Card>
    </div>
  );
}

export function TableNextStepPanel({
  allZones,
  cart,
  loading,
  onCartRefresh,
  onTableActionComplete,
  selectedTable,
  showCreateEmployeeOrderAction = true,
}: {
  allZones: PosZone[];
  cart: CartOrder | CartOrder[] | null;
  loading: boolean;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
  selectedTable: PosTable | null;
  showCreateEmployeeOrderAction?: boolean;
}) {
  return (
    <SelectedTableCartPanel
      allZones={allZones}
      cart={cart}
      loading={loading}
      table={selectedTable}
      showCreateEmployeeOrderAction={showCreateEmployeeOrderAction}
      onCartRefresh={onCartRefresh}
      onTableActionComplete={onTableActionComplete}
    />
  );
}

type PaymentContext = {
  kind: "full" | "split";
  orders: CartOrder[];
  splitBillItemUuids?: string[];
  summary: ReturnType<typeof cartSummary>;
};

export function SelectedTableCartPanel({
  allZones,
  cart,
  loading,
  newOrderFocusKey = 0,
  table,
  variant = "side",
  showCreateEmployeeOrderAction = true,
  onCartRefresh,
  onTableActionComplete,
}: {
  allZones: PosZone[];
  cart: CartOrder | CartOrder[] | null;
  loading: boolean;
  newOrderFocusKey?: number;
  table: PosTable | null;
  variant?: "side" | "sheet";
  showCreateEmployeeOrderAction?: boolean;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const updateQty = usePosStore((state) => state.updateQty);
  const confirmKitchen = usePosStore((state) => state.confirmKitchen);
  const deleteItem = usePosStore((state) => state.deleteItem);
  const cancelItem = usePosStore((state) => state.cancelItem);
  const confirmServed = usePosStore((state) => state.confirmServed);
  const updateNote = usePosStore((state) => state.updateNote);
  const applyItemDiscount = usePosStore((state) => state.applyItemDiscount);
  const applyBillDiscount = usePosStore((state) => state.applyBillDiscount);
  const executeKitchen = usePrinterStore((state) => state.executeKitchen);
  const showToast = useToastStore((state) => state.show);
  const selectedTable = table?.table_uuid ? table : null;
  const hasSelectedTable = Boolean(selectedTable);
  const tableUuid = selectedTable?.table_uuid ?? "";
  const displayCart = hasSelectedTable ? cart : null;
  const orders = useMemo(() => cartOrders(displayCart), [displayCart]);
  const newOrderItems = useMemo(
    () => visibleCartItems(displayCart).filter(isNewOrderCartItem),
    [displayCart],
  );
  const historyItems = useMemo(
    () => visibleCartItems(displayCart).filter(isOrderHistoryCartItem),
    [displayCart],
  );
  const summary = useMemo(() => cartSummary(displayCart), [displayCart]);
  const confirmGroups = useMemo(() => newOrderConfirmGroups(orders), [orders]);
  const preferredTab: CartTab =
    newOrderItems.length || !historyItems.length ? "new" : "history";
  const [activeTab, setActiveTab] = useState<CartTab>(preferredTab);
  const previousTableUuidRef = useRef(tableUuid);
  const previousNewOrderFocusKeyRef = useRef(newOrderFocusKey);
  const [updatingItemUuid, setUpdatingItemUuid] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmAllProgress, setConfirmAllProgress] =
    useState<ConfirmAllProgress | null>(null);
  const [itemActionTarget, setItemActionTarget] =
    useState<CartItemActionTarget | null>(null);
  const [actingItemUuid, setActingItemUuid] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<CartItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [itemDiscountTarget, setItemDiscountTarget] = useState<CartItem | null>(
    null,
  );
  const [itemDiscountDraft, setItemDiscountDraft] = useState<DiscountDraft>({
    type: "PCT",
    value: "",
  });
  const [billDiscountOpen, setBillDiscountOpen] = useState(false);
  const [billDiscountDraft, setBillDiscountDraft] = useState<DiscountDraft>({
    type: "PCT",
    value: "",
  });
  const [billDiscountPending, setBillDiscountPending] = useState(false);
  const [tableActionsOpen, setTableActionsOpen] = useState(false);
  const [tableQrOpen, setTableQrOpen] = useState(false);
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);
  const [customerDisplayInfo, setCustomerDisplayInfo] =
    useState<ElectronDisplayInfo | null>(null);
  const [customerDisplayError, setCustomerDisplayError] = useState<string | null>(
    null,
  );
  const [customerDisplayLoading, setCustomerDisplayLoading] = useState(false);
  const [customerDisplayOpening, setCustomerDisplayOpening] = useState(false);
  const [customerDisplayPayload, setCustomerDisplayPayload] =
    useState<CustomerDisplayPayload | null>(null);
  const [selectedCustomerDisplayId, setSelectedCustomerDisplayId] = useState<
    number | null
  >(null);
  const [paymentContext, setPaymentContext] = useState<PaymentContext | null>(
    null,
  );
  const [splitSelectedItemUuids, setSplitSelectedItemUuids] = useState<
    Set<string>
  >(() => new Set());
  const taxRate = formatRate(summary.taxRate);
  const taxLabel = taxRate
    ? t("pos.taxWithPercent", { percent: taxRate })
    : t("pos.taxPercent");
  const serviceRate = formatRate(summary.serviceRate);
  const serviceLabel = serviceRate
    ? t("pos.serviceWithPercent", { percent: serviceRate })
    : t("pos.serviceTotal");
  const invoice = cartOrderInvoice(orders);
  const visibleItemCount = newOrderItems.length + historyItems.length;
  const currentOrderUuid = useMemo(() => firstCartOrderUuid(orders), [orders]);
  const currentOrder = useMemo(
    () => orders.find((entry) => optionalString(entry.order_uuid)),
    [orders],
  );
  const billDiscountValueLabel = billDiscountButtonValue(currentOrder);
  const splitEligibleItems = useMemo(
    () =>
      historyItems.filter(
        (item) =>
          isSplitPaymentEligibleItem(item) &&
          Boolean(cartOrderUuidForItem(orders, item)),
      ),
    [historyItems, orders],
  );
  const splitSelection = useMemo(
    () => splitPaymentSelection(orders, splitSelectedItemUuids),
    [orders, splitSelectedItemUuids],
  );
  const splitSelectedItems = splitSelection?.orders[0]?.items ?? [];
  const splitSelectedTotal = splitSelection?.summary.grandTotal ?? 0;
  const splitSelectedCount = splitSelectedItems.length;
  const actionTargetUuid = itemActionTarget
    ? cartItemActionUuid(itemActionTarget.item)
    : null;
  const cartActionsLocked = Boolean(
    !hasSelectedTable ||
      updatingItemUuid ||
      confirming ||
      actingItemUuid ||
      billDiscountPending,
  );
  const canConfirm =
    Boolean(user?.uuid) && confirmGroups.length > 0 && !cartActionsLocked;
  const canPayBill = Boolean(
    user?.uuid &&
      currentOrderUuid &&
      historyItems.length > 0 &&
      newOrderItems.length === 0 &&
      summary.grandTotal > 0 &&
      !cartActionsLocked,
  );
  const canSelectSplitItems = Boolean(
    user?.uuid &&
      currentOrderUuid &&
      splitEligibleItems.length > 0 &&
      !cartActionsLocked,
  );
  const canPaySplitSelection = Boolean(
    user?.uuid &&
      splitSelection &&
      splitSelectedCount > 0 &&
      !cartActionsLocked,
  );
  const itemDiscountMaxAmount = itemDiscountTarget
    ? cartItemDiscountMaxAmount(itemDiscountTarget)
    : null;
  const billDiscountMaxAmount = summary.subtotal;
  const itemDiscountValue = discountDraftValue(
    itemDiscountDraft,
    itemDiscountMaxAmount,
  );
  const billDiscountValue = discountDraftValue(
    billDiscountDraft,
    billDiscountMaxAmount,
  );

  useEffect(() => {
    setActiveTab((current) => {
      if (previousTableUuidRef.current !== tableUuid) {
        previousTableUuidRef.current = tableUuid;
        return preferredTab;
      }
      if (current === "history" && !historyItems.length) return "new";
      if (current === "new" && !newOrderItems.length && historyItems.length)
        return "history";
      return current;
    });
  }, [
    historyItems.length,
    newOrderItems.length,
    preferredTab,
    tableUuid,
  ]);

  useEffect(() => {
    if (!hasSelectedTable) return;
    if (previousNewOrderFocusKeyRef.current === newOrderFocusKey) return;

    previousNewOrderFocusKeyRef.current = newOrderFocusKey;

    setActiveTab("new");
    setSplitSelectedItemUuids((current) =>
      current.size ? new Set() : current,
    );
  }, [hasSelectedTable, newOrderFocusKey]);

  useEffect(() => {
    setItemActionTarget(null);
    setActingItemUuid(null);
    setNoteTarget(null);
    setNoteDraft("");
    setItemDiscountTarget(null);
    setItemDiscountDraft({ type: "PCT", value: "" });
    setBillDiscountOpen(false);
    setBillDiscountDraft({ type: "PCT", value: "" });
    setBillDiscountPending(false);
    setTableActionsOpen(false);
    setTableQrOpen(false);
    setPaymentContext(null);
    setSplitSelectedItemUuids(new Set());
    setConfirmAllProgress(null);
  }, [tableUuid]);

  useEffect(() => {
    if (activeTab === "history") return;

    setSplitSelectedItemUuids((current) =>
      current.size ? new Set() : current,
    );
  }, [activeTab]);

  useEffect(() => {
    const eligibleUuids = new Set(
      splitEligibleItems
        .map(cartItemActionUuid)
        .filter((uuid): uuid is string => Boolean(uuid)),
    );
    setSplitSelectedItemUuids((current) => {
      let changed = false;
      const next = new Set<string>();

      current.forEach((uuid) => {
        if (eligibleUuids.has(uuid)) {
          next.add(uuid);
        } else {
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [splitEligibleItems]);

  async function changeCartItemQty(item: CartItem, change: 1 | -1) {
    const itemUuid = cartItemUuid(item);
    if (!itemUuid || cartActionsLocked) return;

    setUpdatingItemUuid(itemUuid);
    try {
      await updateQty({
        order_item_uuid: itemUuid,
        change_type: change > 0 ? "INCREASE" : "DECREASE",
        change_qty: 1,
      });
      await onCartRefresh();
    } catch (error) {
      showToast({
        title: t("pos.cartUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setUpdatingItemUuid(null);
    }
  }

  async function executeKitchenAck(
    response: Awaited<ReturnType<typeof confirmKitchen>>,
    fallbackLoginUuid: string,
    onProgress?: (progress: PrintProgress) => void,
  ) {
    const printJobUuid = optionalString(
      response.print_job?.print_job_uuid,
      response.pending_query?.print_job_uuid,
    );
    if (!printJobUuid) return { successCount: 0, failedCount: 0, total: 0 };

    const loginUuid = optionalString(
      response.pending_query?.login_uuid_fk,
      response.login_uuid_fk,
      fallbackLoginUuid,
    );
    if (!loginUuid) throw new Error("login_uuid_fk is required");

    return executeKitchen({
      print_job: response.print_job,
      pending_query: response.pending_query,
      login_uuid_fk: loginUuid,
      onProgress,
    });
  }

  function showKitchenConfirmResult(
    result: { successCount: number; failedCount: number; total: number },
    fallbackErrorTitle: string,
  ) {
    if (result.failedCount > 0) {
      showToast({
        title: fallbackErrorTitle,
        description: `${result.failedCount}/${result.total || result.failedCount}`,
        tone: "error",
      });
      return;
    }

    showToast({ title: t("pos.orderConfirmed"), tone: "success" });
  }

  async function confirmNewOrder() {
    if (!user?.uuid || !confirmGroups.length || cartActionsLocked) return;

    setConfirming(true);
    try {
      const printResult = { successCount: 0, failedCount: 0, total: 0 };
      const refreshStepCount = 1;
      let confirmedGroups = 0;
      let completedPrintSteps = 0;
      let totalPrintSteps = 0;

      const setProgress = (completed: number, total: number, label: string) => {
        const safeTotal = Math.max(total, 1);
        const safeCompleted = Math.min(completed, safeTotal);
        setConfirmAllProgress({
          completed: safeCompleted,
          detail: t("pos.confirmAllProgress", {
            completed: safeCompleted,
            total: safeTotal,
          }),
          label,
          total: safeTotal,
        });
      };

      setProgress(
        0,
        confirmGroups.length + refreshStepCount,
        t("pos.confirmAllPreparing"),
      );

      for (const group of confirmGroups) {
        setProgress(
          confirmedGroups + completedPrintSteps,
          confirmGroups.length + totalPrintSteps + refreshStepCount,
          t("pos.confirmAllConfirming"),
        );
        const response = await confirmKitchen({
          order_uuid: group.orderUuid,
          login_uuid_fk: user.uuid,
          order_item_uuids: group.itemUuids,
        });
        confirmedGroups++;

        const result = await executeKitchenAck(
          response,
          user.uuid,
          (progress) => {
            const nextTotalPrintSteps = totalPrintSteps + progress.total;
            const nextCompletedPrintSteps =
              completedPrintSteps + progress.completed;
            const label =
              progress.phase === "fetching"
                ? t("pos.confirmAllFetchingPrintJobs")
                : t("pos.confirmAllPrinting");

            setProgress(
              confirmedGroups + nextCompletedPrintSteps,
              confirmGroups.length + nextTotalPrintSteps + refreshStepCount,
              label,
            );
          },
        );
        printResult.successCount += result.successCount;
        printResult.failedCount += result.failedCount;
        printResult.total += result.total;
        completedPrintSteps += result.total;
        totalPrintSteps += result.total;
      }

      setProgress(
        confirmedGroups + completedPrintSteps,
        confirmGroups.length + totalPrintSteps + refreshStepCount,
        t("pos.confirmAllRefreshing"),
      );
      await onCartRefresh();
      setProgress(
        confirmGroups.length + totalPrintSteps + refreshStepCount,
        confirmGroups.length + totalPrintSteps + refreshStepCount,
        t("pos.confirmAllDone"),
      );
      showKitchenConfirmResult(printResult, t("pos.orderConfirmFailed"));
    } catch (error) {
      await onCartRefresh().catch(() => undefined);
      showToast({
        title: t("pos.orderConfirmFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setConfirming(false);
      setConfirmAllProgress(null);
    }
  }

  async function confirmSingleItemToKitchen(item: CartItem) {
    const itemUuid = cartItemActionUuid(item);
    const orderUuid = cartOrderUuidForItem(orders, item);
    if (!user?.uuid || !orderUuid || !itemUuid || cartActionsLocked) return;

    setActingItemUuid(itemUuid);
    try {
      const response = await confirmKitchen({
        order_uuid: orderUuid,
        login_uuid_fk: user.uuid,
        order_item_uuids: [itemUuid],
      });
      const result = await executeKitchenAck(response, user.uuid);
      await onCartRefresh();
      showKitchenConfirmResult(result, t("pos.confirmToKitchenFailed"));
    } catch (error) {
      await onCartRefresh().catch(() => undefined);
      showToast({
        title: t("pos.confirmToKitchenFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setActingItemUuid(null);
    }
  }

  async function confirmItemAction() {
    if (!itemActionTarget || !actionTargetUuid || actingItemUuid) return;

    setActingItemUuid(actionTargetUuid);
    try {
      if (itemActionTarget.action === "delete") {
        await deleteItem(actionTargetUuid);
      } else {
        await cancelItem({ order_it_uuid: actionTargetUuid });
      }
      await onCartRefresh();
      showToast({ title: t("pos.itemActionSuccess"), tone: "success" });
      setItemActionTarget(null);
    } catch (error) {
      showToast({
        title: t("pos.itemActionFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setActingItemUuid(null);
    }
  }

  function openNoteDialog(item: CartItem) {
    setNoteTarget(item);
    setNoteDraft(optionalString(item.detail?.order_it_note) ?? "");
  }

  function openItemDiscountDialog(item: CartItem) {
    const value = optionalNumber(item.detail?.order_it_discount_value);
    setItemDiscountTarget(item);
    setItemDiscountDraft({
      type: normalizeDiscountType(item.detail?.order_it_discount_type),
      value: value !== null ? String(value) : "",
    });
  }

  function openBillDiscountDialog() {
    if (!hasSelectedTable) return;

    const order = orders.find((entry) => optionalString(entry.order_uuid));
    const value = optionalNumber(order?.order_discount_value);
    setBillDiscountDraft({
      type: normalizeDiscountType(order?.order_discount_type),
      value: value !== null ? String(value) : "",
    });
    setBillDiscountOpen(true);
  }

  async function saveNote() {
    const itemUuid = noteTarget ? cartItemActionUuid(noteTarget) : null;
    if (!itemUuid || actingItemUuid) return;

    setActingItemUuid(itemUuid);
    try {
      await updateNote({ order_it_uuid: itemUuid, order_it_note: noteDraft });
      await onCartRefresh();
      showToast({ title: t("pos.noteUpdated"), tone: "success" });
      setNoteTarget(null);
      setNoteDraft("");
    } catch (error) {
      showToast({
        title: t("pos.noteUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setActingItemUuid(null);
    }
  }

  async function saveItemDiscount() {
    const itemUuid = itemDiscountTarget
      ? cartItemActionUuid(itemDiscountTarget)
      : null;
    if (!itemUuid || itemDiscountValue === null || actingItemUuid) return;

    setActingItemUuid(itemUuid);
    try {
      await applyItemDiscount({
        order_item_uuid: itemUuid,
        order_it_discount_type: itemDiscountDraft.type,
        order_it_discount_value: itemDiscountValue,
      });
      await onCartRefresh();
      showToast({ title: t("pos.discountUpdated"), tone: "success" });
      setItemDiscountTarget(null);
      setItemDiscountDraft({ type: "PCT", value: "" });
    } catch (error) {
      showToast({
        title: t("pos.discountUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setActingItemUuid(null);
    }
  }

  async function saveBillDiscount() {
    if (
      !hasSelectedTable ||
      !currentOrderUuid ||
      billDiscountValue === null ||
      billDiscountPending
    )
      return;

    setBillDiscountPending(true);
    try {
      await applyBillDiscount({
        order_uuid: currentOrderUuid,
        order_discount_type: billDiscountDraft.type,
        order_discount_value: billDiscountValue,
      });
      await onCartRefresh();
      showToast({ title: t("pos.discountUpdated"), tone: "success" });
      setBillDiscountOpen(false);
      setBillDiscountDraft({ type: "PCT", value: "" });
    } catch (error) {
      showToast({
        title: t("pos.discountUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setBillDiscountPending(false);
    }
  }

  async function markItemServed(item: CartItem) {
    const itemUuid = cartItemActionUuid(item);
    if (!itemUuid || cartActionsLocked) return;

    setActingItemUuid(itemUuid);
    try {
      await confirmServed({ order_it_uuid: itemUuid });
      await onCartRefresh();
      showToast({ title: t("pos.servedUpdated"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("pos.servedUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setActingItemUuid(null);
    }
  }

  function openFullPayment() {
    if (!hasSelectedTable) return;

    setPaymentContext({
      kind: "full",
      orders,
      summary,
    });
  }

  function toggleSplitItem(item: CartItem) {
    const itemUuid = cartItemActionUuid(item);
    const itemOrderUuid = cartOrderUuidForItem(orders, item);
    if (
      !canSelectSplitItems ||
      !itemUuid ||
      !itemOrderUuid ||
      !isSplitPaymentEligibleItem(item)
    )
      return;

    setSplitSelectedItemUuids((current) => {
      const currentSelection = splitPaymentSelection(orders, current);
      if (
        !current.has(itemUuid) &&
        currentSelection?.orderUuid &&
        currentSelection.orderUuid !== itemOrderUuid
      ) {
        return new Set([itemUuid]);
      }

      const next = new Set(current);
      if (next.has(itemUuid)) {
        next.delete(itemUuid);
      } else {
        next.add(itemUuid);
      }
      return next;
    });
  }

  function requestSelectedSplitPayment() {
    if (!hasSelectedTable) return;

    if (!splitSelection) {
      showToast({ title: t("pos.splitPaymentSelectRequired"), tone: "error" });
      return;
    }
    if (!canPaySplitSelection) return;

    setPaymentContext({
      kind: "split",
      orders: splitSelection.orders,
      splitBillItemUuids: splitSelection.itemUuids,
      summary: splitSelection.summary,
    });
  }

  function handleTabChange(value: string) {
    if (!hasSelectedTable) return;

    const nextTab = value as CartTab;
    if (nextTab === activeTab) return;

    setActiveTab(nextTab);
    if (nextTab !== "history") {
      setSplitSelectedItemUuids(new Set());
    }
    void onCartRefresh().catch((error) => {
      showToast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    });
  }

  function openBrowserCustomerDisplayScreen(payload: CustomerDisplayPayload) {
    window.localStorage.setItem(
      CUSTOMER_DISPLAY_STORAGE_KEY,
      JSON.stringify(payload),
    );
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
    window.open("/customer-display", "_blank", "noopener,noreferrer");
    channel?.postMessage(payload);
    window.setTimeout(() => {
      channel?.postMessage(payload);
      channel?.close();
    }, 600);
  }

  async function refreshCustomerDisplayScreens(preferCurrent = true) {
    if (!window.electronAPI) return null;

    setCustomerDisplayLoading(true);
    setCustomerDisplayError(null);
    try {
      const info = await window.electronAPI.getDisplays();
      setCustomerDisplayInfo(info);
      setSelectedCustomerDisplayId((current) => {
        const stored = customerDisplayIdFromStorage(
          window.localStorage.getItem(CUSTOMER_DISPLAY_TARGET_STORAGE_KEY),
        );
        const preferred =
          preferCurrent && displayIsConnected(info, current)
            ? current
            : stored;
        return defaultCustomerDisplayId(info, preferred);
      });
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setCustomerDisplayError(message);
      return null;
    } finally {
      setCustomerDisplayLoading(false);
    }
  }

  async function openCustomerDisplayScreen() {
    if (!selectedTable) return;

    const payload = buildCustomerDisplayPayload({
      cart: displayCart,
      summary,
      table: selectedTable,
    });

    if (!window.electronAPI) {
      try {
        openBrowserCustomerDisplayScreen(payload);
        showToast({ title: t("pos.displayOpened"), tone: "success" });
      } catch (error) {
        showToast({
          title: t("pos.displayOpenFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      }
      return;
    }

    setCustomerDisplayPayload(payload);
    setCustomerDisplayOpen(true);
    await refreshCustomerDisplayScreens(false);
  }

  async function openSelectedCustomerDisplayScreen() {
    if (!customerDisplayPayload || selectedCustomerDisplayId === null || !window.electronAPI) return;

    setCustomerDisplayOpening(true);
    setCustomerDisplayError(null);
    try {
      const result = await window.electronAPI.openDisplay(selectedCustomerDisplayId);
      const displayId = result.displayId ?? selectedCustomerDisplayId;
      window.localStorage.setItem(CUSTOMER_DISPLAY_TARGET_STORAGE_KEY, String(displayId));
      setSelectedCustomerDisplayId(displayId);
      window.electronAPI.sendToDisplay(customerDisplayPayload);
      setCustomerDisplayInfo(await window.electronAPI.getDisplays());
      setCustomerDisplayOpen(false);
      showToast({ title: t("pos.displayOpened"), tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setCustomerDisplayError(message);
      showToast({
        title: t("pos.displayOpenFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setCustomerDisplayOpening(false);
    }
  }

  async function closeCustomerDisplayScreen() {
    if (!window.electronAPI) return;

    setCustomerDisplayOpening(true);
    setCustomerDisplayError(null);
    try {
      await window.electronAPI.closeDisplay();
      const info = await window.electronAPI.getDisplays();
      setCustomerDisplayInfo(info);
      setSelectedCustomerDisplayId((current) =>
        defaultCustomerDisplayId(
          info,
          displayIsConnected(info, current)
            ? current
            : customerDisplayIdFromStorage(
                window.localStorage.getItem(CUSTOMER_DISPLAY_TARGET_STORAGE_KEY),
              ),
        )
      );
      showToast({ title: t("pos.displayClosed"), tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setCustomerDisplayError(message);
      showToast({
        title: t("pos.displayCloseFailed"),
        description: message,
        tone: "error",
      });
    } finally {
      setCustomerDisplayOpening(false);
    }
  }

  function openEmployeeOrderPage() {
    if (!selectedTable) return;

    const params = new URLSearchParams({
      table_uuid: selectedTable.table_uuid,
      table_name: selectedTable.table_name,
    });

    router.replace(`/sale/order-customer?${params.toString()}`);
  }

  function openTableActions() {
    if (!hasSelectedTable) return;
    setTableActionsOpen(true);
  }

  function openTableQr() {
    if (!hasSelectedTable) return;
    setTableQrOpen(true);
  }

  async function handlePaymentCompleted() {
    if (paymentContext?.kind === "split") {
      setSplitSelectedItemUuids(new Set());
    }
    await onTableActionComplete();
  }

  return (
    <Card
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent text-white shadow-none",
        variant === "side"
          ? "rounded-none border-l border-primary/15"
          : "rounded-t-2xl",
      )}
    >
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="contents"
      >
        <CardHeader
          className={cn(
            "relative block shrink-0 overflow-hidden border-b border-white/10 px-4 pb-3 pt-4 text-white dark:bg-black/25",
            variant === "sheet" && "px-4 pb-2.5 pt-3 pr-12",
          )}
        >
          <div className="relative flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p
                className={cn(
                  "flex min-w-0 items-center gap-2 truncate font-black text-white",
                  variant === "sheet"
                    ? "text-[17px] leading-5"
                    : "text-[19px] leading-6",
                )}
              >
                <ReceiptText className="size-5 shrink-0" />
                <span className="truncate">
                  {selectedTable
                    ? `${t("nav.table")}: ${selectedTable.table_name}`
                    : t("pos.selectTableToContinue")}
                </span>
              </p>
              {invoice ? (
                <p className="truncate text-[11px] font-bold leading-4 text-white/75">
                  {t("pos.invoice")}: {invoice}
                </p>
              ) : null}
            </div>
            <Badge className="h-8 shrink-0 rounded-full border-white/20 bg-white/15 px-3 text-xs font-black text-white shadow-none">
              {t("common.total")}: {visibleItemCount}
            </Badge>
          </div>

          <TabsList
            className={cn(
              "pos-soft-light-zone grid w-full grid-cols-2 rounded-xl bg-white/15 p-1 text-white shadow-inner backdrop-blur-sm",
              variant === "sheet" ? "mt-2.5 h-[44px]" : "mt-3 h-[46px]",
            )}
          >
            <CartTabTrigger
              active={activeTab === "new"}
              count={newOrderItems.length}
              disabled={!hasSelectedTable}
              label={t("pos.newOrder")}
              value="new"
            />
            <CartTabTrigger
              active={activeTab === "history"}
              count={historyItems.length}
              disabled={!hasSelectedTable}
              label={t("pos.orderHistory")}
              value="history"
            />
          </TabsList>
        </CardHeader>

        <CardContent className="pos-soft-light-zone pos-dark-zone relative min-h-0 flex-1 overflow-hidden bg-background p-0 text-foreground">
          {loading ? (
            <CartPanelLoading />
          ) : (
            <div className="h-full min-h-0 overflow-y-auto bg-muted/35 dark:bg-background">
              <TabsContent value="new">
                <CartTabItems
                  editable
                  actingItemUuid={actingItemUuid}
                  actionDisabled={cartActionsLocked}
                  canConfirmKitchenItem={(item) =>
                    Boolean(
                      user?.uuid &&
                        cartItemActionUuid(item) &&
                        cartOrderUuidForItem(orders, item),
                    )
                  }
                  items={newOrderItems}
                  updatingItemUuid={updatingItemUuid}
                  onChangeQty={changeCartItemQty}
                  onConfirmKitchen={confirmSingleItemToKitchen}
                  onConfirmServed={markItemServed}
                  onEditNote={openNoteDialog}
                  onItemDiscount={openItemDiscountDialog}
                  onOpenItemAction={(action, item) =>
                    setItemActionTarget({ action, item })
                  }
                />
              </TabsContent>
              <TabsContent value="history">
                <CartTabItems
                  actingItemUuid={actingItemUuid}
                  actionDisabled={cartActionsLocked}
                  canConfirmKitchenItem={(item) =>
                    Boolean(
                      user?.uuid &&
                        cartItemActionUuid(item) &&
                        cartOrderUuidForItem(orders, item),
                    )
                  }
                  items={historyItems}
                  canSplitItem={(item) =>
                    isSplitPaymentEligibleItem(item) &&
                    Boolean(cartOrderUuidForItem(orders, item))
                  }
                  splitSelectionDisabled={!canSelectSplitItems}
                  splitSelectedItemUuids={splitSelectedItemUuids}
                  updatingItemUuid={updatingItemUuid}
                  onChangeQty={changeCartItemQty}
                  onConfirmKitchen={confirmSingleItemToKitchen}
                  onConfirmServed={markItemServed}
                  onEditNote={openNoteDialog}
                  onItemDiscount={openItemDiscountDialog}
                  onOpenItemAction={(action, item) =>
                    setItemActionTarget({ action, item })
                  }
                  onToggleSplitItem={toggleSplitItem}
                />
              </TabsContent>
            </div>
          )}
        </CardContent>

        <CardFooter className="block shrink-0 border-t border-white/15 bg-transparent px-3 py-2 text-white dark:bg-black/25">
          <CartSummaryDock
            actionsDisabled={!hasSelectedTable}
            billDiscountValueLabel={billDiscountValueLabel}
            canConfirm={canConfirm}
            canApplyBillDiscount={
              Boolean(currentOrderUuid) && !cartActionsLocked
            }
            canPay={canPayBill}
            canPaySplitSelection={canPaySplitSelection}
            compact={variant === "sheet"}
            confirming={confirming}
            discountPending={billDiscountPending}
            newOrderCount={newOrderItems.length}
            serviceLabel={serviceLabel}
            splitSelectedCount={splitSelectedCount}
            splitSelectedTotal={splitSelectedTotal}
            summary={summary}
            taxLabel={taxLabel}
            onBillDiscount={openBillDiscountDialog}
            onConfirm={() => void confirmNewOrder()}
            onCreateEmployeeOrder={
              showCreateEmployeeOrderAction ? openEmployeeOrderPage : undefined
            }
            onCreateTableQr={openTableQr}
            onCustomerDisplay={() => void openCustomerDisplayScreen()}
            onPayBill={openFullPayment}
            onPaySplitSelection={requestSelectedSplitPayment}
            onTableActions={openTableActions}
          />
        </CardFooter>
      </Tabs>
      {selectedTable ? (
        <TableActionsOverlay
          branchUuid={user?.branch_uuid}
          fallbackZones={allZones}
          language={language}
          open={tableActionsOpen}
          table={selectedTable}
          variant={variant}
          onCompleted={onTableActionComplete}
          onOpenChange={setTableActionsOpen}
        />
      ) : null}
      {selectedTable ? (
        <TableQrDialog
          open={tableQrOpen}
          table={selectedTable}
          onOpenChange={setTableQrOpen}
        />
      ) : null}
      <CustomerDisplayPickerDialog
        displayInfo={customerDisplayInfo}
        error={customerDisplayError}
        loading={customerDisplayLoading}
        open={customerDisplayOpen}
        opening={customerDisplayOpening}
        selectedDisplayId={selectedCustomerDisplayId}
        onCloseCustomerDisplay={() => void closeCustomerDisplayScreen()}
        onOpenChange={setCustomerDisplayOpen}
        onOpenSelectedDisplay={() => void openSelectedCustomerDisplayScreen()}
        onRefresh={() => void refreshCustomerDisplayScreens()}
        onSelectedDisplayChange={setSelectedCustomerDisplayId}
      />
      {selectedTable && paymentContext ? (
        <PaymentDialog
          open
          orders={paymentContext.orders}
          paymentKind={paymentContext.kind}
          splitBillItemUuids={paymentContext.splitBillItemUuids ?? []}
          summary={paymentContext.summary}
          table={selectedTable}
          onCompleted={handlePaymentCompleted}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPaymentContext(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!actionTargetUuid}
        confirmLabel={t("pos.cancelItem")}
        confirmPending={Boolean(actingItemUuid)}
        description={t("pos.cancelItemConfirm")}
        open={Boolean(itemActionTarget)}
        title={t("pos.cancelItem")}
        onConfirm={() => void confirmItemAction()}
        onOpenChange={(nextOpen) => {
          if (actingItemUuid) return;
          if (!nextOpen) setItemActionTarget(null);
        }}
      />
      <CartNoteDialog
        note={noteDraft}
        open={Boolean(noteTarget)}
        pending={Boolean(
          actingItemUuid &&
            noteTarget &&
            cartItemActionUuid(noteTarget) === actingItemUuid,
        )}
        onNoteChange={setNoteDraft}
        onOpenChange={(nextOpen) => {
          if (actingItemUuid) return;
          if (!nextOpen) setNoteTarget(null);
        }}
        onSubmit={() => void saveNote()}
      />
      <CartDiscountDialog
        draft={itemDiscountDraft}
        maxAmount={itemDiscountMaxAmount}
        open={Boolean(itemDiscountTarget)}
        pending={Boolean(
          actingItemUuid &&
            itemDiscountTarget &&
            cartItemActionUuid(itemDiscountTarget) === actingItemUuid,
        )}
        submitDisabled={itemDiscountValue === null}
        title={t("pos.itemDiscount")}
        onDraftChange={setItemDiscountDraft}
        onOpenChange={(nextOpen) => {
          if (actingItemUuid) return;
          if (!nextOpen) setItemDiscountTarget(null);
        }}
        onSubmit={() => void saveItemDiscount()}
      />
      <CartDiscountDialog
        draft={billDiscountDraft}
        maxAmount={billDiscountMaxAmount}
        open={billDiscountOpen}
        pending={billDiscountPending}
        submitDisabled={!currentOrderUuid || billDiscountValue === null}
        title={t("pos.billDiscount")}
        onDraftChange={setBillDiscountDraft}
        onOpenChange={(nextOpen) => {
          if (billDiscountPending) return;
          setBillDiscountOpen(nextOpen);
        }}
        onSubmit={() => void saveBillDiscount()}
      />
      <ConfirmAllLoadingDialog progress={confirmAllProgress} />
    </Card>
  );
}
