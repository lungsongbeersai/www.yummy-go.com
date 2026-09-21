"use client";

import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import type { EmployeeSalesResponse } from "@/services/report";
import { exportInfoRows } from "../shared/report-export-info";
import { openReceiptPrintWindow, renderReceiptPrintWindow } from "../shared/report-receipt-print";
import { useReportExportActions } from "../shared/use-report-export-actions";
import {
  buildEmployeeSalesPrintData,
  buildEmployeeSalesReportOps,
  renderEmployeeSalesPrintHtml,
} from "./employee-sales-report-print";
import {
  employeeSalesFileBaseName,
  employeeSalesRowId,
  employeeSalesSummaryFromRows,
  employeeSalesSummaryRows,
  employeeSalesTableSection,
  type EmployeeSalesExportData,
} from "./employee-sales-report-excel";

// รายงานนี้โหลดข้อมูลทั้งช่วงวันที่ในครั้งเดียวอยู่แล้ว (API ไม่รองรับ page/limit — ดู employee-sales-page.tsx)
// จึงไม่ใช้ useStandardReportWorkflow ที่ออกแบบมาสำหรับรายงานที่แบ่งหน้าฝั่ง backend + เลือกแถวได้
// (เช่น category-sales) เพราะ config นั้นจะบังคับ fetchExportData ให้ยิง API ซ้ำโดยไม่จำเป็น —
// ข้อมูลที่ใช้ export ก็คือ current.user_reports/summary ที่อยู่ใน memory แล้วนั่นเอง
export function useEmployeeSalesReportExport({
  branchLabel,
  branchUuid,
  current,
  dateFrom,
  dateTo,
  exportReportRef,
  loading,
  orderBy,
  reportTitle,
  selectedCount,
  selectedRowIds,
}: {
  branchLabel: string;
  branchUuid: string;
  current: EmployeeSalesResponse | null;
  dateFrom: string;
  dateTo: string;
  exportReportRef: RefObject<HTMLDivElement | null>;
  loading: boolean;
  orderBy: string;
  reportTitle: string;
  selectedCount: number;
  selectedRowIds: Set<string>;
}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.show);
  const executeReport = usePrinterStore((state) => state.executeReport);
  const resolveDeviceIdentity = usePrinterStore((state) => state.resolveDeviceIdentity);
  const submitReportPrint = usePrinterStore((state) => state.submitReportPrint);
  const [printing, setPrinting] = useState(false);

  // เลือกแถวไว้ก่อน export Excel/PDF = ส่งออกเฉพาะพนักงานที่เลือก พร้อมสรุปยอดใหม่ตามแถวที่เลือก
  // (พิมพ์ผ่าน printer agent ไม่ผูกกับการเลือกแถว — พิมพ์ทั้งรายงานเสมอ ตรงกับ category-sales)
  async function fetchExportData(): Promise<EmployeeSalesExportData> {
    if (!current) throw new Error(t("report.branchRequired"));
    if (!selectedCount) return { reportName: reportTitle, rows: current.user_reports, summary: current.summary };

    const rows = current.user_reports.filter((row) => selectedRowIds.has(employeeSalesRowId(row)));
    return { reportName: reportTitle, rows, summary: employeeSalesSummaryFromRows(rows) };
  }

  const exportActions = useReportExportActions<EmployeeSalesExportData>({
    disabled: loading || !branchUuid || !(current?.user_reports.length),
    exportReportRef,
    fetchExportData,
    fileBaseName: () => employeeSalesFileBaseName({ dateFrom, dateTo, orderBy }),
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
            rows: employeeSalesSummaryRows(data.summary, t),
          },
          employeeSalesTableSection(data, t),
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
      printData: ReturnType<typeof buildEmployeeSalesPrintData>,
      existingWindow: Window | null
    ): Promise<Window | null> {
      const targetWindow = existingWindow ?? openReceiptPrintWindow();
      if (!targetWindow) {
        showToast({ title: t("report.printFailed"), description: t("report.printPopupBlocked"), tone: "error" });
        return null;
      }

      renderReceiptPrintWindow(targetWindow, renderEmployeeSalesPrintHtml(printData));
      showToast({ title: t("report.printReady"), tone: "success" });
      return targetWindow;
    }

    try {
      const printLabels = {
        grandTotal: t("employeeSales.grandTotal"),
        itemsHeaderLeft: t("employeeSales.employee"),
        itemsHeaderRight: t("report.columns.totalAmount"),
        period: t("report.dailyPrint.period"),
        printedAt: t("report.dailyPrint.printedAt"),
        printedBy: t("report.dailyPrint.printedBy"),
        title: reportTitle,
      };

      // ข้อมูลบนหน้าจอโหลดครบทั้งช่วงวันที่ในครั้งเดียวอยู่แล้ว (ไม่แบ่งหน้าฝั่ง backend) จึงใช้ current
      // ตรงๆ ได้เลยโดยไม่ต้องยิง API ซ้ำเหมือน category-sales
      const data = buildEmployeeSalesPrintData({
        dateFrom,
        dateTo,
        labels: printLabels,
        rows: current.user_reports,
        summary: current.summary,
        user,
      });

      // แยก try ของการพิมพ์ผ่าน agent ออกจากแผนสำรอง กันไม่ให้ fallback ที่พังซ้ำถูกจับแล้วเรียกซ้ำสอง
      let agentPrintOutcome: "success" | "fallback" | "failed" = "failed";
      try {
        const resolvedContext = await resolveDeviceIdentity();
        const response = await submitReportPrint({
          device_code: resolvedContext.device_code ?? "",
          report_key: "employee_sales",
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
            ops: buildEmployeeSalesReportOps(data),
            browser_payload: { title: printLabels.title, html: renderEmployeeSalesPrintHtml(data) },
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
