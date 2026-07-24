"use client";

import { useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { LoadingState } from "@/components/common/loading-state";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { ReportPageShell } from "../shared/report-page-shell";
import { ReportTableCard } from "../shared/report-table-card";
import {
  BestSellingExportSurface,
  BestSellingFilterSheet,
  BestSellingProductsMobileList,
  BestSellingProductsTable,
  BestSellingSortDropdown,
  BestSellingSummaryCards,
} from "./best-selling-products-report-components";
import { useBestSellingProductsReportWorkflow } from "./use-best-selling-products-report-workflow";

const SUMMARY_CARDS_ID = "best-selling-summary-cards";

export function BestSellingProductsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useBestSellingProductsReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const exportTitle =
    report.exporting === "excel"
      ? t("report.exportingExcel")
      : report.exporting === "pdf"
        ? t("report.exportingPdf")
        : t("report.preparingPrint");

  return (
    <ReportPageShell
      variant="compact"
      icon={Trophy}
      title={t("report.bestSelling.title")}
      description={t("report.bestSelling.description")}
      dateFrom={report.appliedFilters.dateFrom}
      dateTo={report.appliedFilters.dateTo}
      loading={report.loading}
      exporting={Boolean(report.exporting)}
      exportingTitle={exportTitle}
      errors={[
        !report.branchUuid ? t("report.branchRequired") : null,
        report.branchError,
        report.groupError,
        report.error,
      ]}
      filterSheet={
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
      }
      summaryCardsId={SUMMARY_CARDS_ID}
      summaryVisible={summaryVisible}
      onToggleSummary={() => setSummaryVisible((visible) => !visible)}
      summary={<BestSellingSummaryCards cards={report.summaryCards} summary={report.summary} />}
      onOpenFilters={report.openMobileFilters}
      onRefresh={() => void report.load()}
      table={
        <ReportTableCard
          cardClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border bg-card shadow-sm"
          contentClassName="flex min-h-0 flex-1 flex-col p-0"
          contentWrapperClassName="min-h-0 min-w-0 flex-1 overflow-auto overscroll-x-contain overscroll-y-auto"
          headerVariant="compact"
          icon={Trophy}
          title={t("report.bestSelling.tableTitle")}
          headerExtras={
            <BestSellingSortDropdown
              disabled={report.loading || Boolean(report.exporting)}
              sortBy={report.appliedFilters.sortBy}
              sortByLabel={report.sortByLabel}
              onSortByChange={report.applySortBy}
            />
          }
          renderLoading={() => <LoadingState label={t("report.bestSelling.loading")} variant="reportTable" />}
          emptyTitle={t("report.bestSelling.noData")}
          emptyDescription={t("report.bestSelling.adjustFilters")}
          loading={report.loading}
          rowsLength={report.rows.length}
          selectedCount={report.rowSelection.selectedCount}
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
          onClearSelection={report.rowSelection.clearSelection}
          onExportExcel={() => void report.exportExcel()}
          onExportPdf={() => void report.exportPdf()}
          onRefresh={() => void report.load()}
        >
          <BestSellingProductsTable
            groups={report.groups}
            selectedRowIds={report.rowSelection.selectedRowIds}
            summary={report.summary}
            onToggleRow={report.rowSelection.toggleRow}
            onToggleRows={report.rowSelection.toggleRows}
          />
          <BestSellingProductsMobileList
            groups={report.groups}
            selectedRowIds={report.rowSelection.selectedRowIds}
            onToggleRow={report.rowSelection.toggleRow}
            onToggleRows={report.rowSelection.toggleRows}
          />
        </ReportTableCard>
      }
      exportSurface={
        report.exporting === "pdf" || report.exporting === "print" ? (
          <BestSellingExportSurface
            cards={report.summaryCards}
            containerRef={exportReportRef}
            dateRange={`${t("report.reportDate")}: ${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
            groups={report.renderedExportData.groups}
            showSummary={summaryVisible}
            sortByLabel={report.sortByLabel}
            summary={report.renderedExportData.summary}
            title={t("report.bestSelling.title")}
          />
        ) : undefined
      }
    />
  );
}
