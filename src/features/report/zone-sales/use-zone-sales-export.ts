"use client";

import { useExportCurrent } from "@/hooks/use-export-current";
import { printExportHtml } from "@/lib/export/print";
import { canUseReportPrintFallback } from "../shared/report-print-fallback";

import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import { useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import type { ZoneSalesResponse } from "@/services/report";
import { exportInfoRows } from "../shared/report-export-info";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { useReportExportActions } from "../shared/use-report-export-actions";
import {
  buildZoneSalesPrintData,
  buildZoneSalesReportOps,
  renderZoneSalesPrintHtml,
} from "./zone-sales-print";
import {
  zoneSalesFileBaseName,
  zoneSalesRowId,
  zoneSalesSummaryFromRows,
  zoneSalesSummaryRows,
  zoneSalesTableSection,
  type ZoneSalesExportData,
} from "./zone-sales-excel";

// รายงานนี้โหลดข้อมูลทั้งช่วงวันที่ในครั้งเดียวอยู่แล้ว ไม่มี page/limit ด้วยซ้ำ (โซนมีจำนวนน้อย) —
// fetchExportData ใช้ current.zone_reports/summary ที่อยู่ใน memory แล้วโดยตรง ไม่ยิง API ซ้ำ
export function useZoneSalesExport({
  branchLabel,
  current,
  dateFrom,
  dateTo,
  exportReportRef,
  language,
  loading,
  reportTitle,
  selectedCount,
  selectedRowIds,
}: {
  branchLabel: string;
  current: ZoneSalesResponse | null;
  dateFrom: string;
  dateTo: string;
  exportReportRef: RefObject<HTMLDivElement | null>;
  language: string;
  loading: boolean;
  reportTitle: string;
  selectedCount: number;
  selectedRowIds: Set<string>;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const executeReport = usePrinterStore((state) => state.executeReport);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const submitReportPrint = usePrinterStore((state) => state.submitReportPrint);
  const [printing, setPrinting] = useState(false);

  // เลือกแถวไว้ก่อน export Excel/PDF = ส่งออกเฉพาะโซนที่เลือก พร้อมสรุปยอดใหม่ตามแถวที่เลือก
  // (พิมพ์ผ่าน printer agent ไม่ผูกกับการเลือกแถว — พิมพ์ทั้งรายงานเสมอ ตรงกับรายงานอื่น)
  async function fetchExportData(): Promise<ZoneSalesExportData> {
    if (!current) throw new Error(t("report.branchRequired"));
    if (!selectedCount) return { reportName: reportTitle, rows: current.zone_reports, summary: current.summary };

    const rows = current.zone_reports.filter((row) => selectedRowIds.has(zoneSalesRowId(row)));
    return { reportName: reportTitle, rows, summary: zoneSalesSummaryFromRows(rows) };
  }

  const exportActions = useReportExportActions<ZoneSalesExportData>({
    disabled: loading || !current?.zone_reports.length,
    exportReportRef,
    fetchExportData,
    fileBaseName: () => zoneSalesFileBaseName({ dateFrom, dateTo }),
    buildExcelWorkbook: (XLSX, data) =>
      createSingleSheetReportWorkbook(
        XLSX,
        [
          {
            title: t("report.excel.reportInformation"),
            rows: exportInfoRows(t, { branchLabel, dateFrom, dateTo }),
          },
          {
            title: t("report.summary"),
            rows: zoneSalesSummaryRows(data.summary, t),
          },
          zoneSalesTableSection(data, language, t),
        ],
        officialReportExcelLayout(t, data.reportName || reportTitle)
      ),
  });

  const printCurrent = useExportCurrent(JSON.stringify([branchLabel, dateFrom, dateTo, language]));

  async function printReport() {
    const isCurrent = printCurrent;
    if (!isCurrent()) return;
    if (loading || exportActions.exporting || printing) return;
    if (!user || !current) return;

    setPrinting(true);
    let printWindow: Window | null = null;

    // Use another transport only when Backend confirms no report job was queued.
    async function fallbackToBrowserPrint(
      printData: ReturnType<typeof buildZoneSalesPrintData>,
      existingWindow: Window | null
    ): Promise<Window | null> {
      if (!isCurrent()) return null;
      if (await printExportHtml(renderZoneSalesPrintHtml(printData), { title: reportTitle, isCurrent })) {
        if (isCurrent()) showToast({ title: t("report.printReady"), tone: "success" });
        return null;
      }
      if (!isCurrent()) return null;
      const targetWindow = existingWindow ?? openReceiptPrintWindow();
      if (!targetWindow) {
        showToast({ title: t("report.printFailed"), description: t("report.printPopupBlocked"), tone: "error" });
        return null;
      }

      renderReceiptPrintWindow(targetWindow, renderZoneSalesPrintHtml(printData));
      showToast({ title: t("report.printReady"), tone: "success" });
      return targetWindow;
    }

    try {
      const printLabels = {
        grandTotal: t("report.dailyPrint.grandTotal"),
        itemsHeaderLeft: t("report.zoneSales.zone"),
        itemsHeaderRight: t("report.columns.totalAmount"),
        period: t("report.dailyPrint.period"),
        printedAt: t("report.dailyPrint.printedAt"),
        printedBy: t("report.dailyPrint.printedBy"),
        title: reportTitle,
      };

      // ข้อมูลบนหน้าจอโหลดครบทั้งช่วงวันที่ในครั้งเดียวอยู่แล้ว (ไม่แบ่งหน้าฝั่ง backend) จึงใช้ current
      // ตรงๆ ได้เลยโดยไม่ต้องยิง API ซ้ำ
      const data = buildZoneSalesPrintData({
        dateFrom,
        dateTo,
        labels: printLabels,
        language,
        rows: current.zone_reports,
        summary: current.summary,
        user,
      });

      // แยก try ของการพิมพ์ผ่าน agent ออกจากแผนสำรอง กันไม่ให้ fallback ที่พังซ้ำถูกจับแล้วเรียกซ้ำสอง
      if (!isCurrent()) return;
      let agentPrintOutcome: "success" | "fallback" | "failed" = "failed";
      let agentFailureReason = "";
      try {
        const resolvedContext = await resolveDeviceIdentity();
        if (!isCurrent()) return;
        const response = await submitReportPrint({
          device_code: resolvedContext.device_code ?? "",
          report_key: "zone_sales",
          report_title: printLabels.title,
          lang: language,
          report_payload: {
            date_from: dateFrom,
            date_to: dateTo,
            grand_total: data.grandTotal,
          },
          print_document: {
            paper_width_mm: 80,
            copies: 1,
            cut_mode: "per_ticket",
            ops: buildZoneSalesReportOps(data),
            browser_payload: { title: printLabels.title, html: renderZoneSalesPrintHtml(data) },
          },
        });

        if (!isCurrent()) return;
        if (!response.pending_query) {
          agentPrintOutcome = canUseReportPrintFallback(response, "zone_sales") ? "fallback" : "failed";
          agentFailureReason = agentPrintOutcome === "fallback" ? "" : t("employeeWork.printDeliveryUnknown");
        } else {
          const printResult = await executeReport({
            pending_query: response.pending_query,
            login_uuid_fk: user.uuid,
          });

          if (!isCurrent()) return;
          agentFailureReason = printResult.errorMessage || t("employeeWork.printDeliveryUnknown");
          if (!printResult.pending && printResult.successCount > 0 && printResult.failedCount === 0) {
            agentPrintOutcome = "success";
          }
        }
      } catch {
        agentPrintOutcome = "failed";
        agentFailureReason = t("employeeWork.printDeliveryUnknown");
      }

      if (!isCurrent()) return;
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
        description: agentFailureReason || t("report.printMissingJob"),
        tone: "error",
      });
    } catch (error) {
      printWindow?.close();
      if (!isCurrent() || (error instanceof Error && error.name === "AbortError")) return;
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
    ...exportActions,
    exportDisabled: exportActions.exportDisabled || printing,
    exporting: exportActions.exporting ?? (printing ? "print" : null),
    printReport,
  };
}
