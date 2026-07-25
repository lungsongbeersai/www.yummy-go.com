"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { usePaymentMethodsReportStore } from "@/stores/report-store";
import { exportInfoRows } from "../shared/report-export-info";
import { useStandardReportWorkflow } from "../shared/use-standard-report-workflow";
import type { PaymentMethodsExportData, PaymentMethodsReportFilters } from "./payment-methods-report-types";
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
            rows: exportPaymentMethodRows(data.rows, t)
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

  return {
    ...report,
    activeBranchLabel,
    activePaymentMethodLabel,
    cards,
    methodOptions,
    renderedExportData: renderedExportData ?? emptyExportData(),
    reportTitle,
    reportTotal,
    rows
  };
}
