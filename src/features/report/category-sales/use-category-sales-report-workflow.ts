"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { createSingleSheetReportWorkbook } from "@/lib/export/excel";
import { officialReportExcelLayout } from "@/lib/export/official-layout";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { useBranchStore } from "@/stores/branch-store";
import { useCategorySalesReportStore } from "@/stores/report-store";
import { exportInfoRows } from "../shared/report-export-info";
import { useStandardReportWorkflow } from "../shared/use-standard-report-workflow";
import type { CategorySalesExportData, CategorySalesReportFilters } from "./category-sales-report-types";
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

  return {
    ...report,
    activeBranchLabel,
    activePaymentMethodLabel,
    groups,
    labelOverrides,
    methodOptions,
    renderedExportData,
    reportTitle,
    rows,
    summary
  };
}
