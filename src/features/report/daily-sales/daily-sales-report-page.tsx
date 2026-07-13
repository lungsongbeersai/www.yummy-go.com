"use client";

import { type CSSProperties, useRef, useState } from "react";
import { BarChart3, Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  ReportError,
  ReportExportLoadingDialog,
  ReportPagination,
  ReportSummaryCards,
  ReportTableCard,
} from "./daily-sales-report-components";
import { ReportExportSurface } from "./daily-sales-report-export-surface";
import { ReportFilterSheet } from "./daily-sales-report-filters";
import {
  DetailBillTable,
  SummaryReportTable,
} from "./daily-sales-report-tables";
import { useDailySalesReportWorkflow } from "./use-daily-sales-report-workflow";

const SUMMARY_CARDS_ID = "daily-sales-summary-cards";

export function DailySalesReportPage({
  initialPagination,
}: {
  initialPagination: UrlPaginationState;
}) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const nativeApp = useIsCapacitorNativeApp();
  const report = useDailySalesReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const layoutStyle = {
    "--daily-sales-filter-height": "0px",
  } as CSSProperties;
  const canApplyFilters = Boolean(report.draftFilters.branchUuid || report.defaultBranchUuid);
  const dateRangeLabel = `${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`;

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
                <BarChart3 className="size-4" />
                {t("nav.report_menu")}
              </div>
              <h1 className="truncate text-xl font-black tracking-normal text-foreground sm:text-2xl">
                {t("report.dailySalesTitle")}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{t("report.dailySalesDescription")}</p>
            </div>
          </div>

          <FilterHeaderToolbar
            dateRange={{
              ariaLabel: `${t("report.filters.openFilters")}: ${dateRangeLabel}`,
              disabled: report.loading || Boolean(report.exporting),
              label: dateRangeLabel,
              onClick: report.openMobileFilters,
            }}
            filterControl={
              <Button
                type="button"
                variant="outline"
                size="iconSm"
                className="h-9 w-9 shrink-0"
                aria-label={t("report.filters.openFilters")}
                disabled={report.loading || Boolean(report.exporting)}
                onClick={report.openMobileFilters}
              >
                <SlidersHorizontal data-icon="inline-start" />
                <span className="sr-only">{t("report.filters.openFilters")}</span>
              </Button>
            }
            refreshControl={
              <Button
                type="button"
                variant="outline"
                size="iconSm"
                className="h-9 w-9 shrink-0"
                aria-label={t("actions.refresh")}
                disabled={report.loading || Boolean(report.exporting)}
                onClick={() => void report.load()}
              >
                <RefreshCcw className={report.loading ? "animate-spin" : undefined} data-icon="inline-start" />
                <span className="sr-only">{t("actions.refresh")}</span>
              </Button>
            }
            summaryControl={
              <Button
                type="button"
                variant="outline"
                size="iconSm"
                className="h-9 w-9 shrink-0"
                aria-controls={SUMMARY_CARDS_ID}
                aria-expanded={summaryVisible}
                aria-label={summaryVisible ? t("report.hideSummary") : t("report.showSummary")}
                onClick={() => setSummaryVisible((visible) => !visible)}
              >
                {summaryVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
                <span className="sr-only">{summaryVisible ? t("report.hideSummary") : t("report.showSummary")}</span>
              </Button>
            }
          />

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

          {!report.branchUuid ? <ReportError message={t("report.branchRequired")} /> : null}
          {report.branchError ? <ReportError message={report.branchError} /> : null}
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
              printDisabled:
                report.loading ||
                Boolean(report.exporting) ||
                !report.branchUuid ||
                nativeApp,
              search: report.appliedFilters.search,
              selectedCount: report.selectedCount,
              selectedBillCount: report.selectedBillCount,
              typePage: report.appliedFilters.typePage,
              onClearSelection: report.clearSelection,
              onCollapseAllBills: report.collapseAllBills,
              onExpandAllBills: report.expandAllBills,
              onExportExcel: () => void report.exportExcel(),
              onExportPdf: () => void report.exportPdf(),
              onPrintReport: () => void report.printReport(),
              onRefresh: () => void report.load(),
              onSearchChange: (search) => report.applyTableHeaderFilters({ search }),
              onTypePageChange: (typePage) => report.applyTableHeaderFilters({ typePage }),
            }}
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
            loading={report.loading}
            rowsLength={report.rows.length}
          >
            {report.appliedFilters.typePage === "detail" ? (
              <DetailBillTable
                collapsedGroups={report.collapsedBillGroups}
                groups={report.billGroups}
                itemColumns={report.detailItemColumns}
                pageStart={report.pageStart}
                reportTotal={report.reportTotal}
                selectedRecordIds={report.selectedRecordIds}
                summaryCards={report.summaryCards}
                onToggleGroup={report.toggleBillGroup}
                onToggleRow={report.toggleReportRow}
                onToggleRows={report.toggleReportRows}
              />
            ) : (
              <SummaryReportTable
                columns={report.columns}
                pageStart={report.pageStart}
                reportTotal={report.reportTotal}
                rows={report.rows}
                selectedRecordIds={report.selectedRecordIds}
                summaryCards={report.summaryCards}
                typePage={report.appliedFilters.typePage}
                onToggleRow={report.toggleReportRow}
                onToggleRows={report.toggleReportRows}
              />
            )}
          </ReportTableCard>
        </div>
      </div>

      <ReportExportLoadingDialog exporting={report.exporting} progress={report.exportProgress} />

      {report.exportSurfaceReady ? (
        <ReportExportSurface
          cards={report.cards}
          billGroups={report.renderedExportData.billGroups}
          columns={report.columns}
          containerRef={exportReportRef}
          dateRange={`${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
          itemColumns={report.detailItemColumns}
          noLabel={t("fields.no")}
          reportTotal={report.renderedExportData.reportTotal}
          rows={report.renderedExportData.rows}
          showSummary={summaryVisible}
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
            report.appliedFilters.typePage === "bill"
              ? t("report.salesReportByBill")
              : t("report.detailedSalesReport")
          }
        />
      ) : null}
    </>
  );
}
