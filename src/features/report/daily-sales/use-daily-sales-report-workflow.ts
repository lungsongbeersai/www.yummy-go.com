"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_PAGE_LIMIT, pageLimitSize } from "@/lib/pagination";
import { getDailySalesReport } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import {
  createDailySalesBillGroups,
  normalizeDailySalesReportResponse,
  useDailySalesReportStore,
} from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import type {
  ReportExportAction,
  ReportFilters,
} from "./daily-sales-report-types";
import {
  reportColumns,
  reportDetailItemColumns,
  summaryConfigs,
} from "./daily-sales-report-columns";
import {
  dateTotalsFromGroups,
  exportBillRows,
  exportDataFromResponse,
  exportDateTotalRows,
  exportSummaryRows,
  exportTableRows,
  reportFileBaseName,
  selectedDetailBillGroups,
  waitForPaint,
} from "./daily-sales-report-export-utils";
import {
  branchOptionFromRow,
  detailPaginationBasis,
  exportLimit,
  firstOptionalNumber,
  localDateInputValue,
  paymentMethodParam,
  reportRecordId,
  reportTotalFromBillGroups,
  reportTotalFromRows,
  responseRoot,
  responseTotalPages,
  selectedBranchLabel,
} from "./daily-sales-report-utils";

export function useDailySalesReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const branches = useBranchStore((state) => state.branches);
  const branchError = useBranchStore((state) => state.error);
  const branchLoading = useBranchStore((state) => state.loading);
  const branchStoreUuid = useBranchStore((state) => state.storeUuid);
  const loadBranches = useBranchStore((state) => state.loadBranches);
  const selectedBranchUuid = useBranchStore(
    (state) => state.selectedBranchUuid,
  );
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const billGroups = useDailySalesReportStore((state) => state.billGroups);
  const grandTotalByDate = useDailySalesReportStore(
    (state) => state.grandTotalByDate,
  );
  const rows = useDailySalesReportStore((state) => state.rows);
  const summaryCards = useDailySalesReportStore((state) => state.summaryCards);
  const reportTotal = useDailySalesReportStore((state) => state.reportTotal);
  const loading = useDailySalesReportStore((state) => state.loading);
  const error = useDailySalesReportStore((state) => state.error);
  const total = useDailySalesReportStore((state) => state.total);
  const totalPages = useDailySalesReportStore((state) => state.totalPages);
  const loadReport = useDailySalesReportStore((state) => state.load);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<ReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    limit: DEFAULT_PAGE_LIMIT,
    orderBy: "DESC",
    paymentMethod: "all",
    typePage: "summary",
  });
  const [appliedFilters, setAppliedFilters] =
    useState<ReportFilters>(draftFilters);
  const [collapsedBillGroups, setCollapsedBillGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [exporting, setExporting] = useState<ReportExportAction | null>(null);
  const [exportData, setExportData] = useState<ReturnType<
    typeof exportDataFromResponse
  > | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [page, setPage] = useState(1);

  const storeUuid = authStoreUuid(user);
  const userBranchUuid = user?.branch_uuid ?? "";
  const canSelectBranch = Number(user?.status ?? 0) === 1;
  const branchOptions = useMemo(() => {
    const storeBranches = branchStoreUuid === storeUuid ? branches : [];
    const options = storeBranches
      .map((branch) => branchOptionFromRow(branch, language))
      .filter((option): option is NonNullable<typeof option> =>
        Boolean(option),
      );

    if (
      userBranchUuid &&
      !options.some((option) => option.value === userBranchUuid)
    ) {
      options.unshift({
        value: userBranchUuid,
        label: user?.branch_name || userBranchUuid,
      });
    }

    if (canSelectBranch) return options;

    const lockedOptions = options.filter(
      (option) => option.value === userBranchUuid,
    );
    return lockedOptions.length || !userBranchUuid
      ? lockedOptions
      : [{ value: userBranchUuid, label: user?.branch_name || userBranchUuid }];
  }, [
    branches,
    branchStoreUuid,
    canSelectBranch,
    language,
    storeUuid,
    user?.branch_name,
    userBranchUuid,
  ]);
  const branchOptionValues = useMemo(
    () => new Set(branchOptions.map((option) => option.value)),
    [branchOptions],
  );
  const branchStoreSelectedUuid =
    branchStoreUuid === storeUuid ? selectedBranchUuid : "";
  const defaultBranchUuid = useMemo(() => {
    if (!canSelectBranch) return userBranchUuid;
    if (
      branchStoreSelectedUuid &&
      (!branchOptionValues.size ||
        branchOptionValues.has(branchStoreSelectedUuid))
    ) {
      return branchStoreSelectedUuid;
    }
    if (
      userBranchUuid &&
      (!branchOptionValues.size || branchOptionValues.has(userBranchUuid))
    )
      return userBranchUuid;
    return branchOptions[0]?.value ?? userBranchUuid;
  }, [
    branchOptionValues,
    branchOptions,
    branchStoreSelectedUuid,
    canSelectBranch,
    userBranchUuid,
  ]);
  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const activeBranchLabel = useMemo(
    () =>
      selectedBranchLabel(
        branchOptions,
        branchUuid,
        user?.branch_name || branchUuid || "-",
      ),
    [branchOptions, branchUuid, user?.branch_name],
  );
  const columns = useMemo(
    () => reportColumns(t, appliedFilters.typePage),
    [appliedFilters.typePage, t],
  );
  const detailItemColumns = useMemo(() => reportDetailItemColumns(t), [t]);
  const cards = useMemo(
    () => summaryConfigs(t, appliedFilters.typePage),
    [appliedFilters.typePage, t],
  );
  const detailPageBasis = useMemo(
    () => detailPaginationBasis(total, summaryCards, reportTotal),
    [reportTotal, summaryCards, total],
  );
  const visibleCount =
    appliedFilters.typePage === "detail" && detailPageBasis === "bills"
      ? billGroups.length
      : rows.length;
  const activePageLimit = pageLimitSize(appliedFilters.limit, visibleCount);
  const pageStart = visibleCount ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = visibleCount ? pageStart + visibleCount - 1 : 0;
  const canGoBack = page > 1 && !loading;
  const canGoNext = page < totalPages && !loading;
  const exportDisabled =
    loading || Boolean(exporting) || !branchUuid || !rows.length;
  const renderedExportData = exportData ?? {
    billGroups,
    grandTotalByDate,
    reportTotal,
    rows,
    summaryCards,
  };
  const allDetailGroupsExpanded =
    billGroups.length > 0 &&
    billGroups.every((group) => !collapsedBillGroups.has(group.id));
  const selectedCount = selectedRecordIds.size;
  const detailRangeLabel =
    detailPageBasis === "lines"
      ? t("report.showingDetailLinesRange", {
          bills: billGroups.length,
          end: pageEnd,
          lines: rows.length,
          start: pageStart,
          total,
        })
      : t("report.showingBillsRange", {
          start: pageStart,
          end: pageEnd,
          total,
        });
  const contextRangeLabel =
    appliedFilters.typePage === "detail"
      ? detailRangeLabel
      : t("common.showingRange", { start: pageStart, end: pageEnd, total });
  const paginationRangeLabel = t("common.showingRange", {
    start: pageStart,
    end: pageEnd,
    total,
  });

  const normalizeBranchFilters = useCallback(
    (filters: ReportFilters) => {
      if (!defaultBranchUuid) return filters;

      if (!canSelectBranch) {
        return filters.branchUuid === defaultBranchUuid
          ? filters
          : { ...filters, branchUuid: defaultBranchUuid };
      }

      if (
        filters.branchUuid &&
        (!branchOptionValues.size || branchOptionValues.has(filters.branchUuid))
      ) {
        return filters;
      }

      return { ...filters, branchUuid: defaultBranchUuid };
    },
    [branchOptionValues, canSelectBranch, defaultBranchUuid],
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
        payment_method: paymentMethodParam(appliedFilters.paymentMethod),
        type_page: appliedFilters.typePage,
      });
    } catch (error) {
      showToast({
        title: t("report.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [appliedFilters, branchUuid, language, loadReport, page, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCollapsedBillGroups(new Set());
  }, [appliedFilters.typePage, page, rows]);

  useEffect(() => {
    setSelectedRecordIds(new Set());
  }, [
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.limit,
    appliedFilters.orderBy,
    appliedFilters.paymentMethod,
    appliedFilters.typePage,
    branchUuid,
  ]);

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
    if (!open) {
      setDraftFilters({ ...appliedFilters });
    }
  }

  function applyMobileFilters() {
    const nextFilters = normalizeBranchFilters(draftFilters);
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    setMobileFilterOpen(false);
  }

  function toggleBillGroup(groupId: string) {
    setCollapsedBillGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function expandAllBills() {
    setCollapsedBillGroups(new Set());
  }

  function collapseAllBills() {
    setCollapsedBillGroups(new Set(billGroups.map((group) => group.id)));
  }

  function clearSelection() {
    setSelectedRecordIds(new Set());
  }

  function toggleReportRow(row: ApiEntity, selected: boolean) {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      const id = reportRecordId(row);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleReportRows(targetRows: ApiEntity[], selected: boolean) {
    setSelectedRecordIds((current) => {
      const next = new Set(current);
      targetRows.forEach((row) => {
        const id = reportRecordId(row);
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }

  const fetchExportData = useCallback(async () => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    const baseParams = {
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      lang: language,
      limit: exportLimit,
      orderBy: appliedFilters.orderBy,
      payment_method: paymentMethodParam(appliedFilters.paymentMethod),
      type_page: appliedFilters.typePage,
    };
    const firstResponse = await getDailySalesReport({ ...baseParams, page: 1 });
    const firstRoot = responseRoot(firstResponse);
    const firstData = exportDataFromResponse(firstResponse);
    const totalRows =
      firstOptionalNumber(
        firstRoot.total,
        firstRoot.total_rows,
        firstRoot.count,
        firstRoot.report_count,
      ) ?? firstData.rows.length;
    const pageCount = responseTotalPages(firstRoot, totalRows, exportLimit, 1);
    const allRows = [...firstData.rows];
    const allBillGroups = [...firstData.billGroups];

    for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
      const response = await getDailySalesReport({
        ...baseParams,
        page: nextPage,
      });
      const normalized = normalizeDailySalesReportResponse(response);
      allRows.push(...normalized.rows);
      allBillGroups.push(...normalized.billGroups);
    }

    const billGroupsForExport =
      selectedRecordIds.size && appliedFilters.typePage === "detail"
        ? selectedDetailBillGroups(allBillGroups, selectedRecordIds)
        : selectedRecordIds.size
          ? createDailySalesBillGroups(
              allRows.filter((row) =>
                selectedRecordIds.has(reportRecordId(row)),
              ),
            )
          : allBillGroups;
    const rowsForExport =
      selectedRecordIds.size && appliedFilters.typePage === "detail"
        ? billGroupsForExport.flatMap((group) => group.items)
        : selectedRecordIds.size
          ? allRows.filter((row) => selectedRecordIds.has(reportRecordId(row)))
          : allRows;
    const selectedReportTotal =
      selectedRecordIds.size && appliedFilters.typePage === "detail"
        ? reportTotalFromBillGroups(billGroupsForExport)
        : selectedRecordIds.size
          ? reportTotalFromRows(rowsForExport, appliedFilters.typePage)
          : firstData.reportTotal;

    return {
      ...firstData,
      billGroups: billGroupsForExport,
      grandTotalByDate: selectedRecordIds.size
        ? dateTotalsFromGroups(billGroupsForExport)
        : firstData.grandTotalByDate,
      reportTotal: selectedReportTotal,
      rows: rowsForExport,
      summaryCards: selectedRecordIds.size
        ? selectedReportTotal
        : firstData.summaryCards,
    };
  }, [appliedFilters, branchUuid, language, selectedRecordIds, t]);

  async function exportExcel() {
    if (exportDisabled) return;
    setExporting("excel");
    try {
      const data = await fetchExportData();
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const summarySheet = XLSX.utils.json_to_sheet(
        exportSummaryRows(cards, data.summaryCards, data.reportTotal),
      );
      const rowsSheet = XLSX.utils.json_to_sheet(
        exportTableRows(
          data.rows,
          appliedFilters.typePage === "detail" ? detailItemColumns : columns,
        ),
      );

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
      if (appliedFilters.typePage === "detail") {
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(
            exportDateTotalRows(data.grandTotalByDate, t),
          ),
          "Date Totals",
        );
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(exportBillRows(data.billGroups, t)),
          "Bills",
        );
        XLSX.utils.book_append_sheet(workbook, rowsSheet, "Items");
      } else {
        XLSX.utils.book_append_sheet(workbook, rowsSheet, "Rows");
      }
      XLSX.writeFile(workbook, `${reportFileBaseName(appliedFilters)}.xlsx`);
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("report.exportFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
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

      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvasModule.default(element, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1.5),
        useCORS: true,
        windowHeight: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      const pdf = new jsPDF({
        format: "a4",
        orientation: "landscape",
        unit: "pt",
      });
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

      pdf.save(`${reportFileBaseName(appliedFilters)}.pdf`);
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success",
      });
    } catch (error) {
      showToast({
        title: t("report.exportFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
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
        tone: "error",
      });
    } finally {
      setExporting(null);
    }
  }

  return {
    activeBranchLabel,
    allDetailGroupsExpanded,
    appliedFilters,
    billGroups,
    branchError,
    branchLoading,
    branchOptions,
    branchUuid,
    canGoBack,
    canGoNext,
    canSelectBranch,
    cards,
    clearSelection,
    collapsedBillGroups,
    collapseAllBills,
    columns,
    contextRangeLabel,
    defaultBranchUuid,
    detailItemColumns,
    detailPageBasis,
    draftFilters,
    error,
    exportDisabled,
    exportExcel,
    exporting,
    expandAllBills,
    handleMobileFilterOpenChange,
    load,
    loading,
    mobileFilterOpen,
    openMobileFilters,
    page,
    pageStart,
    paginationRangeLabel,
    printReport,
    renderedExportData,
    reportTotal,
    rows,
    selectedCount,
    selectedRecordIds,
    setDraftFilters,
    setPage,
    summaryCards,
    toggleBillGroup,
    toggleReportRow,
    toggleReportRows,
    totalPages,
    applyFilters,
    applyMobileFilters,
    exportPdf,
  };
}
