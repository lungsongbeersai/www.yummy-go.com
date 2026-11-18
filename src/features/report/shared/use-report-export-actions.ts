"use client";

import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { captureElementToPdf } from "@/lib/export/pdf";
import { waitForPaint } from "@/lib/export/paint";
import { printExportElement } from "@/lib/export/print";
import { useToastStore } from "@/stores/toast-store";
import { useExportCurrent } from "@/hooks/use-export-current";
import { saveExportFile, XLSX_MIME } from "@/lib/export/file-output";

export type ReportExportAction = "excel" | "pdf" | "print";

type XlsxModule = typeof import("xlsx-js-style");

export interface UseReportExportActionsConfig<ExportData extends { rows: unknown[] }> {
  // เงื่อนไขที่ทำให้ export ทำไม่ได้ "นอกเหนือ" จากกำลัง export อยู่แล้ว (ไม่มีสาขา/กำลังโหลด/ไม่มีแถว ฯลฯ)
  // — ไม่รวม exporting เพราะสถานะนั้นอยู่ในฮุกนี้เอง รวมให้ในผลลัพธ์ exportDisabled แทน
  disabled: boolean;
  exportReportRef: RefObject<HTMLDivElement | null>;
  // ชื่อไฟล์ (ไม่รวมนามสกุล) คำนวณจาก appliedFilters ปัจจุบันของแต่ละรายงาน
  fileBaseName: () => string;
  // ดึงข้อมูล export ชุดล่าสุดจาก backend แล้วกรองตามแถวที่ผู้ใช้เลือกไว้ (ถ้ามี) — ทำใน workflow ของแต่ละรายงาน
  fetchExportData: () => Promise<ExportData>;
  buildExcelWorkbook: (XLSX: XlsxModule, data: ExportData) => ReturnType<XlsxModule["utils"]["book_new"]>;
}

export interface UseReportExportActionsResult<ExportData> {
  exportData: ExportData | null;
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  exportExcel: () => Promise<void>;
  exportPdf: () => Promise<void>;
  printReport: () => Promise<void>;
}

// รวม flow ของปุ่ม export excel/pdf/print ที่ทุกหน้ารายงานทำเหมือนกันทุกขั้นตอน:
// ตั้งสถานะ exporting → ดึงข้อมูล → (pdf/print) แปะลง exportData ให้ export surface วาดใหม่แล้วรอ paint
// → ทำงานเฉพาะของแต่ละช่องทาง → toast ผลลัพธ์ → เคลียร์สถานะ
// เดิมทั้ง 3 ฟังก์ชันนี้ถูกก๊อปวางไว้เกือบทั้งบรรทัดในทุก use-*-report-workflow (~90 บรรทัด/ไฟล์)
export function useReportExportActions<ExportData extends { rows: unknown[] }>(
  config: UseReportExportActionsConfig<ExportData>,
): UseReportExportActionsResult<ExportData> {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const [exporting, setExporting] = useState<ReportExportAction | null>(null);
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const exportCurrent = useExportCurrent(config.fileBaseName());

  async function exportExcel() {
    if (config.disabled || exporting) return;
    const isCurrent = exportCurrent;
    const filename = `${config.fileBaseName()}.xlsx`;
    setExporting("excel");
    try {
      const data = await config.fetchExportData();
      const XLSX = await import("xlsx-js-style");
      if (!isCurrent()) return;
      const workbook = config.buildExcelWorkbook(XLSX, data);
      const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      if (await saveExportFile(new File([bytes], filename, { type: XLSX_MIME }), { isCurrent }) !== "saved" || !isCurrent()) return;
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success"
      });
    } catch (error) {
      if (!isCurrent() || (error instanceof Error && error.name === "AbortError")) return;
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
    if (config.disabled || exporting) return;
    const isCurrent = exportCurrent;
    const filename = `${config.fileBaseName()}.pdf`;
    setExporting("pdf");
    try {
      const data = await config.fetchExportData();
      if (!isCurrent()) return;
      setExportData(data);
      await waitForPaint();

      const element = config.exportReportRef.current;
      if (!element) throw new Error(t("report.exportFailed"));

      if (await captureElementToPdf(element, { fileName: filename, isCurrent }) !== "saved" || !isCurrent()) return;
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success"
      });
    } catch (error) {
      if (!isCurrent() || (error instanceof Error && error.name === "AbortError")) return;
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
    if (config.disabled || exporting) return;
    const isCurrent = exportCurrent;
    setExporting("print");
    try {
      const data = await config.fetchExportData();
      if (!isCurrent()) return;
      setExportData(data);
      await waitForPaint();
      const element = config.exportReportRef.current;
      if (!element) throw new Error(t("report.printFailed"));
      await printExportElement(element, { title: config.fileBaseName(), isCurrent });
      if (!isCurrent()) return;
      showToast({
        title: t("report.exportReady"),
        description: t("report.exportedRows", { count: data.rows.length }),
        tone: "success"
      });
    } catch (error) {
      if (!isCurrent() || (error instanceof Error && error.name === "AbortError")) return;
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
    exportData,
    exportDisabled: config.disabled || Boolean(exporting),
    exportExcel,
    exportPdf,
    exporting,
    printReport
  };
}
