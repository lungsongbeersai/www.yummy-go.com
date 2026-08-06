"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import {
  openLocalInvoicePrintWindow,
  type InvoicePrintData
} from "@/services/printer/invoice-print-window";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { CancelableBill, CancelableDateOption } from "@/services/cancel";
import type { SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCancelStore } from "@/stores/cancel-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { CancelBillDialog } from "./cancel-bill-dialog";
import { SalesBillDetailPanel, SalesBillMobileSheet } from "./sales-bill-detail";
import { SalesListContent } from "./cancel-sale-cards";
import { SalesListHeader, SalesListPaginationFooter, SalesListToolbar } from "./cancel-sale-controls";
import {
  INITIAL_DATE_SELECT,
  SALES_LIST_LIMIT_OPTIONS,
  billCanCancel,
  billIsSelected,
  billUuid,
  buildSalesListInvoicePrintData,
  dateOptionValue,
  pageBounds,
  shouldOpenInitialCancelDialog,
  shouldOpenMobileDetail
} from "./cancel-sale-utils";

export function CancelSalePage({
  initialDateSelect = INITIAL_DATE_SELECT,
  initialOrderUuid = "",
  initialPagination
}: {
  initialDateSelect?: string;
  initialOrderUuid?: string;
  initialPagination: UrlPaginationState;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const bills = useCancelStore((state) => state.bills);
  const dateOptions = useCancelStore((state) => state.dateOptions);
  const loading = useCancelStore((state) => state.loading);
  const detailLoading = useCancelStore((state) => state.detailLoading);
  const cancelling = useCancelStore((state) => state.cancelling);
  const error = useCancelStore((state) => state.error);
  const selectedBill = useCancelStore((state) => state.selectedBill);
  const total = useCancelStore((state) => state.total);
  const totalPages = useCancelStore((state) => state.totalPages);
  const loadBills = useCancelStore((state) => state.load);
  const cancelBill = useCancelStore((state) => state.cancelBill);
  const clearSelectedBill = useCancelStore((state) => state.clearSelectedBill);
  const resetBills = useCancelStore((state) => state.reset);
  const requestReprintReceipt = usePosStore((state) => state.reprintReceipt);
  const executeInvoice = usePrinterStore((state) => state.executeInvoice);
  const showToast = useToastStore((state) => state.show);
  const branchUuid = user?.branch_uuid ?? "";

  const [dateSelect, setDateSelect] = useState(initialDateSelect);
  const [orderBy, setOrderBy] = useState<SortOrder>("DESC");
  const { changeLimit, goToPage, limit, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: SALES_LIST_LIMIT_OPTIONS
  });
  const [selectedOrderUuid, setSelectedOrderUuid] = useState(initialOrderUuid);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [receiptPrintingOrderUuid, setReceiptPrintingOrderUuid] = useState("");
  const [initialCancelHandled, setInitialCancelHandled] = useState(false);

  const selectedListBill = useMemo(
    () => bills.find((bill) => billIsSelected(bill, selectedOrderUuid) || billUuid(bill) === selectedOrderUuid),
    [bills, selectedOrderUuid]
  );
  const detailSource = selectedBill ?? selectedListBill ?? null;
  const detailOrderUuid = billUuid(detailSource);
  const detailCanCancel = billCanCancel(selectedBill, selectedListBill);
  const cancelOrderUuid = detailOrderUuid;
  const canReprintReceipt = Boolean(detailOrderUuid && user?.uuid && !receiptPrintingOrderUuid);
  const reprintingReceipt = Boolean(detailOrderUuid && receiptPrintingOrderUuid === detailOrderUuid);
  const rowsRange = pageBounds(page, limit, bills.length, total);
  const safeTotalPages = Math.max(1, totalPages);
  const reasonInvalid = reasonTouched && !cancelReason.trim();

  const safeDateOptions = useMemo<CancelableDateOption[]>(() => {
    const options = dateOptions.length ? dateOptions : [{ date_select: INITIAL_DATE_SELECT, label: t("cancelSale.today") }];
    const selectedExists = options.some((option) => dateOptionValue(option) === dateSelect);
    return selectedExists ? options : [{ date_select: dateSelect, label: dateSelect }, ...options];
  }, [dateOptions, dateSelect, t]);

  const load = useCallback(
    async (nextSelectedOrderUuid = selectedOrderUuid) => {
      if (!branchUuid) {
        resetBills();
        return;
      }
      try {
        await loadBills({
          branch_uuid_fk: branchUuid,
          date_select: dateSelect,
          lang: language,
          limit,
          orderBy,
          page,
          selected_order_uuid: nextSelectedOrderUuid || undefined
        });
      } catch (loadError) {
        showToast({
          title: t("cancelSale.loadFailed"),
          description: loadError instanceof Error ? loadError.message : "",
          tone: "error"
        });
      }
    },
    [branchUuid, dateSelect, language, limit, loadBills, orderBy, page, resetBills, selectedOrderUuid, showToast, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // ข้อมูลหดลงจนหน้าปัจจุบันเกินช่วง = ดึงกลับมาหน้าสุดท้ายที่มีจริง
  useResetOnDeps([loading, page, safeTotalPages], () => {
    if (!loading && page > safeTotalPages) goToPage(safeTotalPages);
  });

  useResetOnDeps([
    detailCanCancel,
    detailLoading,
    detailOrderUuid,
    error,
    initialCancelHandled,
    initialOrderUuid,
  ], () => {
    if (!shouldOpenInitialCancelDialog({
      alreadyHandled: initialCancelHandled,
      detailLoading,
      detailOrderUuid,
      error,
      initialOrderUuid,
    })) return;

    setInitialCancelHandled(true);
    if (!detailCanCancel) return;

    setCancelReason("");
    setReasonTouched(false);
    setCancelOpen(true);
  });

  function resetSelection() {
    setInitialCancelHandled(true);
    setMobileDetailOpen(false);
    setSelectedOrderUuid("");
    clearSelectedBill();
  }

  function updateDate(value: string) {
    setDateSelect(value);
    resetPage();
    resetSelection();
  }

  function updateLimit(value: string) {
    changeLimit(Number(value));
    resetSelection();
  }

  function updateOrder(value: SortOrder) {
    setOrderBy(value);
    resetPage();
    resetSelection();
  }

  function selectBill(bill: CancelableBill) {
    const uuid = billUuid(bill);
    if (!uuid) return;
    if (uuid !== initialOrderUuid) setInitialCancelHandled(true);
    setSelectedOrderUuid(uuid);
    setMobileDetailOpen(shouldOpenMobileDetail());
  }

  function openCancelDialog() {
    if (!cancelOrderUuid || !detailCanCancel) return;
    setCancelReason("");
    setReasonTouched(false);
    setCancelOpen(true);
  }

  async function submitCancel() {
    setReasonTouched(true);
    const reason = cancelReason.trim();
    if (!cancelOrderUuid || !reason || cancelling) return;

    try {
      await cancelBill({ order_uuid: cancelOrderUuid, order_cancel_reason: reason });
      showToast({ title: t("cancelSale.cancelSuccess"), tone: "success" });
      setCancelOpen(false);
      setCancelReason("");
      setReasonTouched(false);
      resetSelection();
      await load("");
      const nextTotalPages = useCancelStore.getState().totalPages;
      if (page > nextTotalPages) goToPage(Math.max(1, nextTotalPages));
    } catch (cancelError) {
      showToast({
        title: t("cancelSale.cancelFailed"),
        description: cancelError instanceof Error ? cancelError.message : "",
        tone: "error"
      });
    }
  }

  async function reprintReceipt() {
    const orderUuid = billUuid(detailSource);
    if (!orderUuid || !user?.uuid || receiptPrintingOrderUuid) return;

    setReceiptPrintingOrderUuid(orderUuid);
    try {
      const pendingQuery = await requestReprintReceipt({
        order_uuid: orderUuid,
        login_uuid_fk: user.uuid,
        lang: language
      });

      if (!pendingQuery) {
        showToast({
          title: t("cancelSale.reprintReceiptFailed"),
          description: t("cancelSale.reprintReceiptMissingJob"),
          tone: "error"
        });
        return;
      }

      let printStarted = false;
      const printResult = await executeInvoice({
        pending_query: pendingQuery,
        login_uuid_fk: user.uuid,
        onProgress: ({ phase }) => {
          if (phase === "printing") printStarted = true;
        }
      });

      if (printResult.successCount > 0 && printResult.failedCount === 0) {
        showToast({ title: t("cancelSale.reprintReceiptSuccess"), tone: "success" });
        return;
      }

      if (printResult.total === 0) {
        showToast({
          title: t("cancelSale.reprintReceiptFailed"),
          description: t("cancelSale.reprintReceiptMissingJob"),
          tone: "error"
        });
        return;
      }

      if (printResult.failedCount > 0 && printStarted && !isCapacitorNativeApp()) {
        const receiptData = buildSalesListInvoicePrintData({
          bill: detailSource,
          translate: (key, options) => String(t(key, options)),
          user
        });
        await openReceiptPrintWindow(receiptData, "");
        return;
      }

      showToast({ title: t("cancelSale.reprintReceiptFailed"), tone: "error" });
    } catch (printError) {
      showToast({
        title: t("cancelSale.reprintReceiptFailed"),
        description: printError instanceof Error ? printError.message : "",
        tone: "error"
      });
    } finally {
      setReceiptPrintingOrderUuid("");
    }
  }

  async function openReceiptPrintWindow(data: InvoicePrintData, description: string) {
    const opened = await openLocalInvoicePrintWindow(data);
    if (opened) {
      showToast({
        title: t("cancelSale.reprintReceiptFallback"),
        description,
        tone: "info"
      });
      return;
    }

    showToast({
      title: t("cancelSale.reprintReceiptFailed"),
      description: t("cancelSale.reprintReceiptPopupBlocked"),
      tone: "error"
    });
  }

  if (!branchUuid) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SalesListHeader loading={false} onRefresh={() => undefined} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState title={t("cancelSale.branchRequired")} description={t("cancelSale.branchRequiredDescription")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <SalesListHeader loading={loading || detailLoading} onRefresh={() => void load()} />
      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-none border-0 border-border bg-card md:border-r">
          <SalesListToolbar
            dateOptions={safeDateOptions}
            dateSelect={dateSelect}
            limit={limit}
            orderBy={orderBy}
            onDateChange={updateDate}
            onLimitChange={updateLimit}
            onOrderChange={updateOrder}
          />
          <SalesListContent
            bills={bills}
            error={error}
            loading={loading}
            selectedOrderUuid={selectedOrderUuid}
            onSelect={selectBill}
          />
          <SalesListPaginationFooter
            loading={loading}
            page={page}
            pageEnd={rowsRange.end}
            pageStart={rowsRange.start}
            total={total}
            totalPages={safeTotalPages}
            onPageChange={goToPage}
          />
        </section>

        <SalesBillDetailPanel
          bill={detailSource}
          canCancel={detailCanCancel}
          canReprintReceipt={canReprintReceipt}
          loading={detailLoading}
          reprintingReceipt={reprintingReceipt}
          onCancel={openCancelDialog}
          onReprintReceipt={() => void reprintReceipt()}
        />
      </div>

      <SalesBillMobileSheet
        bill={detailSource}
        canCancel={detailCanCancel}
        canReprintReceipt={canReprintReceipt}
        loading={detailLoading}
        open={mobileDetailOpen}
        reprintingReceipt={reprintingReceipt}
        onCancel={openCancelDialog}
        onOpenChange={setMobileDetailOpen}
        onReprintReceipt={() => void reprintReceipt()}
      />

      <CancelBillDialog
        bill={detailSource}
        cancelling={cancelling}
        open={cancelOpen}
        reason={cancelReason}
        reasonInvalid={reasonInvalid}
        onOpenChange={setCancelOpen}
        onReasonBlur={() => setReasonTouched(true)}
        onReasonChange={setCancelReason}
        onSubmit={() => void submitCancel()}
      />
    </div>
  );
}
