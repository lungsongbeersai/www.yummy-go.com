"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePaymentMethodsReportStore } from "@/stores/report-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { exportInfoRows } from "../shared/report-export-info";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { useStandardReportWorkflow } from "../shared/use-standard-report-workflow";
import type { PaymentMethodsExportData, PaymentMethodsReportFilters } from "./payment-methods-report-types";
import {
  buildPaymentMethodsPrintData,
  buildPaymentMethodsReportOps,
  renderPaymentMethodsPrintHtml,
} from "./payment-methods-report-print";
import {
  emptyExportData,
  exportPaymentMethodRows,
  paymentMethodCardsForTotal,
  paymentMethodOptions,
  paymentMethodReportRowId,
  paymentMethodReportTotalFromRows,
  paymentMethodsFileBaseName,
  selectedPaymentMethodLabel
} from "./payment-methods-report-utils";

export function usePaymentMethodsReportWorkflow(
  exportReportRef: RefObject<HTMLDivElement | null>,
  initialPagination: UrlPaginationState
) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const executeReport = usePrinterStore((state) => state.executeReport);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const submitReportPrint = usePrinterStore((state) => state.submitReportPrint);
  const [printing, setPrinting] = useState(false);
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

  // buildExcelWorkbook ต้องใช้ activeBranchLabel/activePaymentMethodLabel/reportTitle ที่คำนวณจาก
  // ผลลัพธ์ของฮุกนี้เอง (branchLabelFor/appliedFilters) — อ้างตรงๆ ในตัว config ไม่ได้เพราะ TS อนุมาน
  // type ของ "report" แบบวนกลับเข้าตัวเองไม่ได้ (แม้ runtime จะปลอดภัยเพราะ closure ถูกเรียกทีหลังเสมอ)
  // จึงพักค่าไว้ใน ref แล้วอัปเดตท้ายทุก render แทน
  const excelContextRef = useRef({
    activeBranchLabel: "",
    activePaymentMethodLabel: "",
    dateFrom: "",
    dateTo: "",
    reportTitle: "",
  });

  const report = useStandardReportWorkflow<
    PaymentMethodsReportFilters,
    (typeof rows)[number],
    Parameters<typeof loadReport>[0],
    Parameters<typeof loadExportData>[0],
    PaymentMethodsExportData
  >({
    buildInitialFilters: ({ today, userBranchUuid, initialPagination: pagination }) => ({
      branchUuid: userBranchUuid,
      dateFrom: today,
      dateTo: today,
      limit: pagination.limit,
      paymentMethod: "all"
    }),
    initialPagination,
    error,
    getRowId: paymentMethodReportRowId,
    loading,
    rows,
    total,
    totalPages,
    visibleRowCount: rows.length,
    buildLoadParams: ({ branchUuid, filters, language, page }) => ({
      branch_uuid_fk: branchUuid,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      lang: language,
      limit: filters.limit,
      page,
      payment_method: filters.paymentMethod
    }),
    load: loadReport,
    loadFailedTitle: t("report.paymentMethodsReport.loadFailed"),
    exportReportRef,
    buildExportParams: ({ branchUuid, filters, language }) => ({
      branch_uuid_fk: branchUuid,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      lang: language,
      payment_method: filters.paymentMethod
    }),
    loadExportData,
    applySelection: (data, selection) => {
      if (!selection.selectedCount) return data;

      const selectedRows = data.rows.filter((row) =>
        selection.selectedRowIds.has(paymentMethodReportRowId(row))
      );
      const selectedReportTotal = paymentMethodReportTotalFromRows(selectedRows);

      return {
        ...data,
        cards: paymentMethodCardsForTotal(data.cards, selectedReportTotal),
        reportTotal: selectedReportTotal,
        rows: selectedRows
      };
    },
    fileBaseName: paymentMethodsFileBaseName,
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
          {
            title: t("report.excel.rows"),
            rows: exportPaymentMethodRows(data.rows, t, data.reportTotal)
          }
        ],
        officialReportExcelLayout(t, data.reportName || context.reportTitle)
      );
    }
  });

  const methodOptions = paymentMethodOptions(paymentMethods, t);
  const activePaymentMethodLabel = selectedPaymentMethodLabel(paymentMethods, report.appliedFilters.paymentMethod, t);
  const activeBranchLabel = report.branchLabelFor(report.branchUuid);
  const reportTitle = reportName || t("report.paymentMethodsReport.title");
  const renderedExportData = report.exportData ?? { cards, reportName, reportTotal, rows };

  // ห้ามเขียน ref ระหว่าง render (react-hooks/refs) — อัปเดตผ่าน effect แทน ยังปลอดภัยเพราะ
  // buildExcelWorkbook ถูกเรียกจากปุ่ม export เท่านั้น ซึ่งเกิดหลัง effect นี้รันเสมอ
  useEffect(() => {
    excelContextRef.current = {
      activeBranchLabel,
      activePaymentMethodLabel,
      dateFrom: report.appliedFilters.dateFrom,
      dateTo: report.appliedFilters.dateTo,
      reportTitle,
    };
  });

  async function printReport() {
    if (report.loading || report.exporting || printing) return;
    if (!user) return;

    setPrinting(true);
    let printWindow: Window | null = null;

    // เปิด/เรนเดอร์หน้าต่างพิมพ์เบราว์เซอร์ — ใช้เป็นแผนสำรองเท่านั้น เรียกเมื่อพิมพ์ผ่าน printer agent ไม่สำเร็จ
    async function fallbackToBrowserPrint(
      printData: ReturnType<typeof buildPaymentMethodsPrintData>,
      existingWindow: Window | null,
    ): Promise<Window | null> {
      const targetWindow = existingWindow ?? openReceiptPrintWindow();
      if (!targetWindow) {
        showToast({ title: t("report.printFailed"), description: t("report.printPopupBlocked"), tone: "error" });
        return null;
      }

      renderReceiptPrintWindow(targetWindow, renderPaymentMethodsPrintHtml(printData));
      showToast({ title: t("report.printReady"), tone: "success" });
      return targetWindow;
    }

    try {
      const printLabels = {
        grandTotal: t("report.paymentMethodsReport.columns.grandTotal"),
        period: t("report.dailyPrint.period"),
        printedAt: t("report.dailyPrint.printedAt"),
        printedBy: t("report.dailyPrint.printedBy"),
        title: reportTitle,
      };

      const data = buildPaymentMethodsPrintData({
        dateFrom: report.appliedFilters.dateFrom,
        dateTo: report.appliedFilters.dateTo,
        labels: printLabels,
        reportTotal,
        rows,
        user,
      });

      // แยก try ของการพิมพ์ผ่าน agent ออกจากแผนสำรอง กันไม่ให้ fallback ที่พังซ้ำถูกจับแล้วเรียกซ้ำสอง
      let agentPrintOutcome: "success" | "fallback" | "failed" = "failed";
      try {
        const resolvedContext = await resolveDeviceIdentity();
        const response = await submitReportPrint({
          device_code: resolvedContext.device_code ?? "",
          report_key: "payment_methods",
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
            ops: buildPaymentMethodsReportOps(data),
            browser_payload: { title: printLabels.title, html: renderPaymentMethodsPrintHtml(data) },
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
    cards,
    exportDisabled: report.exportDisabled || printing,
    exporting: report.exporting ?? (printing ? "print" : null),
    methodOptions,
    printReport,
    renderedExportData: renderedExportData ?? emptyExportData(),
    reportTitle,
    reportTotal,
    rows
  };
}
