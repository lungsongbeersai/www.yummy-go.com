"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import {
  openLocalInvoicePrintWindow,
  type InvoicePrintData
} from "@/features/pos/print/invoice-print-window";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { toApiLanguage } from "@/lib/language";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { CancelableBill, CancelableDateOption } from "@/services/cancel";
import { getPrintInvoiceJob } from "@/services/pos";
import type { SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCancelStore } from "@/stores/cancel-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { CancelBillDialog } from "./cancel-bill-dialog";
import { SalesBillDetailPanel, SalesBillMobileSheet } from "./sales-bill-detail";
import { SalesListContent } from "./sales-list-cards";
import { SalesListHeader, SalesListPaginationFooter, SalesListToolbar } from "./sales-list-controls";
import {
  INITIAL_DATE_SELECT,
  SALES_LIST_LIMIT_OPTIONS,
  billCanCancel,
  billIsSelected,
  billUuid,
  buildSalesListInvoicePrintData,
  dateOptionValue,
  pageBounds,
  shouldOpenMobileDetail
} from "./sales-list-utils";

export function SalesListPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
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
  const printInvoice = usePosStore((state) => state.printInvoice);
  const print = usePrinterStore((state) => state.print);
  const showToast = useToastStore((state) => state.show);
  const branchUuid = user?.branch_uuid ?? "";

  const [dateSelect, setDateSelect] = useState(INITIAL_DATE_SELECT);
  const [orderBy, setOrderBy] = useState<SortOrder>("DESC");
  const { changeLimit, goToPage, limit, page, resetPage } = useUrlPagination({
    initialPagination,
    limitOptions: SALES_LIST_LIMIT_OPTIONS
  });
  const [selectedOrderUuid, setSelectedOrderUuid] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [receiptPrintingOrderUuid, setReceiptPrintingOrderUuid] = useState("");

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
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < safeTotalPages && !loading;
  const reasonInvalid = reasonTouched && !cancelReason.trim();

  const safeDateOptions = useMemo<CancelableDateOption[]>(() => {
    const options = dateOptions.length ? dateOptions : [{ date_select: INITIAL_DATE_SELECT, label: t("salesList.today") }];
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
          title: t("salesList.loadFailed"),
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

  useEffect(() => {
    if (!loading && page > safeTotalPages) goToPage(safeTotalPages);
  }, [goToPage, loading, page, safeTotalPages]);

  function resetSelection() {
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
      showToast({ title: t("salesList.cancelSuccess"), tone: "success" });
      setCancelOpen(false);
      setCancelReason("");
      setReasonTouched(false);
      resetSelection();
      await load("");
      const nextTotalPages = useCancelStore.getState().totalPages;
      if (page > nextTotalPages) goToPage(Math.max(1, nextTotalPages));
    } catch (cancelError) {
      showToast({
        title: t("salesList.cancelFailed"),
        description: cancelError instanceof Error ? cancelError.message : "",
        tone: "error"
      });
    }
  }

  async function reprintReceipt() {
    const orderUuid = billUuid(detailSource);
    if (!orderUuid || !user?.uuid || receiptPrintingOrderUuid) return;

    const fallbackData = buildSalesListInvoicePrintData({
      bill: detailSource,
      translate: (key, options) => String(t(key, options)),
      user
    });

    setReceiptPrintingOrderUuid(orderUuid);
    try {
      const response = await printInvoice({
        order_uuid: orderUuid,
        lang: toApiLanguage(language),
        login_uuid_fk: user.uuid
      });
      const job = getPrintInvoiceJob(response);

      if (!job) {
        await showReprintReceiptFallback(fallbackData, t("salesList.reprintReceiptMissingJob"));
        return;
      }

      try {
        await print(job);
      } catch (printError) {
        await showReprintReceiptFallback(
          fallbackData,
          printError instanceof Error ? printError.message : ""
        );
        return;
      }

      showToast({ title: t("salesList.reprintReceiptSuccess"), tone: "success" });
    } catch (printError) {
      await showReprintReceiptFallback(
        fallbackData,
        printError instanceof Error ? printError.message : ""
      );
    } finally {
      setReceiptPrintingOrderUuid("");
    }
  }

  async function showReprintReceiptFallback(data: InvoicePrintData, description: string) {
    const opened = await openLocalInvoicePrintWindow(data);
    if (opened) {
      showToast({
        title: t("salesList.reprintReceiptFallback"),
        description,
        tone: "info"
      });
      return;
    }

    showToast({
      title: t("salesList.reprintReceiptFailed"),
      description: t("salesList.reprintReceiptPopupBlocked"),
      tone: "error"
    });
  }

  if (!branchUuid) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SalesListHeader loading={false} onRefresh={() => undefined} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState title={t("salesList.branchRequired")} description={t("salesList.branchRequiredDescription")} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <SalesListHeader loading={loading || detailLoading} onRefresh={() => void load()} />
      <div className="grid min-h-0 flex-1 gap-3 px-3 pb-3 md:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)] lg:px-5 lg:pb-5">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
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
            canGoBack={canGoBack}
            canGoNext={canGoNext}
            loading={loading}
            page={page}
            pageEnd={rowsRange.end}
            pageStart={rowsRange.start}
            total={total}
            totalPages={safeTotalPages}
            onBack={() => goToPage(page - 1)}
            onNext={() => goToPage(Math.min(safeTotalPages, page + 1))}
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
