"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { pageLimitSize } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useCategorySalesReportStore } from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import { branchOptionFromRow, selectedBranchLabel } from "../daily-sales/daily-sales-report-utils";
import { createSingleSheetReportWorkbook } from "../report-excel-utils";
import { officialReportExcelLayout } from "../report-official-layout";
import { useReportRowSelection } from "../report-row-selection";
import type { CategorySalesExportAction, CategorySalesExportData, CategorySalesReportFilters } from "./category-sales-report-types";
import {
  categorySalesGroupedSection,
  categorySalesGroupsFromRows,
  categorySalesFileBaseName,
  categorySalesRowId,
  categorySalesSummaryFromRows,
  emptyExportData,
  exportSummaryRows,
  localDateInputValue,
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
  const branches = useBranchStore((state) => state.branches);
  const branchError = useBranchStore((state) => state.error);
  const branchLoading = useBranchStore((state) => state.loading);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const selectedBranchUuid = useBranchStore((state) => state.selectedBranchUuid);
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
  const methodOptions = paymentMethodFallbackOptions(t);
  const activePaymentMethodLabel = selectedPaymentMethodLabel(appliedFilters.paymentMethod, t);
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

  const normalizeBranchFilters = useCallback(
    (filters: CategorySalesReportFilters) => {
      if (!defaultBranchUuid) return filters;

      if (!canSelectBranch) {
        return filters.branchUuid === defaultBranchUuid ? filters : { ...filters, branchUuid: defaultBranchUuid };
      }

      if (filters.branchUuid && (!branchOptionValues.size || branchOptionValues.has(filters.branchUuid))) return filters;
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
        officialReportExcelLayout(t)
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
