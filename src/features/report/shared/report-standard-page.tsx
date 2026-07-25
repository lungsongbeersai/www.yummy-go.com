"use client";

import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { ReportTableCard, type ReportTableCardProps } from "@/features/report/shared/report-table-card";

// สไลซ์ของ useStandardReportWorkflow ที่ chrome ของหน้ารายงานใช้ — payment-methods,
// category-sales และ best-selling ต่อสายชุดนี้เข้ากับ ReportTableCard เหมือนกันทุกเส้น
export interface StandardReportView {
  appliedFilters: { dateFrom: string; dateTo: string };
  branchError: string | null;
  branchUuid: string;
  error: string | null;
  exportDisabled: boolean;
  exportExcel: () => Promise<void>;
  exportPdf: () => Promise<void>;
  exporting: string | null;
  load: () => Promise<void>;
  loading: boolean;
  page: number;
  paginationRangeLabel: string;
  rowSelection: { clearSelection: () => void; selectedCount: number };
  rows: unknown[];
  setPage: (page: number) => void;
  totalPages: number;
}

// ป้ายสถานะระหว่าง export, รายการ error ของ ReportPageShell และช่วงวันที่บนใบพิมพ์
export function useReportChrome(report: StandardReportView, extraErrors: Array<string | null> = []) {
  const { t } = useTranslation();

  return {
    dateRangeLabel: `${t("report.reportDate")}: ${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`,
    // extraErrors แทรกก่อน error ทั่วไปเสมอ เพื่อคงลำดับที่แต่ละหน้าแสดงอยู่เดิม
    errors: [
      !report.branchUuid ? t("report.branchRequired") : null,
      report.branchError,
      ...extraErrors,
      report.error
    ],
    exportTitle:
      report.exporting === "excel"
        ? t("report.exportingExcel")
        : report.exporting === "pdf"
          ? t("report.exportingPdf")
          : t("report.preparingPrint")
  };
}

type WorkflowBoundProps =
  | "exportDisabled"
  | "exporting"
  | "footer"
  | "loading"
  | "rowsLength"
  | "selectedCount"
  | "onClearSelection"
  | "onExportExcel"
  | "onExportPdf"
  | "onRefresh";

// ReportTableCard ที่ผูกกับ workflow ไว้แล้ว เหลือให้แต่ละรายงานส่งเฉพาะเลย์เอาต์/เนื้อหาของตัวเอง
export function ReportDataCard({
  report,
  ...props
}: Omit<ReportTableCardProps, WorkflowBoundProps> & { report: StandardReportView }) {
  return (
    <ReportTableCard
      {...props}
      exportDisabled={report.exportDisabled}
      exporting={report.exporting}
      footer={
        <AppPagination
          page={report.page}
          rangeLabel={report.paginationRangeLabel}
          totalPages={report.totalPages}
          onPageChange={report.setPage}
        />
      }
      loading={report.loading}
      rowsLength={report.rows.length}
      selectedCount={report.rowSelection.selectedCount}
      onClearSelection={report.rowSelection.clearSelection}
      onExportExcel={() => void report.exportExcel()}
      onExportPdf={() => void report.exportPdf()}
      onRefresh={() => void report.load()}
    />
  );
}
