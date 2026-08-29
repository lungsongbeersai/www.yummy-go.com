"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  withCustomerDisplayOrderMode,
  withCustomerDisplayPaymentMode,
} from "@/features/customer-display/shared/customer-display-sync";
import { getBranchQrUrl } from "@/lib/image";
import type {
  CartItem,
  CartOrder,
  PosTable,
  SplitBillItemQuantity,
} from "@/services/pos";
import type { PrintProgress, PrinterDeviceContext } from "@/services/printer";
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
  canPayFullBill,
  cartDisplaySummary,
  cartItemsQty,
  cartItemActionUuid,
  cartItemDiscountMaxAmount,
  cartItemQty,
  cartItemUuid,
  cartOrdersBelongToTable,
  cartOrderInvoice,
  cartOrders,
  cartOrderUuidForItem,
  cartSummary,
  discountDraftValue,
  firstCartOrderUuid,
  formatRate,
  isNewOrderCartItem,
  isOrderHistoryCartItem,
  isWaitingCartItem,
  isSplitPaymentEligibleItem,
  newOrderTabItems,
  newOrderConfirmGroups,
  normalizeDiscountType,
  optionalNumber,
  optionalString,
  primaryCartOrder,
  pruneSelectedItemQuantities,
  splitPaymentSelection,
  visibleCartItems,
  type SplitItemQuantities,
} from "../utils";
import { useCustomerDisplayWorkflow } from "./use-customer-display-workflow";
import { useResetOnChange, useResetOnDeps } from "@/hooks/use-reset-on-change";

type CartPanelData = CartOrder | CartOrder[] | null;

type PaymentContext = {
  kind: "full" | "split";
  orders: CartOrder[];
  splitBillItemUuids?: SplitBillItemQuantity[];
  summary: ReturnType<typeof cartSummary>;
  tableUuid: string;
};

interface UseSelectedTableCartPanelWorkflowParams {
  cart: CartPanelData;
  newOrderFocusKey?: number;
  onCartRefresh: () => Promise<void>;
  onTableActionComplete: (nextTableUuid?: string) => Promise<void>;
  printerContext?: PrinterDeviceContext | null;
  table: PosTable | null;

}

