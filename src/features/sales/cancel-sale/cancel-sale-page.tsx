"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDocumentLogo } from "@/features/printer/use-document-logo";
import { buildBrowserDocumentPrintData } from "@/features/printer/browser-document-print";
import { documentPrinterFailureKind } from "@/features/pos/table-selection/queued-document-print";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { PrintLoadingDialog } from "@/components/common/print-loading-dialog";
import {
  openLocalInvoicePrintWindow,
  reserveLocalInvoicePrintWindow,
  type InvoicePrintData,
  type LocalInvoicePrintWindowReservation
} from "@/services/printer/invoice-print-window";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { canUseWindowOpen } from "@/lib/capacitor-platform";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import { canUseSystemPrintFallback } from "@/lib/system-print-capability";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { CancelableBill } from "@/services/cancel";
import type { SortOrder } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCancelStore } from "@/stores/cancel-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { CancelBillDialog } from "./cancel-bill-dialog";
import { SalesBillDetailDrawer, SalesBillDetailPanel } from "./sales-bill-detail";
import { SalesBillListPanel } from "./cancel-sale-cards";
import { SalesListToolbar } from "./cancel-sale-controls";
import {
  INITIAL_DATE_SELECT,
  SALES_LIST_LIMIT_OPTIONS,
  billCanCancel,
  billIsSelected,
  billUuid,
  cancelDateChoices,
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
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const documentLogo = useDocumentLogo(Boolean(detailOrderUuid) && (isDesktop || mobileDetailOpen), user?.uuid, selectedOrderUuid || detailOrderUuid, "receipt");
  const detailCanCancel = billCanCancel(selectedBill, selectedListBill);
  const cancelOrderUuid = detailOrderUuid;
  const canReprintReceipt = Boolean(detailOrderUuid && user?.uuid && !receiptPrintingOrderUuid);
  const reprintingReceipt = Boolean(detailOrderUuid && receiptPrintingOrderUuid === detailOrderUuid);
  const rowsRange = pageBounds(page, limit, bills.length, total);
  const safeTotalPages = Math.max(1, totalPages);
  const reasonInvalid = reasonTouched && !cancelReason.trim();

  const dateChoices = useMemo(() => {
    const choices = cancelDateChoices(dateOptions, {
      today: t("cancelSale.today"),
      yesterday: t("cancelSale.yesterday")
    });
    return choices.some((choice) => choice.value === dateSelect)
      ? choices
      : [{ value: dateSelect, label: dateSelect }, ...choices];
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

    const canOpenBrowserPrint = canUseWindowOpen() && canUseSystemPrintFallback();
    const browserPrintWindow = canOpenBrowserPrint && usePrinterStore.getState().agentStatus !== "connected"
      ? reserveLocalInvoicePrintWindow()
      : null;
    let physicalJobPrepared = false;
    setReceiptPrintingOrderUuid(orderUuid);
    try {
      const pendingQuery = await requestReprintReceipt({
        order_uuid: orderUuid,
        operation_uuid: createMutationUuid(),
        login_uuid_fk: user.uuid,
        ...(typeof documentLogo.showLogo === "boolean" ? { show_logo: documentLogo.showLogo } : {}),
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

      physicalJobPrepared = true;
      const printResult = await executeInvoice({
        pending_query: pendingQuery,
        login_uuid_fk: user.uuid
      });

      if (printResult.failedCount > 0) {
        showToast({
          title: t("cancelSale.reprintReceiptFailed"),
          description: printResult.errorMessage,
          tone: "error"
        });
        return;
      }

      if (printResult.pending) {
        showToast({
          title: t("orderQueue.kitchenPrintQueued"),
          tone: "info",
        });
        return;
      }

      if (printResult.successCount > 0 && printResult.failedCount === 0) {
        showToast({ title: t("common.printSuccess"), tone: "success" });
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

      showToast({
        title: t("cancelSale.reprintReceiptFailed"),
        tone: "error"
      });
    } catch (printError) {
      const receiptData = canOpenBrowserPrint && !physicalJobPrepared
        ? buildBrowserDocumentPrintData(printError, "receipt", (key, options) => String(t(key, options)))
        : null;
      if (receiptData) {
        await openReceiptPrintWindow(receiptData, browserPrintWindow);
        return;
      }

      showToast({
        title: t("cancelSale.reprintReceiptFailed"),
        description: documentPrinterFailureKind(printError) === "preparation"
          ? t("pos.browserPrintPreparationFailed") : printError instanceof Error ? printError.message : "",
        tone: "error"
      });
    } finally {
      browserPrintWindow?.closeUnused();
      setReceiptPrintingOrderUuid("");
    }
  }

  async function openReceiptPrintWindow(
    data: InvoicePrintData,
    reservation: LocalInvoicePrintWindowReservation | null = null,
  ) {
    const opened = reservation?.render(data) || await openLocalInvoicePrintWindow(data);
    if (opened) {
      showToast({
        title: t("pos.browserPrintOpened"),
        tone: "info"
      });
      return;
    }

    showToast({
      title: t("cancelSale.reprintReceiptFailed"),
      description: t("cancelSale.reprintReceiptPopupBlocked"),
      tone: "error",
      action: {
        label: t("pos.browserPrintAction"),
        onClick: () => void openReceiptPrintWindow(data)
      }
    });
  }

  if (!branchUuid) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden bg-muted/20 p-4">
        <EmptyState title={t("cancelSale.branchRequired")} description={t("cancelSale.branchRequiredDescription")} />
      </div>
    );
  }

  return (
    // เต็มหน้าจอแบบ /sales/sales-list: toolbar ลอยอยู่บนแยกจากแผงลิสต์ ไม่ใช่ header ใหญ่ + section เดียว
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20">
      <SalesListToolbar
        dateChoices={dateChoices}
        dateSelect={dateSelect}
        limit={limit}
        loading={loading || detailLoading}
        orderBy={orderBy}
        onDateChange={updateDate}
        onLimitChange={updateLimit}
        onOrderChange={updateOrder}
        onRefresh={() => void load()}
      />

      <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
        <SalesBillListPanel
          bills={bills}
          error={error}
          loading={loading}
          page={page}
          pageEnd={rowsRange.end}
          pageStart={rowsRange.start}
          selectedOrderUuid={selectedOrderUuid}
          total={total}
          totalPages={safeTotalPages}
          onPageChange={goToPage}
          onSelect={selectBill}
        />

        <SalesBillDetailPanel
          bill={detailSource}
          canCancel={detailCanCancel}
          canReprintReceipt={canReprintReceipt}
          className="hidden xl:flex"
          loading={detailLoading}
          logoChecked={documentLogo.checked}
          onLogoCheckedChange={documentLogo.setShowLogo}
          reprintingReceipt={reprintingReceipt}
          onCancel={openCancelDialog}
          onReprintReceipt={() => void reprintReceipt()}
        />
      </div>

      <SalesBillDetailDrawer
        bill={detailSource}
        canCancel={detailCanCancel}
        canReprintReceipt={canReprintReceipt}
        loading={detailLoading}
        logoChecked={documentLogo.checked}
        onLogoCheckedChange={documentLogo.setShowLogo}
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
      <PrintLoadingDialog open={reprintingReceipt} />
    </div>
  );
}
