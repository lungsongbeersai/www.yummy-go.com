"use client";

import { addReportCanvasToPdfPages } from "@/lib/export/pdf";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
  type SetStateAction,
} from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { useTranslation } from "react-i18next";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { localDateInputValue } from "@/lib/format";
import { pageLimitSize } from "@/lib/pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { ApiEntity } from "@/services/shared/types";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useReportBranchSelection } from "../shared/use-report-branch-selection";
import {
  type DailySalesBillGroup,
  useCategorySalesReportStore,
  useDailySaleItemsStore,
  useDailySalesBillReportStore,
  useDailySalesOrderReportStore,
} from "@/stores/report-store";
import { useToastStore } from "@/stores/toast-store";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { createDailySalesDetailExcelWorkbook } from "./daily-sales-detail-excel";
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
  buildDailySalesPrintData,
  buildDailySalesReportOps,
  renderDailySalesPrintHtml,
} from "./daily-sales-report-print";
import {
  reportColumns,
  reportDetailItemColumns,
  summaryConfigs,
} from "./daily-sales-report-columns";
import {
  dateTotalsFromGroups,
  exportInfoRows,
  exportSummaryRows,
  exportTableRows,
  reportExportColumns,
  reportFileBaseName,
  selectedDetailBillGroups,
  waitForImages,
  waitForPaint,
} from "./daily-sales-report-export-utils";
import {
  billPaymentMethodParam,
  detailPaymentMethodParam,
  paymentMethodLabel,
  reportRecordId,
  reportTotalFromBillGroups,
  reportTotalFromRows,
} from "./daily-sales-report-utils";

const EMPTY_BILL_GROUPS: DailySalesBillGroup[] = [];

