"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useCategorySalesReportStore } from "@/stores/report-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { exportInfoRows } from "../shared/report-export-info";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { useStandardReportWorkflow } from "../shared/use-standard-report-workflow";
import type { CategorySalesExportData, CategorySalesReportFilters } from "./category-sales-report-types";
import {
  buildCategorySalesPrintData,
  buildCategorySalesReportOps,
  renderCategorySalesPrintHtml,
} from "./category-sales-report-print";
import {
  categorySalesFileBaseName,
  categorySalesGroupedSection,
  categorySalesGroupsFromRows,
  categorySalesRowId,
  categorySalesSummaryFromRows,
  emptyExportData,
  exportSummaryRows,
  paymentMethodFallbackOptions,
  selectedPaymentMethodLabel
} from "./category-sales-report-utils";

export function useCategorySalesReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState,
  // สถานะการแสดง summary cards ใน UI — ไฟล์ export ต้องมีส่วนสรุปตรงกับที่ผู้ใช้เห็น
  summaryVisible: boolean
) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const executeReport = usePrinterStore((state) => state.executeReport);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const submitReportPrint = usePrinterStore((state) => state.submitReportPrint);
  const [printing, setPrinting] = useState(false);
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

  // buildExcelWorkbook ต้องใช้ค่าที่คำนวณจากผลลัพธ์ของฮุกนี้เอง (activeBranchLabel/labelOverrides/
  // reportTitle ฯลฯ) — อ้างตรงๆ ในตัว config ไม่ได้เพราะ TS อนุมาน type ของ "report" แบบวนกลับเข้า
  // ตัวเองไม่ได้ (runtime ปลอดภัยเพราะ closure ถูกเรียกทีหลังเสมอ) จึงพักค่าไว้ใน ref แล้วอัปเดตผ่าน effect
  const excelContextRef = useRef({
    activeBranchLabel: "",
    activePaymentMethodLabel: "",
    dateFrom: "",
    dateTo: "",
    labelOverrides: {} as { sum_servicecharge?: string; sum_vate?: string },
    reportTitle: ""
  });

  const report = useStandardReportWorkflow<
    CategorySalesReportFilters,
    (typeof rows)[number],
    Parameters<typeof loadReport>[0],
    Parameters<typeof loadExportData>[0],
    CategorySalesExportData
  >({
    buildInitialFilters: ({ today, userBranchUuid, initialPagination: pagination }) => ({
      branchUuid: userBranchUuid,
      dateFrom: today,
      dateTo: today,
      limit: pagination.limit,
      orderBy: "DESC",
      paymentMethod: "all"
    }),
    initialPagination,
    error,
    getRowId: categorySalesRowId,
    loading,
    rows,
    total,
    totalPages,
    // ต่างจากรายงานอื่น: นับจำนวนกลุ่มที่เห็นจริงต่อหน้า ไม่ใช่จำนวนแถวสินค้า
    visibleRowCount: groups.length,
    buildLoadParams: ({ branchUuid, filters, language, page }) => ({
      branch_uuid_fk: branchUuid,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      lang: language,
      limit: filters.limit,
      orderBy: filters.orderBy,
      page,
      payment_method: filters.paymentMethod
    }),
    load: loadReport,
    loadFailedTitle: t("report.categorySales.loadFailed"),
    exportReportRef,
    buildExportParams: ({ branchUuid, filters, language }) => ({
      branch_uuid_fk: branchUuid,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      lang: language,
      orderBy: filters.orderBy,
      payment_method: filters.paymentMethod
    }),
    loadExportData,
    applySelection: (data, selection) => {
      if (!selection.selectedCount) return data;

      const selectedRows = data.rows.filter((row) =>
        selection.selectedRowIds.has(categorySalesRowId(row))
      );

      return {
        ...data,
        groups: categorySalesGroupsFromRows(data.groups, selectedRows),
        rows: selectedRows,
        summary: categorySalesSummaryFromRows(selectedRows)
      };
    },
    fileBaseName: categorySalesFileBaseName,
    buildExcelWorkbook: (XLSX, data) => {
      const context = excelContextRef.current;
      return createSingleSheetReportWorkbook(
        XLSX,
        [
          {
            title: t("report.excel.reportInformation"),
            rows: exportInfoRows(t, {
              branchLabel: context.activeBranchLabel,
              dateFrom: context.dateFrom,
              dateTo: context.dateTo,
              paymentMethodLabel: context.activePaymentMethodLabel
            })
          },
          ...(summaryVisible
            ? [
                {
                  title: t("report.summary"),
                  rows: exportSummaryRows(data.summary, t, context.labelOverrides)
                }
              ]
            : []),
          categorySalesGroupedSection(data.groups, data.summary, t, context.labelOverrides)
        ],
        officialReportExcelLayout(t, data.reportName || context.reportTitle)
      );
    }
  });

  const methodOptions = paymentMethodFallbackOptions(t);
  const activePaymentMethodLabel = selectedPaymentMethodLabel(methodOptions, report.appliedFilters.paymentMethod, t);
  const activeBranchLabel = report.branchLabelFor(report.branchUuid);
  const reportTitle = reportName || t("report.categorySales.title");
  const renderedExportData = report.exportData ?? { ...emptyExportData(), groups, reportName, rows, summary };

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

  // ห้ามเขียน ref ระหว่าง render (react-hooks/refs) — อัปเดตผ่าน effect แทน ยังปลอดภัยเพราะ
  // buildExcelWorkbook ถูกเรียกจากปุ่ม export เท่านั้น ซึ่งเกิดหลัง effect นี้รันเสมอ
  useEffect(() => {
    excelContextRef.current = {
      activeBranchLabel,
      activePaymentMethodLabel,
      dateFrom: report.appliedFilters.dateFrom,
      dateTo: report.appliedFilters.dateTo,
      labelOverrides,
      reportTitle
    };
  });

  async function printReport() {
    if (report.loading || report.exporting || printing) return;
    if (!user) return;

    setPrinting(true);
    let printWindow: Window | null = null;

    // เปิด/เรนเดอร์หน้าต่างพิมพ์เบราว์เซอร์ — ใช้เป็นแผนสำรองเท่านั้น เรียกเมื่อพิมพ์ผ่าน printer agent ไม่สำเร็จ
    async function fallbackToBrowserPrint(
      printData: ReturnType<typeof buildCategorySalesPrintData>,
      existingWindow: Window | null,
    ): Promise<Window | null> {
      const targetWindow = existingWindow ?? openReceiptPrintWindow();
      if (!targetWindow) {
        showToast({ title: t("report.printFailed"), description: t("report.printPopupBlocked"), tone: "error" });
        return null;
      }

      renderReceiptPrintWindow(targetWindow, renderCategorySalesPrintHtml(printData));
      showToast({ title: t("report.printReady"), tone: "success" });
      return targetWindow;
    }

    try {
      const printLabels = {
        grandTotal: t("report.categorySales.columns.grandTotal"),
        groupLabel: t("report.categorySales.columns.group"),
        groupTotal: t("report.categorySales.printGroupTotal"),
        itemsHeaderLeft: t("report.categorySales.columns.product"),
        itemsHeaderRight: t("report.columns.totalAmount"),
        period: t("report.dailyPrint.period"),
        printedAt: t("report.dailyPrint.printedAt"),
        printedBy: t("report.dailyPrint.printedBy"),
        title: reportTitle,
      };

      // groups/summary บนหน้าจอถูกแบ่งหน้า (จำกัดจำนวนกลุ่มต่อหน้า) ใบพิมพ์ต้องใช้ข้อมูลเต็มเสมอ
      // ไม่งั้นร้านที่มีหลายหมวดหมู่จะพิมพ์ตกกลุ่มที่ไม่ได้อยู่หน้าปัจจุบัน
      const exportData = await loadExportData({
        branch_uuid_fk: report.branchUuid,
        date_from: report.appliedFilters.dateFrom,
        date_to: report.appliedFilters.dateTo,
        lang: language,
        orderBy: report.appliedFilters.orderBy,
        payment_method: report.appliedFilters.paymentMethod,
      });

      const data = buildCategorySalesPrintData({
        dateFrom: report.appliedFilters.dateFrom,
        dateTo: report.appliedFilters.dateTo,
        groups: exportData.groups,
        labels: printLabels,
        summary: exportData.summary,
        user,
      });

      // แยก try ของการพิมพ์ผ่าน agent ออกจากแผนสำรอง กันไม่ให้ fallback ที่พังซ้ำถูกจับแล้วเรียกซ้ำสอง
      let agentPrintOutcome: "success" | "fallback" | "failed" = "failed";
      try {
        const resolvedContext = await resolveDeviceIdentity();
        const response = await submitReportPrint({
          device_code: resolvedContext.device_code ?? "",
          report_key: "category_sales",
          report_title: printLabels.title,
          lang: language,
          report_payload: {
            date_from: report.appliedFilters.dateFrom,
            date_to: report.appliedFilters.dateTo,
            grand_total: data.grandTotal,
          },
          print_document: {
            paper_width_mm: 80,
            copies: 1,
            cut_mode: "per_ticket",
            ops: buildCategorySalesReportOps(data),
            browser_payload: { title: printLabels.title, html: renderCategorySalesPrintHtml(data) },
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
      setPrinting(false);
    }
  }

  return {
    ...report,
    activeBranchLabel,
    activePaymentMethodLabel,
    exportDisabled: report.exportDisabled || printing,
    exporting: report.exporting ?? (printing ? "print" : null),
    groups,
    labelOverrides,
    methodOptions,
    printReport,
    renderedExportData,
    reportTitle,
    rows,
    summary
  };
}
