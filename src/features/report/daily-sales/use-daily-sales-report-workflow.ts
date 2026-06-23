"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import {
  openLocalInvoiceBatchPrintWindow,
  type InvoicePrintData,
} from "@/features/pos/print/invoice-print-window";
import {
  buildSalesListInvoicePrintData,
  type BillSource,
} from "@/features/sales/list/sales-list-utils";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import { pageLimitSize } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { ApiEntity } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import {
  authStoreUuid,
  useAuthStore,
  type AuthUser,
} from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import {
  createDailySalesBillGroups,
  type DailySalesBillGroup,
  useDailySalesReportStore,
} from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import type {
  ReportExportData,
  ReportExportAction,
  ReportExportProgress,
  ReportFilters,
} from "./daily-sales-report-types";
import {
  hasDisplayValue,
  readValue,
} from "./daily-sales-report-utils";
import {
  reportColumns,
  reportDetailItemColumns,
  summaryConfigs,
} from "./daily-sales-report-columns";
import {
  dateTotalsFromGroups,
  exportBillRows,
  exportDateTotalRows,
  exportSummaryRows,
  exportTableRows,
  reportFileBaseName,
  selectedDetailBillGroups,
  waitForImages,
  waitForPaint,
} from "./daily-sales-report-export-utils";
import {
  branchOptionFromRow,
  detailPaginationBasis,
  localDateInputValue,
  paymentMethodParam,
  reportRecordId,
  reportTotalFromBillGroups,
  reportTotalFromRows,
  selectedBranchLabel,
} from "./daily-sales-report-utils";

