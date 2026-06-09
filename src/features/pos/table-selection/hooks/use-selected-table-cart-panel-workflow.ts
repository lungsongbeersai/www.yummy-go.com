"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  withCustomerDisplayOrderMode,
  withCustomerDisplayPaymentMode,
} from "@/features/customer-display/shared/customer-display-sync";
import { getBranchQrUrl } from "@/services/branch";
import type { CartItem, CartOrder, PosTable } from "@/services/pos";
import type { PrintProgress } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import type {
  CartItemAction,
  CartItemActionTarget,
  CartTab,
  ConfirmAllProgress,
  DiscountDraft,
} from "../types";
import {
  billDiscountButtonValue,
  buildCustomerDisplayPayload,
  cartDisplaySummary,
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
  pruneSelectedItemUuids,
  splitPaymentSelection,
  visibleCartItems,
} from "../utils";
import { useCustomerDisplayWorkflow } from "./use-customer-display-workflow";

type CartPanelData = CartOrder | CartOrder[] | null;

type PaymentContext = {
  kind: "full" | "split";
  orders: CartOrder[];
  splitBillItemUuids?: string[];
  summary: ReturnType<typeof cartSummary>;
};

interface UseSelectedTableCartPanelWorkflowParams {
  cart: CartPanelData;
  newOrderFocusKey?: number;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
  table: PosTable | null;
}

export function useSelectedTableCartPanelWorkflow({
  cart,
  newOrderFocusKey = 0,
  onCartRefresh,
  onTableActionComplete,
  table,
}: UseSelectedTableCartPanelWorkflowParams) {
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
  const branchQrUrl = useMemo(() => {
    const branchQr = optionalString(...orders.map((order) => order.branch_qr));
    return branchQr ? getBranchQrUrl(branchQr) : null;
  }, [orders]);
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
  const displaySummary = useMemo(
    () => cartDisplaySummary(summary, splitSelection?.summary),
    [splitSelection, summary],
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
  const currentCustomerDisplayPayload = useMemo(() => {
    if (!selectedTable) return null;

    const orderPayload = buildCustomerDisplayPayload({
      cart: displayCart,
      summary,
      table: selectedTable,
    });

    if (!paymentContext) return withCustomerDisplayOrderMode(orderPayload);

    const paymentAmount = Math.max(
      0,
      Number(
        paymentContext.kind === "full"
          ? summary.grandTotal
          : paymentContext.summary.grandTotal,
      ),
    );

    return withCustomerDisplayPaymentMode(orderPayload, {
      amount: paymentAmount,
      invoice: cartOrderInvoice(paymentContext.orders) ?? invoice,
      qrUrl: branchQrUrl,
    });
  }, [
    branchQrUrl,
    displayCart,
    invoice,
    paymentContext,
    selectedTable,
    summary,
  ]);
  const customerDisplay = useCustomerDisplayWorkflow(
    currentCustomerDisplayPayload,
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
    const eligibleUuids = splitEligibleItems.map(cartItemActionUuid);
    setSplitSelectedItemUuids((current) =>
      pruneSelectedItemUuids(current, eligibleUuids),
    );
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

  function canConfirmKitchenItem(item: CartItem) {
    return Boolean(
      user?.uuid &&
        cartItemActionUuid(item) &&
        cartOrderUuidForItem(orders, item),
    );
  }

  function canSplitItem(item: CartItem) {
    return (
      isSplitPaymentEligibleItem(item) &&
      Boolean(cartOrderUuidForItem(orders, item))
    );
  }

  function openItemAction(action: CartItemAction, item: CartItem) {
    setItemActionTarget({ action, item });
  }

  return {
    actionTargetUuid,
    activeTab,
    actingItemUuid,
    billDiscountDraft,
    billDiscountMaxAmount,
    billDiscountOpen,
    billDiscountPending,
    billDiscountValue,
    billDiscountValueLabel,
    canConfirm,
    canConfirmKitchenItem,
    canPayBill,
    canPaySplitSelection,
    canSelectSplitItems,
    canSplitItem,
    cartActionsLocked,
    changeCartItemQty,
    confirmAllProgress,
    confirming,
    confirmItemAction,
    confirmNewOrder,
    confirmSingleItemToKitchen,
    currentOrderUuid,
    customerDisplay,
    displaySummary,
    handlePaymentCompleted,
    handleTabChange,
    hasSelectedTable,
    historyItems,
    invoice,
    itemActionTarget,
    itemDiscountDraft,
    itemDiscountMaxAmount,
    itemDiscountTarget,
    itemDiscountValue,
    language,
    markItemServed,
    newOrderItems,
    noteDraft,
    noteTarget,
    openBillDiscountDialog,
    openEmployeeOrderPage,
    openFullPayment,
    openItemAction,
    openItemDiscountDialog,
    openNoteDialog,
    openTableActions,
    openTableQr,
    paymentContext,
    requestSelectedSplitPayment,
    saveBillDiscount,
    saveItemDiscount,
    saveNote,
    selectedTable,
    serviceLabel,
    setBillDiscountDraft,
    setBillDiscountOpen,
    setItemActionTarget,
    setItemDiscountDraft,
    setItemDiscountTarget,
    setNoteDraft,
    setNoteTarget,
    setPaymentContext,
    setTableActionsOpen,
    setTableQrOpen,
    splitSelectedCount,
    splitSelectedItemUuids,
    splitSelectedTotal,
    summary,
    tableActionsOpen,
    tableQrOpen,
    taxLabel,
    toggleSplitItem,
    updatingItemUuid,
    user,
    visibleItemCount,
  };
}

export type SelectedTableCartPanelWorkflow = ReturnType<
  typeof useSelectedTableCartPanelWorkflow
>;