export function useDailySalesReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
  // สถานะการแสดง summary cards ใน UI — ไฟล์ export ต้องมีส่วนสรุปตรงกับที่ผู้ใช้เห็น
  summaryVisible: boolean,
) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const {
    branchError,
    branchLabelFor,
    branchLoading,
    branchNormalizationKey,
    branchOptions,
    canSelectBranch,
    defaultBranchUuid,
    normalizeBranchFilters,
  } = useReportBranchSelection();
  const detailBillGroups = useDailySalesOrderReportStore((state) => state.billGroups);
  const detailRows = useDailySalesOrderReportStore((state) => state.rows);
  const detailSummaryCards = useDailySalesOrderReportStore((state) => state.summaryCards);
  const detailReportTotal = useDailySalesOrderReportStore((state) => state.reportTotal);
  const detailLoading = useDailySalesOrderReportStore((state) => state.loading);
  const detailError = useDailySalesOrderReportStore((state) => state.error);
  const detailTotal = useDailySalesOrderReportStore((state) => state.total);
  const detailTotalPages = useDailySalesOrderReportStore((state) => state.totalPages);
  const loadDetailReport = useDailySalesOrderReportStore((state) => state.load);
  const loadDetailExportData = useDailySalesOrderReportStore((state) => state.loadExportData);
  const loadDailySaleItems = useDailySaleItemsStore((state) => state.load);
  const loadCategorySalesExportData = useCategorySalesReportStore((state) => state.loadExportData);
  const billRows = useDailySalesBillReportStore((state) => state.rows);
  const billSummary = useDailySalesBillReportStore((state) => state.summary);
  const billLoading = useDailySalesBillReportStore((state) => state.loading);
  const billError = useDailySalesBillReportStore((state) => state.error);
  const billTotal = useDailySalesBillReportStore((state) => state.total);
  const billTotalPages = useDailySalesBillReportStore((state) => state.totalPages);
  const loadBillReport = useDailySalesBillReportStore((state) => state.load);
  const loadBillExportData = useDailySalesBillReportStore((state) => state.loadExportData);
  const executeReport = usePrinterStore((state) => state.executeReport);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const submitReportPrint = usePrinterStore((state) => state.submitReportPrint);
  const showToast = useToastStore((state) => state.show);
  const today = useMemo(() => localDateInputValue(), []);

  const [draftFilters, setDraftFilters] = useState<ReportFilters>({
    branchUuid: user?.branch_uuid ?? "",
    dateFrom: today,
    dateTo: today,
    limit: initialPagination.limit,
    orderBy: "DESC",
    paymentMethod: "All",
    search: "",
    typePage: "bill",
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
  const [billPage, setBillPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);

  const branchUuid = appliedFilters.branchUuid || defaultBranchUuid;
  const activeBranchLabel = useMemo(
    () => branchLabelFor(branchUuid),
    [branchLabelFor, branchUuid],
  );
  const isDetailTab = appliedFilters.typePage === "detail";
  const billGroups = isDetailTab ? detailBillGroups : EMPTY_BILL_GROUPS;
  const rows = isDetailTab ? detailRows : billRows;
  const summaryCards = isDetailTab ? detailSummaryCards : billSummary;
  const reportTotal = isDetailTab ? detailReportTotal : billSummary;
  const loading = isDetailTab ? detailLoading : billLoading;
  const error = isDetailTab ? detailError : billError;
  const total = isDetailTab ? detailTotal : billTotal;
  const totalPages = isDetailTab ? detailTotalPages : billTotalPages;
  const page = isDetailTab ? detailPage : billPage;
  const columns = useMemo(
    () => reportColumns(t, appliedFilters.typePage),
    [appliedFilters.typePage, t],
  );
  // ตัดคอลัมน์ "ຈ່າຍລ່າສຸດ" ออกจาก Excel/PDF export แต่ยังโชว์บนตารางหน้าจอปกติ
  const exportColumns = useMemo(() => reportExportColumns(columns), [columns]);
  const detailItemColumns = useMemo(() => {
    const allItems = detailBillGroups.flatMap((group) => group.items);
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
  }, [detailBillGroups, t]);
  const cards = useMemo(
    () => summaryConfigs(t, appliedFilters.typePage),
    [appliedFilters.typePage, t],
  );
  const detailPageBasis = "bills" as const;
  const visibleCount = appliedFilters.typePage === "detail" ? billGroups.length : rows.length;
  const activePageLimit = pageLimitSize(appliedFilters.limit, visibleCount);
  const pageStart = visibleCount ? (page - 1) * activePageLimit + 1 : 0;
  const pageEnd = visibleCount ? pageStart + visibleCount - 1 : 0;
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
  const detailRangeLabel = t("report.showingBillsRange", {
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
  const setPage = useCallback(
    (nextPage: SetStateAction<number>) => {
      if (isDetailTab) {
        setDetailPage((current) => normalizePage(nextPage, current, detailTotalPages));
        return;
      }
      setBillPage((current) => normalizePage(nextPage, current, billTotalPages));
    },
    [billTotalPages, detailTotalPages, isDetailTab],
  );

  // รายการสาขาเปลี่ยน (โหลดเสร็จ/สลับร้าน) = ปรับสาขาใน filter ให้ยังใช้ได้เสมอ
  // ใช้ primitive key แทน callback identity เพื่อไม่ให้ reset ซ้ำทุก render
  useResetOnDeps([branchNormalizationKey], () => {
    setDraftFilters((current) => normalizeBranchFilters(current));
    setAppliedFilters((current) => normalizeBranchFilters(current));
  });

  const load = useCallback(async () => {
    if (!branchUuid) return;

    try {
      if (appliedFilters.typePage === "bill") {
        await loadBillReport({
          branch_uuid_fk: branchUuid,
          date_from: appliedFilters.dateFrom,
          date_to: appliedFilters.dateTo,
          lang: language,
          limit: appliedFilters.limit,
          orderBy: appliedFilters.orderBy,
          page: billPage,
          payment_method: billPaymentMethodParam(appliedFilters.paymentMethod),
          search: appliedFilters.search,
        });
        return;
      }

      await loadDetailReport({
        branch_uuid_fk: branchUuid,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        lang: language,
        limit: appliedFilters.limit,
        orderBy: appliedFilters.orderBy,
        page,
        payment_method: billPaymentMethodParam(appliedFilters.paymentMethod),
        search: appliedFilters.search,
      });
    } catch (error) {
      showToast({
        title: t("report.loadFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [
    appliedFilters,
    billPage,
    branchUuid,
    language,
    loadBillReport,
    loadDetailReport,
    page,
    showToast,
    t,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  // ข้อมูลหดลงจนหน้าปัจจุบันเกินช่วง = ดึงกลับมาหน้าสุดท้ายที่มีจริง
  useResetOnDeps([billPage, billTotalPages], () => {
    if (billPage > billTotalPages) setBillPage(Math.max(1, billTotalPages));
  });

  useResetOnDeps([detailPage, detailTotalPages], () => {
    if (detailPage > detailTotalPages) setDetailPage(Math.max(1, detailTotalPages));
  });

  // เปลี่ยนแท็บ/หน้า/ชุดข้อมูล = กลับไปกางทุกบิลใหม่
  useResetOnDeps([appliedFilters.typePage, page, rows], () => {
    setCollapsedBillGroups(new Set());
  });

  // เงื่อนไขค้นหาเปลี่ยน = แถวที่เคยติ๊กไว้ไม่ใช่ชุดเดิมอีกต่อไป ต้องล้างการเลือก
  useResetOnDeps(
    [
      appliedFilters.dateFrom,
      appliedFilters.dateTo,
      appliedFilters.limit,
      appliedFilters.orderBy,
      appliedFilters.paymentMethod,
      appliedFilters.search,
      appliedFilters.typePage,
      branchUuid,
    ],
    () => {
      setSelectedRecordIds(new Set());
    },
  );

  function applyNextFilters(nextFilters: ReportFilters, closeMobile = false) {
    if (nextFilters.branchUuid) setSelectedBranch(nextFilters.branchUuid);
    const resetPages = reportDataFilterKey(nextFilters) !== reportDataFilterKey(appliedFilters);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    if (resetPages) {
      setBillPage(1);
      setDetailPage(1);
    }
    if (closeMobile) setMobileFilterOpen(false);
  }

  function applyFilters() {
    const nextFilters = normalizeBranchFilters(draftFilters);
    applyNextFilters(nextFilters);
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
    applyNextFilters(nextFilters, true);
  }

  function applyTableHeaderFilters(
    patch: Pick<Partial<ReportFilters>, "paymentMethod" | "typePage">,
  ) {
    const nextFilters = normalizeBranchFilters({
      ...appliedFilters,
      ...patch,
    });
    applyNextFilters(nextFilters);
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

  const fetchExportData = useCallback(async (
    typePage: ReportFilters["typePage"] = appliedFilters.typePage,
    selectedIds = selectedRecordIds,
  ) => {
    if (!branchUuid) throw new Error(t("report.branchRequired"));

    if (typePage === "bill") {
      const data = await loadBillExportData({
        branch_uuid_fk: branchUuid,
        date_from: appliedFilters.dateFrom,
        date_to: appliedFilters.dateTo,
        lang: language,
        orderBy: appliedFilters.orderBy,
        payment_method: billPaymentMethodParam(appliedFilters.paymentMethod),
        search: appliedFilters.search,
      });
      const rowsForExport = selectedIds.size
        ? data.rows.filter((row) => selectedIds.has(reportRecordId(row)))
        : data.rows;
      const selectedReportTotal = selectedIds.size
        ? reportTotalFromRows(rowsForExport, "bill")
        : data.reportTotal;

      return {
        ...data,
        reportTotal: selectedReportTotal,
        rows: rowsForExport,
        summaryCards: selectedIds.size ? selectedReportTotal : data.summaryCards,
      };
    }

    const data = await loadDetailExportData({
      branch_uuid_fk: branchUuid,
      date_from: appliedFilters.dateFrom,
      date_to: appliedFilters.dateTo,
      lang: language,
      orderBy: appliedFilters.orderBy,
      payment_method: billPaymentMethodParam(appliedFilters.paymentMethod),
      search: appliedFilters.search,
    });
    const allRows = data.rows;
    const allBillGroups = data.billGroups;

    const billGroupsForExport =
      selectedIds.size
        ? selectedDetailBillGroups(allBillGroups, selectedIds)
        : allBillGroups;
    const rowsForExport =
      selectedIds.size
        ? billGroupsForExport.flatMap((group) => group.items)
        : allRows;
    const selectedReportTotal =
      selectedIds.size
        ? reportTotalFromBillGroups(billGroupsForExport)
        : data.reportTotal;

    return {
      ...data,
      billGroups: billGroupsForExport,
      grandTotalByDate: selectedIds.size
        ? dateTotalsFromGroups(billGroupsForExport)
        : data.grandTotalByDate,
      reportTotal: selectedReportTotal,
      rows: rowsForExport,
      summaryCards: selectedIds.size
        ? selectedReportTotal
        : data.summaryCards,
    };
  }, [
    appliedFilters,
    branchUuid,
    language,
    loadBillExportData,
    loadDetailExportData,
    selectedRecordIds,
    t,
  ]);

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
      const XLSX = await import("xlsx-js-style");
      updateExportProgress(65, "report.exportProgress.buildingFile");
      await waitForPaint();
      const layout = officialReportExcelLayout(t, t("report.dailySalesTitle"));
      const workbook = appliedFilters.typePage === "detail"
        ? createDailySalesDetailExcelWorkbook(XLSX, {
            billGroups: data.billGroups,
            branchLabel: activeBranchLabel,
            cards,
            dateFrom: appliedFilters.dateFrom,
            dateTo: appliedFilters.dateTo,
            dateTotals: data.grandTotalByDate,
            includeSummary: summaryVisible,
            layout,
            paymentMethodLabel: paymentMethodLabel(
              t,
              appliedFilters.paymentMethod,
            ),
            reportTotal: data.reportTotal,
            summaryCards: data.summaryCards,
            t,
          })
        : createSingleSheetReportWorkbook(
            XLSX,
            [
              {
                title: t("report.excel.reportInformation"),
                rows: exportInfoRows(t, {
                  branchLabel: activeBranchLabel,
                  dateFrom: appliedFilters.dateFrom,
                  dateTo: appliedFilters.dateTo,
                  paymentMethodLabel: paymentMethodLabel(
                    t,
                    appliedFilters.paymentMethod,
                  ),
                  typeLabel: t("report.salesReportByBill"),
                }),
              },
              ...(summaryVisible
                ? [
                    {
                      title: t("report.summary"),
                      rows: exportSummaryRows(
                        cards,
                        data.summaryCards,
                        data.reportTotal,
                      ),
                    },
                  ]
                : []),
              {
                title: t("report.excel.bills"),
                rows: exportTableRows(data.rows, exportColumns),
              },
            ],
            layout,
          );
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
      addReportCanvasToPdfPages(pdf, canvas, element);

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

    setExporting("print");
    let printWindow: Window | null = null;

    // เปิด/เรนเดอร์หน้าต่างพิมพ์เบราว์เซอร์ — ใช้เป็นแผนสำรองเท่านั้น เรียกเมื่อพิมพ์ผ่าน printer agent ไม่สำเร็จ
    // คืนค่าหน้าต่างที่เปิดกลับไปให้ผู้เรียก assign เอง เพื่อให้ catch ด้านนอก narrow type ได้ถูกต้อง
    async function fallbackToBrowserPrint(
      printData: ReturnType<typeof buildDailySalesPrintData>,
      existingWindow: Window | null,
    ): Promise<Window | null> {
      const targetWindow = existingWindow ?? openReceiptPrintWindow();
      if (!targetWindow) {
        showToast({ title: t("report.printFailed"), description: t("report.printPopupBlocked"), tone: "error" });
        return null;
      }

      renderReceiptPrintWindow(targetWindow, renderDailySalesPrintHtml(printData));
      showToast({ title: t("report.printReady"), tone: "success" });
      return targetWindow;
    }

    try {
      const categoryPaymentMethod = detailPaymentMethodParam(appliedFilters.paymentMethod);
      const [, categorySales] = await Promise.all([
        loadDailySaleItems({
          branch_uuid_fk: branchUuid,
          date_from: appliedFilters.dateFrom,
          date_to: appliedFilters.dateTo,
          lang: language,
          limit: "All",
          orderBy: appliedFilters.orderBy,
          page: 1,
          payment_method: billPaymentMethodParam(appliedFilters.paymentMethod),
          search: appliedFilters.search,
        }),
        loadCategorySalesExportData({
          branch_uuid_fk: branchUuid,
          date_from: appliedFilters.dateFrom,
          date_to: appliedFilters.dateTo,
          lang: language,
          orderBy: appliedFilters.orderBy,
          payment_method: categoryPaymentMethod === "mixed" ? "all" : categoryPaymentMethod,
        }),
      ]);
      const bills = useDailySaleItemsStore.getState().bills;
      if (!bills.length && !categorySales.groups.length) throw new Error(t("report.noData"));

      const labels = {
        billCount: t("report.dailyPrint.billCount"),
        cancelledBills: t("report.dailyPrint.cancelledBills"),
        cashReceived: t("report.columns.cashReceived"),
        categoryTotal: t("report.dailyPrint.categoryTotal"),
        debt: t("report.columns.debtAmount"),
        discount: t("report.columns.discount"),
        grandTotal: t("report.dailyPrint.grandTotal"),
        group: t("report.dailyPrint.group"),
        period: t("report.dailyPrint.period"),
        printedAt: t("report.dailyPrint.printedAt"),
        printedBy: t("report.dailyPrint.printedBy"),
        product: t("report.columns.productName"),
        quantity: t("report.columns.quantity"),
        revenueSummary: t("report.dailyPrint.revenueSummary"),
        serviceCharge: t("report.columns.serviceCharge"),
        subtotal: t("report.dailyPrint.subtotal"),
        title: t("report.dailyPrint.title"),
        totalAmount: t("report.columns.totalAmount"),
        totalQuantity: t("report.cards.totalQuantity"),
        transferReceived: t("report.columns.transferReceived"),
        vat: t("report.columns.vat"),
      };

      const data = buildDailySalesPrintData({
        bills,
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        labels,
        salesGroups: categorySales.groups,
        user,
      });

      // แยก try ของการพิมพ์ผ่าน agent ออกจากแผนสำรอง กันไม่ให้ fallback ที่พังซ้ำถูกจับแล้วเรียกซ้ำสอง
      let agentPrintOutcome: "success" | "fallback" | "failed" = "failed";
      try {
        const resolvedContext = await resolveDeviceIdentity();
        const response = await submitReportPrint({
          device_code: resolvedContext.device_code ?? "",
          report_key: "daily_sales",
          report_title: labels.title,
          lang: language,
          report_payload: {
            date_from: appliedFilters.dateFrom,
            date_to: appliedFilters.dateTo,
            grand_total: data.summary.grandTotal,
            bill_count: data.summary.activeBillCount,
          },
          print_document: {
            paper_width_mm: 80,
            copies: 1,
            cut_mode: "per_ticket",
            ops: buildDailySalesReportOps(data),
            browser_payload: { title: labels.title, html: renderDailySalesPrintHtml(data) },
          },
        });

        if (!response.pending_query) {
          agentPrintOutcome = "fallback";
        } else {
          let printStarted = false;
          const printResult = await executeReport({
            pending_query: response.pending_query,
            login_uuid_fk: user.uuid,
            onProgress: ({ phase }) => {
              if (phase === "printing") printStarted = true;
            },
          });

          if (printResult.successCount > 0 && printResult.failedCount === 0) {
            agentPrintOutcome = "success";
          } else if (printResult.failedCount > 0 && printStarted && !isCapacitorNativeApp()) {
            agentPrintOutcome = "fallback";
          }
        }
      } catch {
        agentPrintOutcome = "fallback";
      }

      if (agentPrintOutcome === "success") {
        showToast({ title: t("report.printReady"), tone: "success" });
        return;
      }

      if (agentPrintOutcome === "fallback") {
        printWindow = await fallbackToBrowserPrint(data, printWindow);
        return;
      }

      showToast({
        title: t("report.printFailed"),
        description: t("report.printMissingJob"),
        tone: "error",
      });
    } catch (error) {
      printWindow?.close();
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
    exportColumns,
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

function normalizePage(
  nextPage: SetStateAction<number>,
  currentPage: number,
  totalPages: number,
) {
  const resolved = typeof nextPage === "function" ? nextPage(currentPage) : nextPage;
  return Math.min(Math.max(1, resolved), Math.max(1, totalPages));
}

function reportDataFilterKey(filters: ReportFilters) {
  return [
    filters.branchUuid,
    filters.dateFrom,
    filters.dateTo,
    filters.limit,
    filters.orderBy,
    filters.paymentMethod,
    filters.search,
  ].join("|");
}

function selectedBillGroupsForReceipt(
  groups: DailySalesBillGroup[],
  selectedRecordIds: Set<string>,
) {
  if (!selectedRecordIds.size) return [];

  return groups.filter((group) =>
    dailySalesBillGroupSelectionIds(group).some((id) =>
      selectedRecordIds.has(id),
    ) ||
    group.items.some((item) => selectedRecordIds.has(reportRecordId(item))),
  );
}

function dailySalesBillGroupSelectionIds(group: DailySalesBillGroup) {
  return [
    group.id,
    `order:${group.id}`,
    group.invoiceNumber,
    `order:${group.invoiceNumber}`,
  ].filter(Boolean);
}