export function useDailySalesReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
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
  const rows = useDailySalesReportStore((state) => state.rows);
  const summaryCards = useDailySalesReportStore((state) => state.summaryCards);
  const reportTotal = useDailySalesReportStore((state) => state.reportTotal);
  const loading = useDailySalesReportStore((state) => state.loading);
  const error = useDailySalesReportStore((state) => state.error);
  const total = useDailySalesReportStore((state) => state.total);
  const totalPages = useDailySalesReportStore((state) => state.totalPages);
  const loadReport = useDailySalesReportStore((state) => state.load);
  const loadExportData = useDailySalesReportStore((state) => state.loadExportData);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<ReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    limit: initialPagination.limit,
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
  const [exportProgress, setExportProgress] =
    useState<ReportExportProgress | null>(null);
  const [exportData, setExportData] = useState<ReportExportData | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { changeLimit, page, setPage } = useUrlPagination({ initialPagination });

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
  const detailItemColumns = useMemo(() => {
    const allItems = billGroups.flatMap((group) => group.items);
    const hasStatusData = allItems.some((item) =>
      hasDisplayValue(
        readValue(item, [
          "status_name",
          "status_text",
          "status",
          "status_code",
          "order_status_text",
          "order_it_status_text",
        ]),
      ),
    );
    const columns = reportDetailItemColumns(t);
    return hasStatusData
      ? columns
      : columns.filter((col) => col.kind !== "status");
  }, [billGroups, t]);
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
  const exportSurfaceReady = Boolean(exportData);
  const renderedExportData = exportData ?? {
    billGroups: [],
    grandTotalByDate: [],
    reportTotal: {},
    rows: [],
    summaryCards: {},
  };
  const allDetailGroupsExpanded =
    billGroups.length > 0 &&
    billGroups.every((group) => !collapsedBillGroups.has(group.id));
  const selectedCount = selectedRecordIds.size;
  const selectedReceiptBillGroups = useMemo(
    () => selectedBillGroupsForReceipt(billGroups, selectedRecordIds),
    [billGroups, selectedRecordIds],
  );
  const selectedBillCount = selectedReceiptBillGroups.length;
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
        payment_type: paymentMethodParam(appliedFilters.paymentMethod),
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
    changeLimit(nextFilters.limit);
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
    changeLimit(nextFilters.limit);
    setMobileFilterOpen(false);
  }

  function applyTableHeaderFilters(
    patch: Pick<Partial<ReportFilters>, "paymentMethod" | "typePage">,
  ) {
    const nextFilters = normalizeBranchFilters({
      ...appliedFilters,
      ...patch,
    });
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    changeLimit(nextFilters.limit);
    setPage(1);
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

    const data = await loadExportData({
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      lang: language,
      orderBy: appliedFilters.orderBy,
      payment_method: paymentMethodParam(appliedFilters.paymentMethod),
      payment_type: paymentMethodParam(appliedFilters.paymentMethod),
      type_page: appliedFilters.typePage,
    });
    const allRows = data.rows;
    const allBillGroups = data.billGroups;

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
          : data.reportTotal;

    return {
      ...data,
      billGroups: billGroupsForExport,
      grandTotalByDate: selectedRecordIds.size
        ? dateTotalsFromGroups(billGroupsForExport)
        : data.grandTotalByDate,
      reportTotal: selectedReportTotal,
      rows: rowsForExport,
      summaryCards: selectedRecordIds.size
        ? selectedReportTotal
        : data.summaryCards,
    };
  }, [appliedFilters, branchUuid, language, loadExportData, selectedRecordIds, t]);

  function updateExportProgress(percent: number, labelKey: string) {
    setExportProgress({
      label: t(labelKey),
      percent: Math.min(100, Math.max(0, percent)),
    });
  }

  async function exportExcel() {
    if (exportDisabled) return;
    setExporting("excel");
    updateExportProgress(5, "report.exportProgress.fetching");
    try {
      await waitForPaint();
      const data = await fetchExportData();
      updateExportProgress(35, "report.exportProgress.preparing");
      await waitForPaint();
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      updateExportProgress(65, "report.exportProgress.buildingFile");
      await waitForPaint();
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
          XLSX.utils.json_to_sheet(
            exportBillRows(data.billGroups, t, true),
          ),
          "Bills",
        );
        XLSX.utils.book_append_sheet(workbook, rowsSheet, "Items");
      } else {
        XLSX.utils.book_append_sheet(workbook, rowsSheet, "Rows");
      }
      updateExportProgress(90, "report.exportProgress.saving");
      await waitForPaint();
      XLSX.writeFile(workbook, `${reportFileBaseName(appliedFilters)}.xlsx`);
      updateExportProgress(100, "report.exportProgress.done");
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
      setExportProgress(null);
    }
  }

  async function exportPdf() {
    if (exportDisabled) return;
    setExporting("pdf");
    updateExportProgress(5, "report.exportProgress.fetching");
    try {
      await waitForPaint();
      const data = await fetchExportData();
      updateExportProgress(25, "report.exportProgress.rendering");
      setExportData(data);
      await waitForPaint();

      const element = exportReportRef.current;
      if (!element) throw new Error(t("report.exportFailed"));
      updateExportProgress(40, "report.exportProgress.loadingImages");
      await waitForPaint();
      await waitForImages(element);

      updateExportProgress(55, "report.exportProgress.capturing");
      await waitForPaint();
      const [{ jsPDF }, html2canvasModule] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvasModule.default(element, {
        backgroundColor: "#ffffff",
        imageTimeout: 2000,
        scale: pdfCanvasScale(data.rows.length),
        useCORS: true,
        windowHeight: element.scrollHeight,
        windowWidth: element.scrollWidth,
      });
      updateExportProgress(80, "report.exportProgress.buildingPdf");
      await waitForPaint();
      const pdf = new jsPDF({
        format: "a4",
        orientation: "landscape",
        unit: "pt",
      });
      addCanvasToPdfPages(pdf, canvas, element);

      updateExportProgress(95, "report.exportProgress.saving");
      await waitForPaint();
      pdf.save(`${reportFileBaseName(appliedFilters)}.pdf`);
      updateExportProgress(100, "report.exportProgress.done");
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
      setExportProgress(null);
      setExportData(null);
    }
  }

  async function printReport() {
    if (loading || exporting) return;
    if (!user) return;
    if (!selectedBillCount) {
      showToast({
        title: t("report.printFailed"),
        description: t("report.selectBillsToPrint"),
        tone: "info",
      });
      return;
    }

    setExporting("print");
    try {
      const receipts = selectedReceiptBillGroups.map((group) =>
        buildDailySalesReceiptPrintData({
          group,
          translate: (key, options) => String(t(key, options)),
          user,
        }),
      );

      const opened = await openLocalInvoiceBatchPrintWindow(receipts);
      if (!opened) throw new Error(t("report.printPopupBlocked"));

      showToast({
        title: t("report.printReady"),
        description: t("report.printedBills", { count: receipts.length }),
        tone: "success",
      });
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
    exportProgress,
    exportSurfaceReady,
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
    selectedBillCount,
    selectedRecordIds,
    setDraftFilters,
    setPage,
    summaryCards,
    toggleBillGroup,
    toggleReportRow,
    toggleReportRows,
    totalPages,
    applyTableHeaderFilters,
    applyFilters,
    applyMobileFilters,
    exportPdf,
  };
}

function pdfCanvasScale(rowCount: number) {
  const deviceScale = window.devicePixelRatio || 1.5;
  if (rowCount > 120) return 1;
  if (rowCount > 40) return Math.min(1.25, deviceScale);
  return Math.min(1.5, deviceScale);
}

