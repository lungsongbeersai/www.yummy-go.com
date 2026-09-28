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
  BestSellingExportSurface,
  BestSellingFilterBar,
  BestSellingFilterSheet,
  BestSellingProductsMobileList,
  BestSellingProductsTable,
  BestSellingSortDropdown,
  BestSellingSummaryCards,
  bestSellingColumnOptions,
} from "./best-selling-products-report-components";
import { useBestSellingProductsReportWorkflow } from "./use-best-selling-products-report-workflow";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

const SUMMARY_CARDS_ID = "best-selling-summary-cards";

export function BestSellingProductsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  // เปิดการ์ดสรุปไว้ตั้งแต่แรก — เป็นภาพรวมที่คนเปิดรายงานมาดูก่อน (ปุ่มตาซ่อนได้)
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useBestSellingProductsReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const columnOptions = useMemo(() => bestSellingColumnOptions(t), [t]);
  const columns = useReportColumnVisibility("best-selling", columnOptions);
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
    report.groupError,
    report.error,
  ].filter((message): message is string => Boolean(message));
  const refreshButton = (
    <ReportRefreshButton disabled={controlsDisabled} loading={report.loading} onRefresh={() => void report.load()} />
  );

  return (
    <>
      <ReportPage title={t("report.bestSelling.title")}>
        <ReportMobileFilterBar
          dateFrom={report.appliedFilters.dateFrom}
          dateTo={report.appliedFilters.dateTo}
          disabled={controlsDisabled}
          refreshButton={refreshButton}
          onOpenFilters={report.openMobileFilters}
        />
        <BestSellingFilterBar
          actions={refreshButton}
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          groupLoading={report.groupLoading}
          groupOptions={report.groupOptions}
          loading={report.loading}
          onApply={report.applyFilters}
          onDraftChange={report.setDraftFilters}
        />
        <BestSellingFilterSheet
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          groupLoading={report.groupLoading}
          groupOptions={report.groupOptions}
          loading={report.loading}
          open={report.mobileFilterOpen}
          onApply={report.applyMobileFilters}
          onDraftChange={report.setDraftFilters}
          onOpenChange={report.handleMobileFilterOpenChange}
        />

        {errors.map((message) => (
          <ReportError key={message} message={message} />
        ))}

        <ReportToolbar
          title={t("report.bestSelling.tableTitle")}
          selectedLabel={selectedCount ? t("report.selectedForExport", { count: selectedCount }) : null}
          onClearSelection={report.rowSelection.clearSelection}
          actions={
            <>
              <ReportSummaryToggle
                controlsId={SUMMARY_CARDS_ID}
                visible={summaryVisible}
                onToggle={() => setSummaryVisible((visible) => !visible)}
              />
              <BestSellingSortDropdown
                disabled={controlsDisabled}
                sortBy={report.appliedFilters.sortBy}
                sortByLabel={report.sortByLabel}
                onSortByChange={report.applySortBy}
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

        {summaryVisible ? (
          <BestSellingSummaryCards id={SUMMARY_CARDS_ID} cards={report.summaryCards} summary={report.summary} />
        ) : null}

        {report.loading && !report.rows.length ? (
          <ReportResultArea>
            <LoadingState label={t("report.bestSelling.loading")} variant="reportTable" />
          </ReportResultArea>
        ) : report.rows.length ? (
          <>
            <ReportResultArea framed busy={report.loading} className="hidden md:flex">
              <BestSellingProductsTable
                groups={report.groups}
                isColumnVisible={columns.isVisible}
                selectedRowIds={report.rowSelection.selectedRowIds}
                sortBy={report.appliedFilters.sortBy}
                summary={report.summary}
                onToggleRow={report.rowSelection.toggleRow}
                onToggleRows={report.rowSelection.toggleRows}
              />
            </ReportResultArea>
            <div className="md:hidden">
              <BestSellingProductsMobileList
                groups={report.groups}
                selectedRowIds={report.rowSelection.selectedRowIds}
                sortBy={report.appliedFilters.sortBy}
                onToggleRow={report.rowSelection.toggleRow}
                onToggleRows={report.rowSelection.toggleRows}
              />
            </div>
            <ReportPaginationBar>
              <AppPagination
                page={report.page}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
                onPageChange={report.setPage}
              />
            </ReportPaginationBar>
          </>
        ) : (
          <EmptyState title={t("report.bestSelling.noData")} description={t("report.bestSelling.adjustFilters")} />
        )}
      </ReportPage>

      {report.exporting === "pdf" || report.exporting === "print" ? (
        <BestSellingExportSurface
          cards={report.summaryCards}
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(report.appliedFilters.dateFrom, report.appliedFilters.dateTo)}`}
          groups={report.renderedExportData.groups}
          showSummary={summaryVisible}
          sortByLabel={report.sortByLabel}
          summary={report.renderedExportData.summary}
          title={t("report.bestSelling.title")}
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
