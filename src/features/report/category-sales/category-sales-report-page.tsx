"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { ReportColumnsMenu, useReportColumnVisibility } from "../shared/report-column-visibility";
import { ReportError } from "../shared/report-error";
import {
  ReportExportMenu,
  ReportMobileFilterBar,
  ReportPage,
  ReportPaginationBar,
  ReportRefreshButton,
  ReportResultArea,
  ReportSummaryToggle,
  ReportToolbar,
} from "../shared/report-layout";
import {
  CategorySalesExportSurface,
  CategorySalesFilterBar,
  CategorySalesFilterSheet,
  CategorySalesMobileList,
  CategorySalesSummaryCards,
  CategorySalesTable,
  categorySalesColumnOptions,
} from "./category-sales-report-components";
import { useCategorySalesReportWorkflow } from "./use-category-sales-report-workflow";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

const SUMMARY_CARDS_ID = "category-sales-summary-cards";

// โครงเดียวกับรายงานหน้าอื่นที่ปรับแล้ว ดู shared/report-layout.tsx
export function CategorySalesReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  // เปิดการ์ดสรุปไว้ตั้งแต่แรก — เป็นภาพรวมที่คนเปิดรายงานมาดูก่อน (ปุ่มตาซ่อนได้)
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useCategorySalesReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const columnOptions = useMemo(
    () => categorySalesColumnOptions(t, report.labelOverrides),
    [report.labelOverrides, t],
  );
  const columns = useReportColumnVisibility("category-sales", columnOptions);
  const controlsDisabled = report.loading || Boolean(report.exporting);
  const selectedCount = report.rowSelection.selectedCount;
  const exportTitle =
    report.exporting === "excel"
      ? t("report.exportingExcel")
      : report.exporting === "pdf"
        ? t("report.exportingPdf")
        : t("report.preparingPrint");
  const errors = [
    !report.branchUuid ? t("report.branchRequired") : null,
    report.branchError,
    report.error,
  ].filter((message): message is string => Boolean(message));
  const refreshButton = (
    <ReportRefreshButton disabled={controlsDisabled} loading={report.loading} onRefresh={() => void report.load()} />
  );

  return (
    <>
      <ReportPage title={report.reportTitle}>
        <ReportMobileFilterBar
          dateFrom={report.appliedFilters.dateFrom}
          dateTo={report.appliedFilters.dateTo}
          disabled={controlsDisabled}
          refreshButton={refreshButton}
          onOpenFilters={report.openMobileFilters}
        />
        <CategorySalesFilterBar
          actions={refreshButton}
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          loading={report.loading}
          locationOptions={report.locationOptions}
          methodOptions={report.methodOptions}
          onApply={report.applyFilters}
          onDraftChange={report.setDraftFilters}
        />
        <CategorySalesFilterSheet
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          loading={report.loading}
          locationOptions={report.locationOptions}
          methodOptions={report.methodOptions}
          open={report.mobileFilterOpen}
          onApply={report.applyMobileFilters}
          onDraftChange={report.setDraftFilters}
          onOpenChange={report.handleMobileFilterOpenChange}
        />

        {errors.map((message) => (
          <ReportError key={message} message={message} />
        ))}

        <ReportToolbar
          title={report.reportTitle}
          selectedLabel={selectedCount ? t("report.selectedForExport", { count: selectedCount }) : null}
          onClearSelection={report.rowSelection.clearSelection}
          actions={
            <>
              <ReportSummaryToggle
                controlsId={SUMMARY_CARDS_ID}
                visible={summaryVisible}
                onToggle={() => setSummaryVisible((visible) => !visible)}
              />
              <ReportColumnsMenu disabled={controlsDisabled} options={columnOptions} visibility={columns} />
              <ReportExportMenu
                disabled={report.exportDisabled}
                exporting={Boolean(report.exporting)}
                onExportExcel={() => void report.exportExcel()}
                onExportPdf={() => void report.exportPdf()}
                onPrint={() => void report.printReport()}
              />
            </>
          }
        />

        {summaryVisible ? <CategorySalesSummaryCards id={SUMMARY_CARDS_ID} summary={report.summary} /> : null}

        {/* รายงานนี้โชว์ skeleton ทุกครั้งที่โหลด (ไม่ค้างแถวเดิม) — พฤติกรรมเดิมของหน้า */}
        {report.loading ? (
          <ReportResultArea>
            <LoadingState label={t("report.categorySales.loading")} variant="reportTable" />
          </ReportResultArea>
        ) : report.rows.length ? (
          <>
            <ReportResultArea framed className="hidden md:flex">
              <CategorySalesTable
                groups={report.groups}
                isColumnVisible={columns.isVisible}
                pinning={columns.pinning}
                labelOverrides={report.labelOverrides}
                selectedRowIds={report.rowSelection.selectedRowIds}
                summary={report.summary}
                onToggleRow={report.rowSelection.toggleRow}
                onToggleRows={report.rowSelection.toggleRows}
              />
            </ReportResultArea>
            <div className="md:hidden">
              <CategorySalesMobileList
                groups={report.groups}
                selectedRowIds={report.rowSelection.selectedRowIds}
                onToggleRow={report.rowSelection.toggleRow}
                onToggleRows={report.rowSelection.toggleRows}
              />
            </div>
            <ReportPaginationBar>
              <AppPagination
                page={report.page}
                pageSize={{ value: report.appliedFilters.limit, onChange: report.changePageLimit }}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
                onPageChange={report.setPage}
              />
            </ReportPaginationBar>
          </>
        ) : (
          <EmptyState title={t("report.categorySales.noData")} description={t("report.categorySales.adjustFilters")} />
        )}
      </ReportPage>

      {report.exporting === "pdf" || report.exporting === "print" ? (
        <CategorySalesExportSurface
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(report.appliedFilters.dateFrom, report.appliedFilters.dateTo)}`}
          groups={report.renderedExportData.groups}
          methodLabel={report.activePaymentMethodLabel}
          showSummary={summaryVisible}
          summary={report.renderedExportData.summary}
          title={report.renderedExportData.reportName || report.reportTitle}
          labelOverrides={report.labelOverrides}
        />
      ) : null}
      <BlockingLoadingDialog
        open={Boolean(report.exporting)}
        title={exportTitle}
        description={t("report.exportingDescription")}
      />
    </>
  );
}