type PdfDocument = {
  addImage: (
    imageData: string,
    format: "PNG",
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  addPage: () => void;
  internal: {
    pageSize: {
      getHeight: () => number;
      getWidth: () => number;
    };
  };
};

function addCanvasToPdfPages(
  pdf: PdfDocument,
  canvas: HTMLCanvasElement,
  sourceElement: HTMLElement,
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCanvasHeight = Math.floor((pageHeight / pageWidth) * canvas.width);
  const pageBreaks = getCanvasPageBreaks(sourceElement, canvas);
  let pageStart = 0;
  let isFirstPage = true;

  while (pageStart < canvas.height) {
    const pageEnd = choosePdfPageEnd(
      pageStart,
      Math.min(pageStart + pageCanvasHeight, canvas.height),
      canvas.height,
      pageBreaks,
    );
    const sliceHeight = Math.max(1, pageEnd - pageStart);
    const sliceCanvas = document.createElement("canvas");
    const context = sliceCanvas.getContext("2d");

    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeight;
    if (!context) break;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    context.drawImage(
      canvas,
      0,
      pageStart,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    if (!isFirstPage) pdf.addPage();
    pdf.addImage(
      sliceCanvas.toDataURL("image/png", 1),
      "PNG",
      0,
      0,
      pageWidth,
      (sliceHeight * pageWidth) / canvas.width,
    );

    isFirstPage = false;
    pageStart = pageEnd;
  }
}

function selectedBillGroupsForReceipt(
  groups: DailySalesBillGroup[],
  selectedRecordIds: Set<string>,
) {
  if (!selectedRecordIds.size) return [];

  return groups.filter((group) =>
    group.items.some((item) => selectedRecordIds.has(reportRecordId(item))),
  );
}

function buildDailySalesReceiptPrintData({
  group,
  translate,
  user,
}: {
  group: DailySalesBillGroup;
  translate: (key: string, options?: Record<string, unknown>) => string;
  user: AuthUser;
}): InvoicePrintData {
  return buildSalesListInvoicePrintData({
    bill: dailySalesReceiptBillSource(group),
    translate,
    user,
  });
}

function dailySalesReceiptBillSource(group: DailySalesBillGroup): BillSource {
  return {
    amount: group.amountTotal,
    branch_name: group.branchName,
    cashier_name: group.cashierName,
    change_amount: group.changeAmount,
    debt_amount: group.debtAmount,
    discount_bill: group.discountBillAmount,
    discount_amount: group.discountBillAmount,
    grand_total: group.lineTotal,
    invoice_number: group.invoiceNumber,
    item_discount_amount: group.itemDiscountAmount,
    items: group.items.map((item) => ({
      ...item,
      item_discount_amount: readValue(item, [
        "discount_total",
        "discount_amount",
        "item_discount_amount",
        "discount",
      ]),
      line_total: readValue(item, ["total", "line_total", "net_total"]),
      price: readValue(item, ["sale_price", "price", "unit_price"]),
      topping_unit_total: readValue(item, [
        "topping_total",
        "topping_unit_total",
      ]),
    })),
    net_total: group.lineTotal,
    order_grand_total: group.lineTotal,
    order_invoice: group.invoiceNumber,
    order_total: group.amountTotal,
    receive_cash: group.receiveCashAmount,
    receive_transfer: group.receiveTransferAmount,
    sale_date: group.saleDate,
    service_charge_amount: group.serviceChargeAmount,
    status: group.status,
    table_name: group.tableName,
    total: group.lineTotal,
    vat_amount: group.vatAmount,
  };
}

function getCanvasPageBreaks(
  sourceElement: HTMLElement,
  canvas: HTMLCanvasElement,
) {
  const rootRect = sourceElement.getBoundingClientRect();
  const scaleY = canvas.height / sourceElement.scrollHeight;
  const billStarts = canvasPositions(
    sourceElement.querySelectorAll("tr.is-bill"),
    rootRect.top,
    scaleY,
    canvas.height,
    "top",
  );

  return {
    fallback: canvasPositions(
      sourceElement.querySelectorAll("tr"),
      rootRect.top,
      scaleY,
      canvas.height,
      "bottom",
    ),
    preferred: billStarts,
  };
}

function canvasPositions(
  rows: NodeListOf<Element>,
  rootTop: number,
  scaleY: number,
  canvasHeight: number,
  edge: "bottom" | "top",
) {
  return Array.from(rows)
    .map((row) => {
      const rowRect = row.getBoundingClientRect();
      const y = edge === "top" ? rowRect.top : rowRect.bottom;
      return Math.round((y - rootTop) * scaleY);
    })
    .filter((value) => value > 0 && value < canvasHeight)
    .sort((left, right) => left - right);
}

function choosePdfPageEnd(
  pageStart: number,
  maxEnd: number,
  canvasHeight: number,
  pageBreaks: { fallback: number[]; preferred: number[] },
) {
  if (maxEnd >= canvasHeight) return canvasHeight;

  const minUsefulHeight = pageStart + 120;
  const safeMaxEnd = maxEnd - 8;
  const preferredBoundary = pageBreaks.preferred
    .filter((value) => value > minUsefulHeight && value <= safeMaxEnd)
    .at(-1);
  const fallbackBoundary = pageBreaks.fallback
    .filter((value) => value > minUsefulHeight && value <= safeMaxEnd)
    .at(-1);

  return preferredBoundary ?? fallbackBoundary ?? maxEnd;
}