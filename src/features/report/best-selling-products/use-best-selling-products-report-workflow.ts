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
import { useBestSellingProductsReportStore } from "@/stores/report-store";
import { useGroupStore } from "@/stores/group-store";
import { useToastStore } from "@/stores/toast-store";
import { exportInfoRows } from "../shared/report-export-info";
import { useReportBranchSelection } from "../shared/use-report-branch-selection";
import { createSingleSheetReportWorkbook } from "../shared/report-excel-utils";
import { officialReportExcelLayout } from "../shared/report-official-layout";
import { addReportCanvasToPdfPages } from "../shared/report-pdf-utils";
import { useReportRowSelection } from "../shared/report-row-selection";
import type { BestSellingExportAction, BestSellingExportData, BestSellingProductsFilters } from "./best-selling-products-report-types";
import {
  ALL_GROUPS_VALUE,
  bestSellingFileBaseName,
  bestSellingGroupedSection,
  bestSellingGroupsFromRows,
  bestSellingProductRowId,
  bestSellingSortLabel,
  bestSellingSummaryFromRows,
  bestSellingSummaryConfigs,
  exportSummaryRows,
  groupOptionFromRow,
  groupParam,
  selectedOptionLabel,
  waitForPaint
} from "./best-selling-products-report-utils";