export function useSelectedTableCartPanelWorkflow({
  cart,
  newOrderFocusKey = 0,
  onCartRefresh,
  onTableActionComplete,
  printerContext,
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
  const executeInvoice = usePrinterStore((state) => state.executeInvoice);
  const showToast = useToastStore((state) => state.show);
  const selectedTable = table?.table_uuid ? table : null;
  const hasSelectedTable = Boolean(selectedTable);
  const tableUuid = selectedTable?.table_uuid ?? "";
  // หนึ่งการชำระต้องผูกกับหนึ่ง order_uuid เท่านั้น บิลซ้ำเก่าของโต๊ะเดียวกัน
  // ห้ามถูกรวมเข้ายอดหน้าจอ เพราะ Backend จะชำระ/พิมพ์เฉพาะบิลล่าสุด
  const displayCart = useMemo(
    () => (hasSelectedTable ? primaryCartOrder(cart) : null),
    [cart, hasSelectedTable],
  );
  const orders = useMemo(() => cartOrders(displayCart), [displayCart]);
  const displayItems = useMemo(() => visibleCartItems(displayCart), [displayCart]);
  const newOrderItems = useMemo(
    () => displayItems.filter(isNewOrderCartItem),
    [displayItems],
  );
  const waitingItems = useMemo(
    () => displayItems.filter(isWaitingCartItem),
    [displayItems],
  );
  const newOrderDisplayItems = useMemo(
    () => newOrderTabItems(displayItems),
    [displayItems],
  );
  const printerAgent = usePrinterStore((state) => state.agent);
  const resolvedPrinterContext = useMemo<PrinterDeviceContext | null>(
    () =>
      printerAgent?.device_code
        ? {
            device_code: printerAgent.device_code,
            agent_id: printerAgent.agent_id,
            agent_name: printerAgent.agent_name,
            print_mode: undefined,
          }
        : null,
    [printerAgent],
  );
  const activePrinterContext = printerContext ?? resolvedPrinterContext;
  const historyItems = useMemo(
    () => displayItems.filter(isOrderHistoryCartItem),
    [displayItems],
  );
  const summary = useMemo(() => cartSummary(displayCart), [displayCart]);
  const confirmGroups = useMemo(() => newOrderConfirmGroups(orders), [orders]);
  const preferredTab: CartTab =
    newOrderDisplayItems.length || !historyItems.length ? "new" : "history";
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
  const [quantityTarget, setQuantityTarget] = useState<CartItem | null>(null);
  // ref ไม่ใช่ state เพราะไม่ต้องมีผลกับการ render ใดๆ — ใช้แค่ฝากค่าข้ามไปให้ effect ที่ตรวจ
  // cart รอบถัดไปอ่าน ถ้าเป็น state จะโดน lint react-hooks/set-state-in-effect ตอน clear ค่าทิ้ง
  const pendingQuantityCheckRef = useRef<{
    itemUuid: string;
    requestedQty: number;
    trackedAt: number;
  } | null>(null);
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
  const [splitSelectedItemUuids, setSplitSelectedItemUuids] =
    useState<SplitItemQuantities>(() => new Map());
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
  const visibleItemCount =
    summary.orderQty ?? cartItemsQty(displayItems);
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
    canPayFullBill({
      currentOrderUuid,
      grandTotal: summary.grandTotal,
      historyItemCount: historyItems.length,
      newOrderItemCount: newOrderItems.length,
      waitingItemCount: waitingItems.length,
    }) &&
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
  const quantityPending = Boolean(
    quantityTarget && updatingItemUuid === cartItemUuid(quantityTarget),
  );
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
      if (current === "history" && !historyItems.length) return preferredTab;
      if (current === "new" && !newOrderDisplayItems.length) return preferredTab;
      return current;
    });
  }, [
    historyItems.length,
    newOrderDisplayItems.length,
    preferredTab,
    tableUuid,
  ]);

  useEffect(() => {
    if (!hasSelectedTable) return;
    if (previousNewOrderFocusKeyRef.current === newOrderFocusKey) return;

    previousNewOrderFocusKeyRef.current = newOrderFocusKey;

    setActiveTab("new");
    setSplitSelectedItemUuids((current) =>
      current.size ? new Map() : current,
    );
  }, [hasSelectedTable, newOrderFocusKey]);

  // เปลี่ยนโต๊ะ = ทิ้ง dialog / ค่าดราฟต์ / รายการที่เลือกของโต๊ะเดิมทั้งหมด
  // ทำระหว่าง render แทน effect เพื่อไม่ให้ commit เฟรมที่ยังถือ state ของโต๊ะเก่า
  // (เฟรมนั้นจะดัน payload ของโต๊ะเก่าออกจอลูกค้าไปหนึ่งครั้งก่อนถูกล้าง)
  useResetOnChange(tableUuid, () => {
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
    setSplitSelectedItemUuids(new Map());
    setConfirmAllProgress(null);
  });

  // ออกจากแท็บประวัติ = ทิ้งรายการที่ติ๊กไว้สำหรับแยกบิล เพราะเลือกได้เฉพาะแท็บประวัติ
  useResetOnChange(activeTab, () => {
    if (activeTab === "history") return;

    setSplitSelectedItemUuids((current) =>
      current.size ? new Map() : current,
    );
  });

  // ล้างรายการชำระเงินที่ค้างไว้ทันทีที่มันไม่ตรงกับโต๊ะ/ออเดอร์ปัจจุบันแล้ว
  // ตรวจระหว่าง render เพื่อไม่ให้มีเฟรมที่หน้าจ่ายเงินยังอ้างออเดอร์ผิดโต๊ะ
  // ลู่เข้าเสมอ: หลัง setPaymentContext(null) รอบถัดไปจะ return ตั้งแต่บรรทัดแรก
  useResetOnDeps([paymentContext, selectedTable], () => {
    if (!paymentContext || !selectedTable) return;
    if (
      paymentContext.tableUuid === selectedTable.table_uuid &&
      cartOrdersBelongToTable(paymentContext.orders, selectedTable)
    )
      return;

    setPaymentContext(null);
  });

  // ตัดรายการที่ติ๊กไว้แต่หลุดจากบิลไปแล้วออก (และ clamp จำนวนถ้ารายการถูกแก้จำนวนจากที่อื่น)
  // pruneSelectedItemQuantities คืน Map เดิมถ้าไม่มีอะไรเปลี่ยน จึงไม่เกิด render ซ้ำโดยไม่จำเป็น
  useResetOnChange(splitEligibleItems, () => {
    setSplitSelectedItemUuids((current) =>
      pruneSelectedItemQuantities(current, splitEligibleItems),
    );
  });

  // changeQty เป็น delta ที่มีเครื่องหมาย (เช่น -3/+3 สำหรับก้าวโปรโมชั่น หรือ ±1 ปุ่มปกติ)
  // backend รองรับ change_qty มากกว่า 1 ต่อครั้งอยู่แล้ว จึงยิงทีเดียวถึงจำนวนเป้าหมายได้
  // คืนค่า boolean เพื่อให้ผู้เรียก (เช่น modal แก้จำนวน) รู้ว่าจะปิด dialog ได้หรือต้องค้างไว้ให้ลองใหม่
  async function changeCartItemQty(item: CartItem, changeQty: number) {
    const itemUuid = cartItemUuid(item);
    if (!itemUuid || cartActionsLocked || changeQty === 0) return false;

    setUpdatingItemUuid(itemUuid);
    try {
      await updateQty({
        order_item_uuid: itemUuid,
        change_type: changeQty > 0 ? "INCREASE" : "DECREASE",
        change_qty: Math.abs(changeQty),
      });
      // เช็คสต็อกได้แค่ตอนเพิ่มจำนวน — ลดจำนวนไม่มีทางชนเพดานสต็อก และถ้าเทียบด้วยจะพลาดโทษสต็อก
      // ผิดให้กรณีอื่น เช่นเครื่องอื่นแก้ไอเทมเดียวกันพร้อมกันจนได้ค่าน้อยกว่าที่เครื่องนี้ขอลด
      if (changeQty > 0) {
        pendingQuantityCheckRef.current = {
          itemUuid,
          requestedQty: cartItemQty(item) + changeQty,
          trackedAt: Date.now(),
        };
      }
      await onTableActionComplete();
      return true;
    } catch (error) {
      // onTableActionComplete ล้มเหลวหลัง updateQty สำเร็จ = cart ที่รีเฟรชจริงยังไม่มาถึง แต่ ref
      // ถูกตั้งไปแล้ว — เคลียร์ทิ้งกันไม่ให้ effect เอาไปเทียบกับ cart ที่รีเฟรชด้วยเหตุผลอื่นทีหลัง
      pendingQuantityCheckRef.current = null;
      showToast({
        title: t("pos.cartUpdateFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
      return false;
    } finally {
      setUpdatingItemUuid(null);
    }
  }

  // รอ cart รีเฟรชจริงก่อนค่อยเทียบ — ตอน changeCartItemQty resolve เองยังเห็น cart ค่าเก่าของ
  // render รอบนี้อยู่ (prop ใหม่มาถึงตอน re-render เท่านั้น) ใช้ effect แทน useResetOnChange เพราะ
  // นี่คือ side effect ที่มองเห็นได้ (โชว์ toast) ต้องรันหลัง commit จริง ไม่ใช่ระหว่าง render
  useEffect(() => {
    const pending = pendingQuantityCheckRef.current;
    if (!pending) return;

    pendingQuantityCheckRef.current = null;
    // เกิน 15 วิ ถือว่า refresh ของ request เดิมหลุดไปแล้ว ไม่เอามาเทียบกับ cart ที่รีเฟรชด้วยเหตุผลอื่น
    if (Date.now() - pending.trackedAt > 15_000) return;

    const matchedItem = displayItems.find(
      (entry) => cartItemUuid(entry) === pending.itemUuid,
    );
    const actualQty = matchedItem ? cartItemQty(matchedItem) : null;
    if (actualQty !== null && actualQty < pending.requestedQty) {
      showToast({
        title: t("pos.cartQuantityAdjusted"),
        description: t("pos.cartQuantityAdjustedDescription", {
          requested: pending.requestedQty,
          actual: actualQty,
        }),
        tone: "info",
      });
    }
  }, [displayItems, showToast, t]);

  function openQuantityDialog(item: CartItem) {
    setQuantityTarget(item);
  }

  async function submitQuantityChange(newQty: number) {
    if (!quantityTarget) return;

    const delta = newQty - cartItemQty(quantityTarget);
    if (delta === 0) {
      setQuantityTarget(null);
      return;
    }

    const success = await changeCartItemQty(quantityTarget, delta);
    if (success) setQuantityTarget(null);
  }

  async function executeKitchenAck(
    response: Awaited<ReturnType<typeof confirmKitchen>>,
    fallbackLoginUuid: string,
    printerCtx?: PrinterDeviceContext | null,
    onProgress?: (progress: PrintProgress) => void,
  ) {
    const printJob = response.print_job;
    const printJobUuid = optionalString(
      printJob?.print_job_uuid,
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
      print_job: printJob,
      pending_query: response.pending_query,
      login_uuid_fk: loginUuid,
      device_code: printerCtx?.device_code,
      agent_id: printerCtx?.agent_id,
      print_mode: printerCtx?.print_mode,
      onProgress,
    });
  }

  // ใบเสร็จยกเลิก: พิมพ์ผ่าน executeInvoice (ack:false) ไม่ใช่ executeKitchen (ack:true) —
  // cancel_order_item เปลี่ยนสถานะ order item เสร็จตั้งแต่ตัว PATCH เอง ใบเสร็จที่พิมพ์ตามมา
  // เป็นแค่เอกสารพิสูจน์ ไม่ใช่ trigger ปิดงานแบบใบสั่งครัว จึงพิมพ์ไม่สำเร็จก็ไม่ throw
  // (ไม่ทำให้การยกเลิกที่สำเร็จแล้วดูเหมือนล้มเหลว) แค่รายงานผลกลับไปให้ toast รอง
  async function executeCancelReceiptPrint(
    response: Awaited<ReturnType<typeof cancelItem>>,
    fallbackLoginUuid: string,
    printerCtx?: PrinterDeviceContext | null,
  ) {
    const printJob = response.print_job;
    const printJobUuid = optionalString(
      printJob?.print_job_uuid,
      response.pending_query?.print_job_uuid,
    );
    if (!printJobUuid) return { successCount: 0, failedCount: 0, total: 0 };

    const loginUuid = optionalString(
      response.pending_query?.login_uuid_fk,
      fallbackLoginUuid,
    );
    if (!loginUuid) return { successCount: 0, failedCount: 0, total: 0 };

    return executeInvoice({
      print_job: printJob,
      pending_query: response.pending_query,
      login_uuid_fk: loginUuid,
      device_code: printerCtx?.device_code,
      agent_id: printerCtx?.agent_id,
      print_mode: printerCtx?.print_mode,
    });
  }

  // Backend รับคำขอได้ไม่ได้แปลว่า REQUIRED print สำเร็จแล้ว สถานะ order item
  // จะยังค้างจน ACK ครบ จึงห้ามแสดงข้อความยืนยันสำเร็จเมื่อพิมพ์พลาดหรือยังรอ owner device.
  function showKitchenConfirmResult(result: {
    successCount: number;
    failedCount: number;
    total: number;
    errorMessage?: string;
    pending?: boolean;
  }) {
    if (result.failedCount > 0) {
      showToast({
        title: t("pos.orderConfirmFailed"),
        description: [
          `${t("report.printFailed")} ${result.failedCount}/${result.total || result.failedCount}`,
          result.errorMessage,
        ]
          .filter(Boolean)
          .join(" — "),
        tone: "error",
      });
      return;
    }

    if (result.pending) {
      showToast({ title: t("orderQueue.kitchenPrintQueued"), tone: "info" });
      return;
    }

    showToast({ title: t("pos.orderConfirmed"), tone: "success" });
  }

  async function confirmNewOrder() {
    if (!user?.uuid || !confirmGroups.length || cartActionsLocked) return;

    setConfirming(true);
    try {
      const printResult: {
        successCount: number;
        failedCount: number;
        total: number;
        errorMessage?: string;
        pending?: boolean;
      } = { successCount: 0, failedCount: 0, total: 0, pending: false };
      const confirmItemTotal = confirmGroups.reduce(
        (sum, group) => sum + group.itemUuids.length,
        0,
      );
      let confirmedItems = 0;

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
        confirmItemTotal,
        t("pos.confirmAllPreparing"),
      );

      for (const group of confirmGroups) {
        setProgress(
          confirmedItems,
          confirmItemTotal,
          t("pos.confirmAllConfirming"),
        );
        const response = await confirmKitchen({
          order_uuid: group.orderUuid,
          login_uuid_fk: user.uuid,
          order_item_uuids: group.itemUuids,
          device_code: activePrinterContext?.device_code,
          agent_id: activePrinterContext?.agent_id,
          print_mode: activePrinterContext?.print_mode,
        });
        confirmedItems += group.itemUuids.length;

        const result = await executeKitchenAck(
          response,
          user.uuid,
          activePrinterContext,
          (progress) => {
            const label =
              progress.phase === "fetching"
                ? t("pos.confirmAllFetchingPrintJobs")
                : t("pos.confirmAllPrinting");

            setProgress(
              confirmedItems,
              confirmItemTotal,
              label,
            );
          },
        );
        printResult.successCount += result.successCount;
        printResult.failedCount += result.failedCount;
        printResult.total += result.total;
        printResult.pending = printResult.pending || result.pending === true;
        if (result.errorMessage) printResult.errorMessage = result.errorMessage;
      }

      setProgress(
        confirmedItems,
        confirmItemTotal,
        t("pos.confirmAllRefreshing"),
      );
      await onTableActionComplete();
      setProgress(
        confirmItemTotal,
        confirmItemTotal,
        t("pos.confirmAllDone"),
      );
      showKitchenConfirmResult(printResult);
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
        device_code: activePrinterContext?.device_code,
        agent_id: activePrinterContext?.agent_id,
        print_mode: activePrinterContext?.print_mode,
      });
      const result = await executeKitchenAck(response, user.uuid, activePrinterContext);
      await onCartRefresh();
      showKitchenConfirmResult(result);
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

  async function confirmItemAction(cancelQuantity?: number) {
    if (!itemActionTarget || !actionTargetUuid || actingItemUuid) return;

    setActingItemUuid(actionTargetUuid);
    try {
      const successKey = itemActionTarget.action === "delete" ? "pos.itemActionSuccess" : "pos.itemCancelSuccess";
      let cancelPrintResult: { successCount: number; failedCount: number; total: number; errorMessage?: string } | null = null;
      if (itemActionTarget.action === "delete") {
        await deleteItem(actionTargetUuid);
      } else {
        const availableQuantity = cartItemQty(itemActionTarget.item);
        if (
          !Number.isInteger(cancelQuantity) ||
          Number(cancelQuantity) < 1 ||
          Number(cancelQuantity) > availableQuantity
        ) {
          throw new Error(
            t("pos.cancelItemQuantityHelp", { max: availableQuantity }),
          );
        }
        const response = await cancelItem({
          order_it_uuid: actionTargetUuid,
          order_it_qty: Number(cancelQuantity),
          login_uuid_fk: user?.uuid,
        });
        cancelPrintResult = await executeCancelReceiptPrint(response, user?.uuid ?? "", activePrinterContext);
      }
      await onTableActionComplete();
      showToast({ title: t(successKey), tone: "success" });
      if (cancelPrintResult && cancelPrintResult.failedCount > 0) {
        showToast({
          title: t("report.printFailed"),
          description: [
            `${cancelPrintResult.failedCount}/${cancelPrintResult.total || cancelPrintResult.failedCount}`,
            cancelPrintResult.errorMessage,
          ]
            .filter(Boolean)
            .join(" — "),
          tone: "info",
        });
      }
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
      type: normalizeDiscountType(item.detail?.order_it_discount_type, value),
      value: value !== null ? String(value) : "",
    });
  }

  function openBillDiscountDialog() {
    if (!hasSelectedTable) return;

    const order = orders.find((entry) => optionalString(entry.order_uuid));
    const value = optionalNumber(order?.order_discount_value);
    setBillDiscountDraft({
      type: normalizeDiscountType(order?.order_discount_type, value),
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
    if (!selectedTable) return;

    if (!cartOrdersBelongToTable(orders, selectedTable)) {
      showToast({ title: t("pos.paymentMissingOrder"), tone: "error" });
      return;
    }

    setPaymentContext({
      kind: "full",
      orders,
      summary,
      tableUuid: selectedTable.table_uuid,
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
        return new Map([[itemUuid, cartItemQty(item)]]);
      }

      const next = new Map(current);
      if (next.has(itemUuid)) {
        next.delete(itemUuid);
      } else {
        // ค่าเริ่มต้นตอนติ๊กเลือก = จำนวนเต็มของรายการ ผู้ใช้ค่อยลดด้วย stepper
        // ถ้าต้องการแยกจ่ายแค่บางส่วน (เช่น เบียร์ 10 ขวด จ่ายก่อน 2 ขวด)
        next.set(itemUuid, cartItemQty(item));
      }
      return next;
    });
  }

  function setSplitItemQuantity(item: CartItem, quantity: number) {
    const itemUuid = cartItemActionUuid(item);
    if (!canSelectSplitItems || !itemUuid) return;

    const fullQty = cartItemQty(item);
    const clamped = Math.min(Math.max(Math.round(quantity), 1), fullQty);

    setSplitSelectedItemUuids((current) => {
      if (!current.has(itemUuid) || current.get(itemUuid) === clamped)
        return current;
      const next = new Map(current);
      next.set(itemUuid, clamped);
      return next;
    });
  }

  function requestSelectedSplitPayment() {
    if (!selectedTable) return;

    if (!splitSelection) {
      showToast({ title: t("pos.splitPaymentSelectRequired"), tone: "error" });
      return;
    }
    if (!canPaySplitSelection) return;
    if (!cartOrdersBelongToTable(splitSelection.orders, selectedTable)) {
      showToast({ title: t("pos.paymentMissingOrder"), tone: "error" });
      return;
    }

    setPaymentContext({
      kind: "split",
      orders: splitSelection.orders,
      splitBillItemUuids: splitSelection.orderItemUuids,
      summary: splitSelection.summary,
      tableUuid: selectedTable.table_uuid,
    });
  }

  function handleTabChange(value: string) {
    if (!hasSelectedTable) return;

    const nextTab = value as CartTab;
    if (nextTab === activeTab) return;

    setActiveTab(nextTab);
    if (nextTab !== "history") {
      setSplitSelectedItemUuids(new Map());
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

    router.replace(`/pos/order?${params.toString()}`);
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
      setSplitSelectedItemUuids(new Map());
    } else if (paymentContext?.kind === "full" && user?.store_table_status === 2) {
      // ร้านไม่มีโต๊ะ: จ่ายเงินเต็มบิลแล้ว เลิกยึด order_uuid เดิม รอบถัดไปเปิดบิลใหม่
      // (split ยังไม่เคลียร์ เพราะอาจเหลือรายการค้างจ่ายอยู่ใน order เดียวกัน)
      usePosStore.getState().setCounterOrderUuid("");
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
    newOrderDisplayItems,
    newOrderItems,
    noteDraft,
    noteTarget,
    openBillDiscountDialog,
    openEmployeeOrderPage,
    openFullPayment,
    openItemAction,
    openItemDiscountDialog,
    openNoteDialog,
    openQuantityDialog,
    openTableActions,
    openTableQr,
    paymentContext,
    quantityPending,
    quantityTarget,
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
    setQuantityTarget,
    setSplitItemQuantity,
    setTableActionsOpen,
    setTableQrOpen,
    splitSelectedCount,
    splitSelectedItemUuids,
    splitSelectedTotal,
    submitQuantityChange,
    summary,
    tableActionsOpen,
    tableQrOpen,
    taxLabel,
    toggleSplitItem,
    updatingItemUuid,
    user,
    visibleItemCount,
    waitingItems,
  };
}

export type SelectedTableCartPanelWorkflow = ReturnType<
  typeof useSelectedTableCartPanelWorkflow
>;
