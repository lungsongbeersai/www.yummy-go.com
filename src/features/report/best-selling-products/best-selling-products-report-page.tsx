"use client";

import { type CSSProperties, useRef, useState } from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { Badge } from "@/components/ui/badge";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  BestSellingExportSurface,
  BestSellingFilterSheet,
  BestSellingProductsMobileList,
  BestSellingProductsTable,
  BestSellingSummaryCards,
  BestSellingTableCard,
} from "./best-selling-products-report-components";
import { ReportError, ReportPagination, ReportSummaryToggle } from "../daily-sales/daily-sales-report-components";
import { useBestSellingProductsReportWorkflow } from "./use-best-selling-products-report-workflow";

const SUMMARY_CARDS_ID = "best-selling-summary-cards";

export function BestSellingProductsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const nativeApp = useIsCapacitorNativeApp();
  const report = useBestSellingProductsReportWorkflow(exportReportRef, initialPagination);
  const layoutStyle = {
    "--best-selling-filter-height": "0px"
  } as CSSProperties;
  const exportTitle =
    report.exporting === "excel"
      ? t("report.exportingExcel")
      : report.exporting === "pdf"
        ? t("report.exportingPdf")
        : t("report.preparingPrint");

  return (
    <>
      <div
        className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto lg:overflow-hidden"
        style={layoutStyle}
      >
        <div className="flex min-h-full w-full min-w-0 flex-col gap-2 p-2 sm:p-3 lg:h-full lg:min-h-0">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <Trophy className="size-4" />
                {t("nav.report_menu")}
              </div>
              <h1 className="truncate text-xl font-black tracking-normal text-foreground sm:text-2xl">
                {t("report.bestSelling.title")}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t("report.bestSelling.description")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge className="w-fit rounded-full px-3 py-1">
                <CalendarDays data-icon="inline-start" />
                {report.appliedFilters.dateFrom} - {report.appliedFilters.dateTo}
              </Badge>
              <ReportSummaryToggle
                controlsId={SUMMARY_CARDS_ID}
                expanded={summaryVisible}
                onToggle={() => setSummaryVisible((visible) => !visible)}
              />
            </div>
          </div>

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

          {!report.branchUuid ? <ReportError message={t("report.branchRequired")} /> : null}
          {report.branchError ? <ReportError message={report.branchError} /> : null}
          {report.groupError ? <ReportError message={report.groupError} /> : null}
          {report.error ? <ReportError message={report.error} /> : null}

          <div id={SUMMARY_CARDS_ID} hidden={!summaryVisible}>
            <BestSellingSummaryCards cards={report.summaryCards} summary={report.summary} />
          </div>

          <BestSellingTableCard
            exportDisabled={report.exportDisabled}
            exporting={report.exporting}
            loading={report.loading}
            printDisabled={report.exportDisabled || nativeApp}
            rowsLength={report.rows.length}
            selectedCount={report.rowSelection.selectedCount}
            sortBy={report.appliedFilters.sortBy}
            sortByLabel={report.sortByLabel}
            footer={
              <ReportPagination
                canGoBack={report.canGoBack}
                canGoNext={report.canGoNext}
                page={report.page}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
                onBack={() => report.setPage((current) => Math.max(1, current - 1))}
                onNext={() => report.setPage((current) => current + 1)}
                onPageChange={report.setPage}
              />
            }
            onExportExcel={() => void report.exportExcel()}
            onExportPdf={() => void report.exportPdf()}
            onClearSelection={report.rowSelection.clearSelection}
            onOpenFilters={report.openMobileFilters}
            onPrintReport={() => void report.printReport()}
            onRefresh={() => void report.load()}
            onSortByChange={report.applySortBy}
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
          </BestSellingTableCard>
        </div>
      </div>
      <BestSellingExportSurface
        cards={report.summaryCards}
        containerRef={exportReportRef}
        dateRange={`${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
        groups={report.renderedExportData.groups}
        rowsLabel={t("report.bestSelling.rowsLabel", { count: report.renderedExportData.rows.length })}
        sortByLabel={report.sortByLabel}
        summary={report.renderedExportData.summary}
        title={t("report.bestSelling.title")}
      />
      <BlockingLoadingDialog
        open={Boolean(report.exporting)}
        title={exportTitle}
        description={t("report.exportingDescription")}
      />
    </>
  );
}