export function useBestSellingProductsReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
  // สถานะการแสดง summary cards ใน UI — ไฟล์ export ต้องมีส่วนสรุปตรงกับที่ผู้ใช้เห็น
  summaryVisible: boolean
) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const groupRows = useGroupStore((state) => state.rows);
  const groupError = useGroupStore((state) => state.error);
  const groupLoading = useGroupStore((state) => state.loading);
  const loadGroups = useGroupStore((state) => state.load);
  const groups = useBestSellingProductsReportStore((state) => state.groups);
  const rows = useBestSellingProductsReportStore((state) => state.rows);
  const summary = useBestSellingProductsReportStore((state) => state.summary);
  const loading = useBestSellingProductsReportStore((state) => state.loading);
  const error = useBestSellingProductsReportStore((state) => state.error);
  const total = useBestSellingProductsReportStore((state) => state.total);
  const totalPages = useBestSellingProductsReportStore((state) => state.totalPages);
  const loadReport = useBestSellingProductsReportStore((state) => state.load);
  const loadExportData = useBestSellingProductsReportStore((state) => state.loadExportData);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<BestSellingProductsFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    groupUuid: ALL_GROUPS_VALUE,
    limit: initialPagination.limit,
    sortBy: "qty"
  });
  const [appliedFilters, setAppliedFilters] = useState<BestSellingProductsFilters>(draftFilters);
  const [exporting, setExporting] = useState<BestSellingExportAction | null>(null);
  const [exportData, setExportData] = useState<BestSellingExportData | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { changeLimit, page, setPage } = useUrlPagination({ initialPagination });
  const rowSelection = useReportRowSelection({
    getRowId: bestSellingProductRowId,
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
    storeUuid,
  } = useReportBranchSelection();
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const activeBranchLabel = branchLabelFor(branchUuid);
  const groupOptions = useMemo(() => {
    const options = groupRows
      .map((group) => groupOptionFromRow(group, language))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));
    return [{ value: ALL_GROUPS_VALUE, label: t("common.all") }, ...options];
  }, [groupRows, language, t]);
  const groupOptionValues = useMemo(() => new Set(groupOptions.map((option) => option.value)), [groupOptions]);
  // รายงานนี้มี group filter เพิ่มจากรายงานอื่น จึงต้องรีเซ็ตกลุ่มที่หลุดจาก options
  // (สลับร้าน/กลุ่มถูกลบ/ยังโหลดกลุ่มไม่เสร็จ) กลับเป็น "ทั้งหมด" ก่อนค่อย normalize สาขา
  const normalizeFilters = useCallback(
    (filters: BestSellingProductsFilters): BestSellingProductsFilters => {
      const nextGroupUuid = groupOptionValues.has(filters.groupUuid)
        ? filters.groupUuid
        : ALL_GROUPS_VALUE;

      const nextFilters =
        filters.groupUuid === nextGroupUuid
          ? filters
          : {
            ...filters,
            groupUuid: nextGroupUuid,
          };

      return normalizeBranchFilters(nextFilters) ?? nextFilters;
    },
    [groupOptionValues, normalizeBranchFilters],
  );
  const activeGroupLabel = selectedOptionLabel(groupOptions, appliedFilters.groupUuid, t("common.all"));
  const summaryCards = useMemo(() => bestSellingSummaryConfigs(t), [t]);
  const sortByLabel = bestSellingSortLabel(appliedFilters.sortBy, t);
  const visibleCount = rows.length;
  const activePageLimit = pageLimitSize(appliedFilters.limit, visibleCount);
  const pageStart = total ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = total ? Math.min((page - 1) * activePageLimit + visibleCount, total) : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const exportDisabled = loading || Boolean(exporting) || !branchUuid || !rows.length;
  const renderedExportData = exportData ?? { groups, rows, summary };
  const paginationRangeLabel = t("common.showingRange", { start: pageStart, end: pageEnd, total });
  const canApply = Boolean(draftFilters.branchUuid || defaultBranchUuid);

  useEffect(() => {
    if (!storeUuid) return;
    void loadGroups({ lang: language, limit: "All", page: 1, store_uuid_fk: storeUuid }).catch(() => undefined);
  }, [language, loadGroups, storeUuid]);

  // รายการสาขาเปลี่ยน (โหลดเสร็จ/สลับร้าน) = ปรับสาขาใน filter ให้ยังใช้ได้เสมอ
  useResetOnChange(normalizeFilters, () => {
    setDraftFilters((current) => normalizeFilters(current));
    setAppliedFilters((current) => normalizeFilters(current));
  });

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      await loadReport({
        branch_uuid_fk: branchUuid,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        group_uuid_fk: groupParam(appliedFilters.groupUuid),
        lang: language,
        limit: appliedFilters.limit,
        page,
        sort_by: appliedFilters.sortBy
      });
    } catch (error) {
      showToast({
        title: t("report.bestSelling.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error"
      });
    }
  }, [appliedFilters, branchUuid, language, loadReport, page, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    const nextFilters = normalizeFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
  }

  function applySortBy(sortBy: BestSellingProductsFilters["sortBy"]) {
    if (sortBy === appliedFilters.sortBy) return;
    const nextFilters = normalizeFilters({ ...appliedFilters, sortBy });
    setDraftFilters((current) => ({ ...current, sortBy: nextFilters.sortBy }));
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
    const nextFilters = normalizeFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
    setMobileFilterOpen(false);
  }

  const fetchExportData = useCallback(async (): Promise<BestSellingExportData> => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    return loadExportData({
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      group_uuid_fk: groupParam(appliedFilters.groupUuid),
      lang: language,
      sort_by: appliedFilters.sortBy
    });
  }, [appliedFilters, branchUuid, language, loadExportData, t]);

  const selectedExportData = useCallback(
    (data: BestSellingExportData): BestSellingExportData => {
      if (!rowSelection.selectedCount) return data;

      const selectedRows = data.rows.filter((row) =>
        rowSelection.selectedRowIds.has(bestSellingProductRowId(row))
      );
      const selectedGroups = bestSellingGroupsFromRows(data.groups, selectedRows);

      return {
        ...data,
        groups: selectedGroups,
        rows: selectedRows,
        summary: bestSellingSummaryFromRows(selectedRows, selectedGroups.length)
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
              dateTo: appliedFilters.dateTo
            })
          },
          ...(summaryVisible
            ? [
              {
                title: t("report.summary"),
                rows: exportSummaryRows(summaryCards, data.summary, t)
              }
            ]
            : []),
          bestSellingGroupedSection(data.groups, data.summary, t)
        ],
        officialReportExcelLayout(t, t("report.bestSelling.title"))
      );
      XLSX.writeFile(workbook, `${bestSellingFileBaseName(appliedFilters)}.xlsx`);
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

      pdf.save(`${bestSellingFileBaseName(appliedFilters)}.pdf`);
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
    activeGroupLabel,
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
    groupError,
    groupLoading,
    groupOptions,
    groups,
    handleMobileFilterOpenChange,
    load,
    loading,
    mobileFilterOpen,
    openMobileFilters,
    page,
    paginationRangeLabel,
    printReport,
    renderedExportData,
    rows,
    rowSelection,
    setDraftFilters,
    setPage,
    sortByLabel,
    summary,
    summaryCards,
    totalPages,
    applyFilters,
    applySortBy,
    applyMobileFilters
  };
}
