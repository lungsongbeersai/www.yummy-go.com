"use client";

import { type CSSProperties, useRef, useState } from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
  const report = useBestSellingProductsReportWorkflow(exportReportRef, initialPagination);
  const layoutStyle = {
    "--best-selling-filter-height": "0px"
  } as CSSProperties;

  return (
    <>
      <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto" style={layoutStyle}>
        <div className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-3 p-3 sm:p-4 lg:p-4 2xl:max-w-375">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <Trophy className="size-4" />
                {t("nav.report_menu")}
              </div>
              <h1 className="text-2xl font-black tracking-normal text-foreground">
                {t("report.bestSelling.title")}
              </h1>
              <p className="text-sm text-muted-foreground">
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
            rowsLength={report.rows.length}
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
              />
            }
            onExportExcel={() => void report.exportExcel()}
            onExportPdf={() => void report.exportPdf()}
            onOpenFilters={report.openMobileFilters}
            onPrintReport={() => void report.printReport()}
            onRefresh={() => void report.load()}
          >
            <BestSellingProductsTable groups={report.groups} />
            <BestSellingProductsMobileList groups={report.groups} />
          </BestSellingTableCard>
        </div>
      </div>
      <BestSellingExportSurface
        cards={report.summaryCards}
        containerRef={exportReportRef}
        dateRange={`${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
        groups={report.renderedExportData.groups}
        rows={report.renderedExportData.rows}
        rowsLabel={t("report.bestSelling.rowsLabel", { count: report.renderedExportData.rows.length })}
        sortByLabel={report.sortByLabel}
        summary={report.renderedExportData.summary}
        title={t("report.bestSelling.title")}
      />
    </>
  );
}
