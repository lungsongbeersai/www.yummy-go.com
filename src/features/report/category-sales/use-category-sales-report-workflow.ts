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
import { useCategorySalesReportStore } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import { exportInfoRows } from "../shared/report-export-info";
import { useReportBranchSelection } from "../shared/use-report-branch-selection";
import { createSingleSheetReportWorkbook } from "../shared/report-excel-utils";
import { officialReportExcelLayout } from "../shared/report-official-layout";
import { addReportCanvasToPdfPages } from "../shared/report-pdf-utils";
import { useReportRowSelection } from "../shared/report-row-selection";
import type { CategorySalesExportAction, CategorySalesExportData, CategorySalesReportFilters } from "./category-sales-report-types";
import {
  categorySalesGroupedSection,
  categorySalesGroupsFromRows,
  categorySalesFileBaseName,
  categorySalesRowId,
  categorySalesSummaryFromRows,
  emptyExportData,
  exportSummaryRows,
  paymentMethodFallbackOptions,
  selectedPaymentMethodLabel,
  waitForPaint
} from "./category-sales-report-utils";

export function useCategorySalesReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
  // สถานะการแสดง summary cards ใน UI — ไฟล์ export ต้องมีส่วนสรุปตรงกับที่ผู้ใช้เห็น
  summaryVisible: boolean
) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const selectedBranch = useBranchStore((state) => state.getSelectedBranch());
  const groups = useCategorySalesReportStore((state) => state.groups);
  const reportName = useCategorySalesReportStore((state) => state.reportName);
  const rows = useCategorySalesReportStore((state) => state.rows);
  const summary = useCategorySalesReportStore((state) => state.summary);
  const loading = useCategorySalesReportStore((state) => state.loading);
  const error = useCategorySalesReportStore((state) => state.error);
  const total = useCategorySalesReportStore((state) => state.total);
  const totalPages = useCategorySalesReportStore((state) => state.totalPages);
  const loadReport = useCategorySalesReportStore((state) => state.load);
  const loadExportData = useCategorySalesReportStore((state) => state.loadExportData);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<CategorySalesReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    limit: initialPagination.limit,
    orderBy: "DESC",
    paymentMethod: "all"
  });
  const [appliedFilters, setAppliedFilters] = useState<CategorySalesReportFilters>(draftFilters);
  const [exporting, setExporting] = useState<CategorySalesExportAction | null>(null);
  const [exportData, setExportData] = useState<CategorySalesExportData | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { changeLimit, page, setPage } = useUrlPagination({ initialPagination });
  const rowSelection = useReportRowSelection({
    getRowId: categorySalesRowId,
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
  const methodOptions = paymentMethodFallbackOptions(t);
  const activePaymentMethodLabel = selectedPaymentMethodLabel(methodOptions, appliedFilters.paymentMethod, t);
  const reportTitle = reportName || t("report.categorySales.title");
  const visibleCount = groups.length;
  const activePageLimit = pageLimitSize(appliedFilters.limit, visibleCount);
  const pageStart = total ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = total ? Math.min((page - 1) * activePageLimit + visibleCount, total) : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const canApply = Boolean(draftFilters.branchUuid || defaultBranchUuid);
  const exportDisabled = loading || Boolean(exporting) || !branchUuid || !rows.length;
  const serviceChargePercent = selectedBranch?.charge_status === 1 ? Number(selectedBranch.charge_name) : NaN;
  const vatPercent = selectedBranch?.vat_status === 1 ? Number(selectedBranch.vat_name) : NaN;
  const serviceChargePercentLabel = Number.isFinite(serviceChargePercent)
    ? `${serviceChargePercent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
    : null;
  const vatPercentLabel = Number.isFinite(vatPercent)
    ? `${vatPercent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
    : null;

  const serviceChargeLabel = serviceChargePercentLabel
    ? `${t("report.categorySales.columns.serviceCharge")} (${serviceChargePercentLabel})`
    : t("report.categorySales.columns.serviceCharge");
  const vatLabel = vatPercentLabel
    ? `${t("report.categorySales.columns.vat")} (${vatPercentLabel})`
    : t("report.categorySales.columns.vat");

  const labelOverrides = {
    sum_servicecharge: serviceChargeLabel,
    sum_vate: vatLabel
  } as const;

  const renderedExportData = exportData ?? { ...emptyExportData(), groups, reportName, rows, summary };
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
        orderBy: appliedFilters.orderBy,
        page,
        payment_method: appliedFilters.paymentMethod
      });
    } catch (error) {
      showToast({
        title: t("report.categorySales.loadFailed"),
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

  const fetchExportData = useCallback(async (): Promise<CategorySalesExportData> => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    return loadExportData({
        branch_uuid_fk: branchUuid,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        lang: language,
        orderBy: appliedFilters.orderBy,
        payment_method: appliedFilters.paymentMethod
      });
  }, [appliedFilters, branchUuid, language, loadExportData, t]);

  const selectedExportData = useCallback(
    (data: CategorySalesExportData): CategorySalesExportData => {
      if (!rowSelection.selectedCount) return data;

      const selectedRows = data.rows.filter((row) =>
        rowSelection.selectedRowIds.has(categorySalesRowId(row))
      );

      return {
        ...data,
        groups: categorySalesGroupsFromRows(data.groups, selectedRows),
        rows: selectedRows,
        summary: categorySalesSummaryFromRows(selectedRows)
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
          ...(summaryVisible
            ? [
                {
                  title: t("report.summary"),
                  rows: exportSummaryRows(data.summary, t, labelOverrides)
                }
              ]
            : []),
          categorySalesGroupedSection(data.groups, data.summary, t, labelOverrides)
        ],
        officialReportExcelLayout(t, data.reportName || reportTitle)
      );
      XLSX.writeFile(workbook, `${categorySalesFileBaseName(appliedFilters)}.xlsx`);
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

      pdf.save(`${categorySalesFileBaseName(appliedFilters)}.pdf`);
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
    draftFilters,
    error,
    exportDisabled,
    exportExcel,
    exportPdf,
    exporting,
    groups,
    handleMobileFilterOpenChange,
    labelOverrides,
    load,
    loading,
    methodOptions,
    mobileFilterOpen,
    openMobileFilters,
    page,
    paginationRangeLabel,
    printReport,
    renderedExportData,
    reportTitle,
    rows,
    rowSelection,
    setDraftFilters,
    setPage,
    summary,
    totalPages,
    applyFilters,
    applyMobileFilters
  };
}
