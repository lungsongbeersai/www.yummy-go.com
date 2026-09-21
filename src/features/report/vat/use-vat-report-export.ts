"use client";

import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import type { VatReportResponse } from "@/services/report";
import { exportInfoRows } from "../shared/report-export-info";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { useReportExportActions } from "../shared/use-report-export-actions";
import {
  buildVatPrintData,
  buildVatReportOps,
  renderVatPrintHtml,
} from "./vat-report-print";
import {
  vatFileBaseName,
  vatRowId,
  vatSummaryFromRows,
  vatSummaryRows,
  vatTableSection,
  type VatExportData,
} from "./vat-report-excel";

// รายงานนี้โหลดข้อมูลทั้งช่วงวันที่ในครั้งเดียวอยู่แล้ว (API ไม่รองรับ page/limit — ดู vat-report-page.tsx)
// จึงไม่ใช้ useStandardReportWorkflow เหมือน employee-sales — fetchExportData ใช้ current.vat_rows/summary
// ที่อยู่ใน memory แล้วโดยตรง ไม่ยิง API ซ้ำ
export function useVatReportExport({
  branchLabel,
  current,
  dateFrom,
  dateTo,
  exportReportRef,
  language,
  loading,
  orderBy,
  reportTitle,
  selectedCount,
  selectedRowIds,
}: {
  branchLabel: string;
  current: VatReportResponse | null;
  dateFrom: string;
  dateTo: string;
  exportReportRef: RefObject<HTMLDivElement | null>;
  language: string;
  loading: boolean;
  orderBy: string;
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

  // เลือกแถวไว้ก่อน export Excel/PDF = ส่งออกเฉพาะใบเสร็จที่เลือก พร้อมสรุปยอดใหม่ตามแถวที่เลือก
  // (พิมพ์ผ่าน printer agent ไม่ผูกกับการเลือกแถว — พิมพ์ทั้งรายงานเสมอ ตรงกับ category-sales/employee-sales)
  async function fetchExportData(): Promise<VatExportData> {
    if (!current) throw new Error(t("report.branchRequired"));
    if (!selectedCount) return { reportName: reportTitle, rows: current.vat_rows, summary: current.summary };

    const rows = current.vat_rows.filter((row) => selectedRowIds.has(vatRowId(row)));
    return { reportName: reportTitle, rows, summary: vatSummaryFromRows(rows) };
  }

  const exportActions = useReportExportActions<VatExportData>({
    disabled: loading || !current?.vat_rows.length,
    exportReportRef,
    fetchExportData,
    fileBaseName: () => vatFileBaseName({ dateFrom, dateTo, orderBy }),
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
            rows: vatSummaryRows(data.summary, t),
          },
          vatTableSection(data, language, t),
        ],
        officialReportExcelLayout(t, data.reportName || reportTitle)
      ),
  });

  async function printReport() {
    if (loading || exportActions.exporting || printing) return;
    if (!user || !current) return;

    setPrinting(true);
    let printWindow: Window | null = null;

    // เปิด/เรนเดอร์หน้าต่างพิมพ์เบราว์เซอร์ — ใช้เป็นแผนสำรองเท่านั้น เรียกเมื่อพิมพ์ผ่าน printer agent ไม่สำเร็จ
    async function fallbackToBrowserPrint(
      printData: ReturnType<typeof buildVatPrintData>,
      existingWindow: Window | null
    ): Promise<Window | null> {
      const targetWindow = existingWindow ?? openReceiptPrintWindow();
      if (!targetWindow) {
        showToast({ title: t("report.printFailed"), description: t("report.printPopupBlocked"), tone: "error" });
        return null;
      }

      renderReceiptPrintWindow(targetWindow, renderVatPrintHtml(printData));
      showToast({ title: t("report.printReady"), tone: "success" });
      return targetWindow;
    }

    try {
      const printLabels = {
        grandTotal: t("report.dailyPrint.grandTotal"),
        itemsHeaderLeft: t("report.vat.columns.invoice"),
        itemsHeaderRight: t("report.columns.totalAmount"),
        period: t("report.dailyPrint.period"),
        printedAt: t("report.dailyPrint.printedAt"),
        printedBy: t("report.dailyPrint.printedBy"),
        title: reportTitle,
      };

      // ข้อมูลบนหน้าจอโหลดครบทั้งช่วงวันที่ในครั้งเดียวอยู่แล้ว (ไม่แบ่งหน้าฝั่ง backend) จึงใช้ current
      // ตรงๆ ได้เลยโดยไม่ต้องยิง API ซ้ำ
      const data = buildVatPrintData({
        dateFrom,
        dateTo,
        labels: printLabels,
        rows: current.vat_rows,
        summary: current.summary,
        user,
      });

      // แยก try ของการพิมพ์ผ่าน agent ออกจากแผนสำรอง กันไม่ให้ fallback ที่พังซ้ำถูกจับแล้วเรียกซ้ำสอง
      let agentPrintOutcome: "success" | "fallback" | "failed" = "failed";
      try {
        const resolvedContext = await resolveDeviceIdentity();
        const response = await submitReportPrint({
          device_code: resolvedContext.device_code ?? "",
          report_key: "vat_report",
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
            ops: buildVatReportOps(data),
            browser_payload: { title: printLabels.title, html: renderVatPrintHtml(data) },
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
    ...exportActions,
    exportDisabled: exportActions.exportDisabled || printing,
    exporting: exportActions.exporting ?? (printing ? "print" : null),
    printReport,
  };
}
