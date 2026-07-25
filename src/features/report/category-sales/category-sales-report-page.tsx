"use client";

import { useRef, useState } from "react";
import { FolderTree } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { ReportPageShell } from "../shared/report-page-shell";
import { ReportDataCard, useReportChrome } from "../shared/report-standard-page";
import {
  CategorySalesFilterSheet,
  CategorySalesExportSurface,
  CategorySalesMobileList,
  CategorySalesSummaryCards,
  CategorySalesTable,
} from "./category-sales-report-components";
import { useCategorySalesReportWorkflow } from "./use-category-sales-report-workflow";

const SUMMARY_CARDS_ID = "category-sales-summary-cards";

export function CategorySalesReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useCategorySalesReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const chrome = useReportChrome(report);

  return (
    <ReportPageShell
      variant="spacious"
      icon={FolderTree}
      title={report.reportTitle}
      description={t("report.categorySales.description")}
      dateFrom={report.appliedFilters.dateFrom}
      dateTo={report.appliedFilters.dateTo}
      loading={report.loading}
      exporting={Boolean(report.exporting)}
      exportingTitle={chrome.exportTitle}
      errors={chrome.errors}
      filterSheet={
        <CategorySalesFilterSheet
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          loading={report.loading}
          methodOptions={report.methodOptions}
          open={report.mobileFilterOpen}
          onApply={report.applyMobileFilters}
          onDraftChange={report.setDraftFilters}
          onOpenChange={report.handleMobileFilterOpenChange}
        />
      }
      summaryCardsId={SUMMARY_CARDS_ID}
      summaryVisible={summaryVisible}
      onToggleSummary={() => setSummaryVisible((visible) => !visible)}
      summary={<CategorySalesSummaryCards summary={report.summary} />}
      onOpenFilters={report.openMobileFilters}
      onRefresh={() => void report.load()}
      table={
        <ReportDataCard
          report={report}
          cardClassName="min-h-0 min-w-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-3 md:flex md:max-h-[calc(100dvh-var(--app-shell-header-height)-1.5rem)] md:flex-col"
          contentClassName="flex min-h-0 flex-1 flex-col p-0"
          contentWrapperClassName="min-h-0 md:flex-1 md:overflow-auto"
          headerVariant="spacious"
          icon={FolderTree}
          title={report.reportTitle}
          skeletonMode="always"
          renderLoading={() => <LoadingState label={t("report.categorySales.loading")} variant="reportTable" />}
          emptyTitle={t("report.categorySales.noData")}
          emptyDescription={t("report.categorySales.adjustFilters")}
        >
          <CategorySalesTable
            groups={report.groups}
            labelOverrides={report.labelOverrides}
            selectedRowIds={report.rowSelection.selectedRowIds}
            onToggleRow={report.rowSelection.toggleRow}
            onToggleRows={report.rowSelection.toggleRows}
          />
          <CategorySalesMobileList
            groups={report.groups}
            labelOverrides={report.labelOverrides}
            selectedRowIds={report.rowSelection.selectedRowIds}
            onToggleRow={report.rowSelection.toggleRow}
            onToggleRows={report.rowSelection.toggleRows}
          />
        </ReportDataCard>
      }
      exportSurface={
        report.exporting === "pdf" || report.exporting === "print" ? (
          <CategorySalesExportSurface
            containerRef={exportReportRef}
            dateRange={chrome.dateRangeLabel}
            groups={report.renderedExportData.groups}
            methodLabel={report.activePaymentMethodLabel}
            showSummary={summaryVisible}
            summary={report.renderedExportData.summary}
            title={report.renderedExportData.reportName || report.reportTitle}
            labelOverrides={report.labelOverrides}
          />
        ) : undefined
      }
    />
  );
}
