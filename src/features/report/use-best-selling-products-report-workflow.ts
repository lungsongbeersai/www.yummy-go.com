"use client";

import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_PAGE_LIMIT, pageLimitSize } from "@/lib/pagination";
import { getBestSellingProductsReport } from "@/services/report";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useBestSellingProductsReportStore, mergeBestSellingProductGroups, normalizeBestSellingProductsReportResponse } from "@/stores/report-store";
import { useGroupStore } from "@/stores/group-store";
import { useToastStore } from "@/stores/toast-store";
import { branchOptionFromRow, selectedBranchLabel } from "./daily-sales-report-utils";
import type { BestSellingExportAction, BestSellingExportData, BestSellingProductsFilters } from "./best-selling-products-report-types";
import {
  ALL_GROUPS_VALUE,
  bestSellingExportLimit,
  bestSellingFileBaseName,
  bestSellingSortLabel,
  bestSellingSummaryConfigs,
  exportGroupRows,
  exportProductRows,
  exportSummaryRows,
  groupOptionFromRow,
  groupParam,
  localDateInputValue,
  selectedOptionLabel,
  waitForPaint
} from "./best-selling-products-report-utils";

export function useBestSellingProductsReportWorkflow(exportReportRef: RefObject<HTMLDivElement | null>) {
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
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<BestSellingProductsFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    groupUuid: ALL_GROUPS_VALUE,
    limit: DEFAULT_PAGE_LIMIT,
    sortBy: "qty"
  });
  const [appliedFilters, setAppliedFilters] = useState<BestSellingProductsFilters>(draftFilters);
  const [exporting, setExporting] = useState<BestSellingExportAction | null>(null);
  const [exportData, setExportData] = useState<BestSellingExportData | null>(null);
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
  const groupOptions = useMemo(() => {
    const options = groupRows
      .map((group) => groupOptionFromRow(group, language))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));
    return [{ value: ALL_GROUPS_VALUE, label: t("common.all") }, ...options];
  }, [groupRows, language, t]);
  const groupOptionValues = useMemo(() => new Set(groupOptions.map((option) => option.value)), [groupOptions]);
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

  const normalizeBranchFilters = useCallback(
    (filters: BestSellingProductsFilters) => {
      const nextGroupUuid = groupOptionValues.has(filters.groupUuid) ? filters.groupUuid : ALL_GROUPS_VALUE;
      const nextFilters = filters.groupUuid === nextGroupUuid ? filters : { ...filters, groupUuid: nextGroupUuid };
      if (!defaultBranchUuid) return nextFilters;

      if (!canSelectBranch) {
        return nextFilters.branchUuid === defaultBranchUuid
          ? nextFilters
          : { ...nextFilters, branchUuid: defaultBranchUuid };
      }

      if (nextFilters.branchUuid && (!branchOptionValues.size || branchOptionValues.has(nextFilters.branchUuid))) {
        return nextFilters;
      }

      return { ...nextFilters, branchUuid: defaultBranchUuid };
    },
    [branchOptionValues, canSelectBranch, defaultBranchUuid, groupOptionValues]
  );

  useEffect(() => {
    if (!storeUuid) return;
    void loadBranches(storeUuid, userBranchUuid).catch(() => undefined);
  }, [loadBranches, storeUuid, userBranchUuid]);

  useEffect(() => {
    if (!storeUuid) return;
    void loadGroups({ lang: language, limit: "All", page: 1, store_uuid_fk: storeUuid }).catch(() => undefined);
  }, [language, loadGroups, storeUuid]);

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

  const fetchExportData = useCallback(async (): Promise<BestSellingExportData> => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    const baseParams = {
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      group_uuid_fk: groupParam(appliedFilters.groupUuid),
      lang: language,
      limit: bestSellingExportLimit,
      sort_by: appliedFilters.sortBy
    };
    const firstResponse = await getBestSellingProductsReport({ ...baseParams, page: 1 });
    const firstData = normalizeBestSellingProductsReportResponse(firstResponse, bestSellingExportLimit, 1);
    const allGroups = [...firstData.groups];

    for (let nextPage = 2; nextPage <= firstData.pagination.totalPages; nextPage += 1) {
      const response = await getBestSellingProductsReport({ ...baseParams, page: nextPage });
      const normalized = normalizeBestSellingProductsReportResponse(response, bestSellingExportLimit, nextPage);
      allGroups.push(...normalized.groups);
    }

    const mergedGroups = mergeBestSellingProductGroups(allGroups);
    return {
      groups: mergedGroups,
      rows: mergedGroups.flatMap((group) => group.items).sort((left, right) => left.rank - right.rank),
      summary: firstData.summary
    };
  }, [appliedFilters, branchUuid, language, t]);

  async function exportExcel() {
    if (exportDisabled) return;
    setExporting("excel");
    try {
      const data = await fetchExportData();
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportSummaryRows(summaryCards, data.summary, t)), "Summary");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportGroupRows(data.groups, t)), "Groups");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportProductRows(data.rows, t)), "Products");
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
    setDraftFilters,
    setPage,
    sortByLabel,
    summary,
    summaryCards,
    totalPages,
    applyFilters,
    applyMobileFilters
  };
}
