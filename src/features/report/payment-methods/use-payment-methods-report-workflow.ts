"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_PAGE_LIMIT, pageLimitSize } from "@/lib/pagination";
import { getPaymentMethodsReport } from "@/services/report";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { normalizePaymentMethodsReportResponse, usePaymentMethodsReportStore } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import { branchOptionFromRow, selectedBranchLabel } from "../daily-sales/daily-sales-report-utils";
import type { PaymentMethodsExportAction, PaymentMethodsExportData, PaymentMethodsReportFilters } from "./payment-methods-report-types";
import {
  emptyExportData,
  exportPaymentMethodRows,
  exportSummaryRows,
  localDateInputValue,
  paymentMethodOptions,
  paymentMethodsExportLimit,
  paymentMethodsFileBaseName,
  selectedPaymentMethodLabel,
  waitForPaint
} from "./payment-methods-report-utils";

export function usePaymentMethodsReportWorkflow(exportReportRef: RefObject<HTMLDivElement | null>) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const branches = useBranchStore((state) => state.branches);
  const branchError = useBranchStore((state) => state.error);
  const branchLoading = useBranchStore((state) => state.loading);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const selectedBranchUuid = useBranchStore((state) => state.selectedBranchUuid);
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
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<PaymentMethodsReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    limit: DEFAULT_PAGE_LIMIT,
    orderBy: "DESC",
    paymentMethod: "all"
  });
  const [appliedFilters, setAppliedFilters] = useState<PaymentMethodsReportFilters>(draftFilters);
  const [exporting, setExporting] = useState<PaymentMethodsExportAction | null>(null);
  const [exportData, setExportData] = useState<PaymentMethodsExportData | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const storeUuid = authStoreUuid(user);
  const userBranchUuid = user?.branch_uuid ?? "";
  const canSelectBranch = Number(user?.status ?? 0) === 1;
  const branchOptions = useMemo(() => {
    const storeBranches = branchStoreUuid === storeUuid ? branches : [];
    const options = storeBranches
      .map((branch) => branchOptionFromRow(branch, language))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));

    if (userBranchUuid && !options.some((option) => option.value === userBranchUuid)) {
      options.unshift({ value: userBranchUuid, label: user?.branch_name || userBranchUuid });
    }

    if (canSelectBranch) return options;

    const lockedOptions = options.filter((option) => option.value === userBranchUuid);
    return lockedOptions.length || !userBranchUuid
      ? lockedOptions
      : [{ value: userBranchUuid, label: user?.branch_name || userBranchUuid }];
  }, [branches, branchStoreUuid, canSelectBranch, language, storeUuid, user?.branch_name, userBranchUuid]);
  const branchOptionValues = useMemo(() => new Set(branchOptions.map((option) => option.value)), [branchOptions]);
  const branchStoreSelectedUuid = branchStoreUuid === storeUuid ? selectedBranchUuid : "";
  const defaultBranchUuid = useMemo(() => {
    if (!canSelectBranch) return userBranchUuid;
    if (branchStoreSelectedUuid && (!branchOptionValues.size || branchOptionValues.has(branchStoreSelectedUuid))) {
      return branchStoreSelectedUuid;
    }
    if (userBranchUuid && (!branchOptionValues.size || branchOptionValues.has(userBranchUuid))) return userBranchUuid;
    return branchOptions[0]?.value ?? userBranchUuid;
  }, [branchOptionValues, branchOptions, branchStoreSelectedUuid, canSelectBranch, userBranchUuid]);
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const activeBranchLabel = selectedBranchLabel(branchOptions, branchUuid, user?.branch_name || branchUuid || "-");
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

  const normalizeBranchFilters = useCallback(
    (filters: PaymentMethodsReportFilters) => {
      if (!defaultBranchUuid) return filters;

      if (!canSelectBranch) {
        return filters.branchUuid === defaultBranchUuid ? filters : { ...filters, branchUuid: defaultBranchUuid };
      }

      if (filters.branchUuid && (!branchOptionValues.size || branchOptionValues.has(filters.branchUuid))) {
        return filters;
      }

      return { ...filters, branchUuid: defaultBranchUuid };
    },
    [branchOptionValues, canSelectBranch, defaultBranchUuid]
  );

  useEffect(() => {
    if (!storeUuid) return;
    void loadBranches(storeUuid, userBranchUuid).catch(() => undefined);
  }, [loadBranches, storeUuid, userBranchUuid]);

  useEffect(() => {
    setDraftFilters((current) => normalizeBranchFilters(current));
    setAppliedFilters((current) => normalizeBranchFilters(current));
  }, [normalizeBranchFilters]);

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await loadReport({
        branch_uuid_fk: branchUuid,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        lang: language,
        limit: appliedFilters.limit,
        orderBy: appliedFilters.orderBy,
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
    setPage(1);
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
    setPage(1);
    setMobileFilterOpen(false);
  }

  const fetchExportData = useCallback(async (): Promise<PaymentMethodsExportData> => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    const baseParams = {
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      lang: language,
      limit: paymentMethodsExportLimit,
      orderBy: appliedFilters.orderBy,
      payment_method: appliedFilters.paymentMethod
    };
    const firstResponse = await getPaymentMethodsReport({ ...baseParams, page: 1 });
    const firstData = normalizePaymentMethodsReportResponse(firstResponse, paymentMethodsExportLimit, 1);
    const allRows = [...firstData.rows];

    for (let nextPage = 2; nextPage <= firstData.pagination.totalPages; nextPage += 1) {
      const response = await getPaymentMethodsReport({ ...baseParams, page: nextPage });
      const normalized = normalizePaymentMethodsReportResponse(response, paymentMethodsExportLimit, nextPage);
      allRows.push(...normalized.rows);
    }

    return {
      cards: firstData.cards,
      reportName: firstData.reportName,
      reportTotal: firstData.reportTotal,
      rows: allRows
    };
  }, [appliedFilters, branchUuid, language, t]);

  async function exportExcel() {
    if (exportDisabled) return;
    setExporting("excel");
    try {
      const data = await fetchExportData();
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportSummaryRows(data.cards, data.reportTotal, t)), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportPaymentMethodRows(data.rows, t)), "Rows");
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
      const data = await fetchExportData();
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
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png", 1);
      let offsetY = 0;

      pdf.addImage(imageData, "PNG", 0, offsetY, pageWidth, imageHeight);
      while (imageHeight + offsetY > pageHeight) {
        offsetY -= pageHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, offsetY, pageWidth, imageHeight);
      }

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
      const data = await fetchExportData();
      setExportData(data);
      await waitForPaint();
      let clearTimer: number | null = null;
      const clearPrintData = () => {
        setExportData(null);
        if (clearTimer) window.clearTimeout(clearTimer);
      };

      window.addEventListener("afterprint", clearPrintData, { once: true });
      window.print();
      clearTimer = window.setTimeout(clearPrintData, 5000);
    } catch (error) {
      showToast({
        title: t("report.printFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    } finally {
      setExporting(null);
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
    setDraftFilters,
    setPage,
    totalPages,
    applyFilters,
    applyMobileFilters
  };
}
