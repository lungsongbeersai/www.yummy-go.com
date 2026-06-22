"use client";

import { type CSSProperties, useRef, useState } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  ReportError,
  ReportExportLoadingDialog,
  ReportPagination,
  ReportSummaryCards,
  ReportSummaryToggle,
  ReportTableCard,
} from "./daily-sales-report-components";
import { ReportExportSurface } from "./daily-sales-report-export-surface";
import {
  ReportFilterSheet,
} from "./daily-sales-report-filters";
import {
  DetailBillTable,
  SummaryReportTable,
} from "./daily-sales-report-tables";
import { useDailySalesReportWorkflow } from "./use-daily-sales-report-workflow";

const SUMMARY_CARDS_ID = "daily-sales-summary-cards";

export function DailySalesReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useDailySalesReportWorkflow(exportReportRef, initialPagination);
  const layoutStyle = {
    "--daily-sales-filter-height": "0px",
  } as CSSProperties;
  const canApplyFilters = Boolean(
    report.draftFilters.branchUuid || report.defaultBranchUuid,
  );

  return (
    <>
      <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto" style={layoutStyle}>
        <div className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-3 p-3 sm:p-4 lg:p-4 2xl:max-w-375">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <BarChart3 className="size-4" />
                {t("nav.report_menu")}
              </div>
              <h1 className="text-2xl font-black tracking-normal text-foreground">
                {t("report.dailySalesTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("report.dailySalesDescription")}
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

          <ReportFilterSheet
            branchLoading={report.branchLoading}
            branchLocked={!report.canSelectBranch}
            branchOptions={report.branchOptions}
            canApply={canApplyFilters}
            detailPaginationBasis={report.detailPageBasis}
            draftFilters={report.draftFilters}
            loading={report.loading}
            open={report.mobileFilterOpen}
            onApply={report.applyMobileFilters}
            onDraftChange={report.setDraftFilters}
            onOpenChange={report.handleMobileFilterOpenChange}
          />

          {!report.branchUuid ? (
            <ReportError message={t("report.branchRequired")} />
          ) : null}
          {report.branchError ? (
            <ReportError message={report.branchError} />
          ) : null}
          {report.error ? <ReportError message={report.error} /> : null}

          <div id={SUMMARY_CARDS_ID} hidden={!summaryVisible}>
            <ReportSummaryCards
              cards={report.cards}
              reportTotal={report.reportTotal}
              summaryCards={report.summaryCards}
            />
          </div>

          <ReportTableCard
            actions={{
              allDetailGroupsExpanded: report.allDetailGroupsExpanded,
              billGroupsLength: report.billGroups.length,
              branchUuid: report.branchUuid,
              exportDisabled: report.exportDisabled,
              exporting: report.exporting,
              loading: report.loading,
              paymentMethod: report.appliedFilters.paymentMethod,
              selectedCount: report.selectedCount,
              typePage: report.appliedFilters.typePage,
              onClearSelection: report.clearSelection,
              onCollapseAllBills: report.collapseAllBills,
              onExpandAllBills: report.expandAllBills,
              onExportExcel: () => void report.exportExcel(),
              onExportPdf: () => void report.exportPdf(),
              onOpenFilters: report.openMobileFilters,
              onPaymentMethodChange: (paymentMethod) =>
                report.applyTableHeaderFilters({ paymentMethod }),
              onPrintReport: () => void report.printReport(),
              onRefresh: () => void report.load(),
              onTypePageChange: (typePage) =>
                report.applyTableHeaderFilters({ typePage }),
            }}
            footer={
              <ReportPagination
                canGoBack={report.canGoBack}
                canGoNext={report.canGoNext}
                page={report.page}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
                onBack={() =>
                  report.setPage((current) => Math.max(1, current - 1))
                }
                onNext={() => report.setPage((current) => current + 1)}
              />
            }
            loading={report.loading}
            rowsLength={report.rows.length}
          >
            {report.appliedFilters.typePage === "detail" ? (
              <DetailBillTable
                collapsedGroups={report.collapsedBillGroups}
                groups={report.billGroups}
                itemColumns={report.detailItemColumns}
                pageStart={report.pageStart}
                selectedRecordIds={report.selectedRecordIds}
                onToggleGroup={report.toggleBillGroup}
                onToggleRow={report.toggleReportRow}
                onToggleRows={report.toggleReportRows}
              />
            ) : (
              <SummaryReportTable
                columns={report.columns}
                pageStart={report.pageStart}
                rows={report.rows}
                selectedRecordIds={report.selectedRecordIds}
                typePage={report.appliedFilters.typePage}
                onToggleRow={report.toggleReportRow}
                onToggleRows={report.toggleReportRows}
              />
            )}
          </ReportTableCard>
        </div>
      </div>
      <ReportExportLoadingDialog
        exporting={report.exporting}
        progress={report.exportProgress}
      />
      <ReportExportSurface
        cards={report.cards}
        billGroups={report.renderedExportData.billGroups}
        columns={report.columns}
        containerRef={exportReportRef}
        dateRange={`${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
        dateTotals={report.renderedExportData.grandTotalByDate}
        itemColumns={report.detailItemColumns}
        noLabel={t("fields.no")}
        reportTotal={report.renderedExportData.reportTotal}
        rows={report.renderedExportData.rows}
        rowsLabel={
          report.appliedFilters.typePage === "detail"
            ? t("report.detailGroupedCount", {
                bills: report.renderedExportData.billGroups.length,
                lines: report.renderedExportData.rows.length,
              })
            : t("report.rowsCount", {
                count: report.renderedExportData.rows.length,
              })
        }
        summaryCards={report.renderedExportData.summaryCards}
        title={t("report.dailySalesTitle")}
        typePage={report.appliedFilters.typePage}
        typeLabel={
          report.appliedFilters.typePage === "summary"
            ? t("report.summary")
            : t("report.detail")
        }
      />
    </>
  );
}
