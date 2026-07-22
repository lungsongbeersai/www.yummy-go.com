"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { localDateInputValue } from "@/lib/format";
import { pageLimitSize } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { usePaymentMethodsReportStore } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import { exportInfoRows } from "../shared/report-export-info";
import { useReportBranchSelection } from "../shared/use-report-branch-selection";
import { createSingleSheetReportWorkbook } from "../shared/report-excel-utils";
import { officialReportExcelLayout } from "../shared/report-official-layout";
import { addReportCanvasToPdfPages } from "../shared/report-pdf-utils";
import { useReportRowSelection } from "../shared/report-row-selection";
import type { PaymentMethodsExportAction, PaymentMethodsExportData, PaymentMethodsReportFilters } from "./payment-methods-report-types";
import {
  emptyExportData,
  exportPaymentMethodRows,
  paymentMethodCardsForTotal,
  paymentMethodOptions,
  paymentMethodReportRowId,
  paymentMethodReportTotalFromRows,
  paymentMethodsFileBaseName,
  selectedPaymentMethodLabel,
  waitForPaint
} from "./payment-methods-report-utils";

export function usePaymentMethodsReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState
) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const cards = usePaymentMethodsReportStore((state) => state.cards);
  const paymentMethods = usePaymentMethodsReportStore((state) => state.paymentMethods);
  const reportName = usePaymentMethodsReportStore((state) => state.reportName);
  const reportTotal = usePaymentMethodsReportStore((state) => state.reportTotal);
  const rows = usePaymentMethodsReportStore((state) => state.rows);
  const loading = usePaymentMethodsReportStore((state) => state.loading);
  const error = usePaymentMethodsReportStore((state) => state.error);
  const total = usePaymentMethodsReportStore((state) => state.total);
  const totalPages = usePaymentMethodsReportStore((state) => state.totalPages);
  const loadReport = usePaymentMethodsReportStore((state) => state.load);
  const loadExportData = usePaymentMethodsReportStore((state) => state.loadExportData);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<PaymentMethodsReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    limit: initialPagination.limit,
    paymentMethod: "all"
  });
  const [appliedFilters, setAppliedFilters] = useState<PaymentMethodsReportFilters>(draftFilters);
  const [exporting, setExporting] = useState<PaymentMethodsExportAction | null>(null);
  const [exportData, setExportData] = useState<PaymentMethodsExportData | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { changeLimit, page, setPage } = useUrlPagination({ initialPagination });
  const rowSelection = useReportRowSelection({
    getRowId: paymentMethodReportRowId,
    rows
  });

  const {
    branchError,
    branchLabelFor,
    branchLoading,
    branchOptions,
    canSelectBranch,
    defaultBranchUuid,
    normalizeBranchFilters,
  } = useReportBranchSelection();
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const activeBranchLabel = branchLabelFor(branchUuid);
  const methodOptions = paymentMethodOptions(paymentMethods, t);
  const activePaymentMethodLabel = selectedPaymentMethodLabel(paymentMethods, appliedFilters.paymentMethod, t);
  const reportTitle = reportName || t("report.paymentMethodsReport.title");
  const visibleCount = rows.length;
  const activePageLimit = pageLimitSize(appliedFilters.limit, visibleCount);
  const pageStart = total ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = total ? Math.min((page - 1) * activePageLimit + visibleCount, total) : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const canApply = Boolean(draftFilters.branchUuid || defaultBranchUuid);
  const exportDisabled = loading || Boolean(exporting) || !branchUuid || !rows.length;
  const renderedExportData = exportData ?? {
    cards,
    reportName,
    reportTotal,
    rows
  };
  const paginationRangeLabel = t("common.showingRange", { start: pageStart, end: pageEnd, total });

  // รายการสาขาเปลี่ยน (โหลดเสร็จ/สลับร้าน) = ปรับสาขาใน filter ให้ยังใช้ได้เสมอ
  useResetOnChange(normalizeBranchFilters, () => {
    setDraftFilters((current) => normalizeBranchFilters(current));
    setAppliedFilters((current) => normalizeBranchFilters(current));
  });

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await loadReport({
        branch_uuid_fk: branchUuid,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        lang: language,
        limit: appliedFilters.limit,
        page,
        payment_method: appliedFilters.paymentMethod
      });
    } catch (error) {
      showToast({
        title: t("report.paymentMethodsReport.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }, [appliedFilters, branchUuid, language, loadReport, page, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    const nextFilters = normalizeBranchFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
  }

  function openMobileFilters() {
    setDraftFilters({ ...appliedFilters });
    setMobileFilterOpen(true);
  }

  function handleMobileFilterOpenChange(open: boolean) {
    setMobileFilterOpen(open);
    if (!open) setDraftFilters({ ...appliedFilters });
  }

  function applyMobileFilters() {
    const nextFilters = normalizeBranchFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
    setMobileFilterOpen(false);
  }

  const fetchExportData = useCallback(async (): Promise<PaymentMethodsExportData> => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    return loadExportData({
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      lang: language,
      payment_method: appliedFilters.paymentMethod
    });
  }, [appliedFilters, branchUuid, language, loadExportData, t]);

  const selectedExportData = useCallback(
    (data: PaymentMethodsExportData): PaymentMethodsExportData => {
      if (!rowSelection.selectedCount) return data;

      const selectedRows = data.rows.filter((row) =>
        rowSelection.selectedRowIds.has(paymentMethodReportRowId(row))
      );
      const selectedReportTotal = paymentMethodReportTotalFromRows(selectedRows);

      return {
        ...data,
        cards: paymentMethodCardsForTotal(data.cards, selectedReportTotal),
        reportTotal: selectedReportTotal,
        rows: selectedRows
      };
    },
    [rowSelection.selectedCount, rowSelection.selectedRowIds]
  );

  async function exportExcel() {
    if (exportDisabled) return;
    setExporting("excel");
    try {
      const data = selectedExportData(await fetchExportData());
      const XLSX = await import("xlsx-js-style");
      const workbook = createSingleSheetReportWorkbook(
        XLSX,
        [
          {
            title: t("report.excel.reportInformation"),
            rows: exportInfoRows(t, {
              branchLabel: activeBranchLabel,
              dateFrom: appliedFilters.dateFrom,
              dateTo: appliedFilters.dateTo,
              paymentMethodLabel: activePaymentMethodLabel
            })
          },
          {
            title: t("report.excel.rows"),
            rows: exportPaymentMethodRows(data.rows, t)
          }
        ],
        officialReportExcelLayout(t, data.reportName || reportTitle)
      );
      XLSX.writeFile(workbook, `${paymentMethodsFileBaseName(appliedFilters)}.xlsx`);
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("report.exportFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setExporting(null);
    }
  }

  async function exportPdf() {
    if (exportDisabled) return;
    setExporting("pdf");
    try {
      const data = selectedExportData(await fetchExportData());
      setExportData(data);
      await waitForPaint();

      const element = exportReportRef.current;
      if (!element) throw new Error(t("report.exportFailed"));

      const [{ jsPDF }, html2canvasModule] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const canvas = await html2canvasModule.default(element, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        windowHeight: element.scrollHeight,
        windowWidth: element.scrollWidth
      });
      const pdf = new jsPDF({ format: "a4", orientation: "landscape", unit: "pt" });
      addReportCanvasToPdfPages(pdf, canvas, element);

      pdf.save(`${paymentMethodsFileBaseName(appliedFilters)}.pdf`);
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("report.exportFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setExporting(null);
      setExportData(null);
    }
  }

  async function printReport() {
    if (exportDisabled) return;
    setExporting("print");
    try {
      const data = selectedExportData(await fetchExportData());
      setExportData(data);
      await waitForPaint();
      window.print();
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success"
      });
    } catch (error) {
      showToast({
        title: t("report.printFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setExporting(null);
      setExportData(null);
    }
  }

  return {
    activeBranchLabel,
    activePaymentMethodLabel,
    appliedFilters,
    branchError,
    branchLoading,
    branchOptions,
    branchUuid,
    canApply,
    canGoBack,
    canGoNext,
    canSelectBranch,
    cards,
    draftFilters,
    error,
    exportDisabled,
    exportExcel,
    exportPdf,
    exporting,
    handleMobileFilterOpenChange,
    load,
    loading,
    methodOptions,
    mobileFilterOpen,
    openMobileFilters,
    page,
    paginationRangeLabel,
    printReport,
    renderedExportData: renderedExportData ?? emptyExportData(),
    reportTitle,
    reportTotal,
    rows,
    rowSelection,
    setDraftFilters,
    setPage,
    totalPages,
    applyFilters,
    applyMobileFilters
  };
}
