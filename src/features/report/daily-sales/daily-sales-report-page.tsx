"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { BarChart3, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  ReportError,
  ReportPagination,
  ReportSummaryCards,
  ReportSummaryToggle,
  ReportTableCard,
} from "./daily-sales-report-components";
import { ReportExportSurface } from "./daily-sales-report-export-surface";
import {
  MobileReportFilterSummary,
  ReportFilterBar,
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
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useDailySalesReportWorkflow(exportReportRef, initialPagination);
  const layoutStyle = {
    "--daily-sales-filter-height": `${filterHeight}px`,
  } as CSSProperties;
  const canApplyFilters = Boolean(
    report.draftFilters.branchUuid || report.defaultBranchUuid,
  );

  useEffect(() => {
    const node = filterRef.current;
    if (!node) return;

    let frameId = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(node.getBoundingClientRect().height);
        setFilterHeight((currentHeight) =>
          currentHeight === nextHeight ? currentHeight : nextHeight,
        );
      });
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", updateHeight);
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateHeight);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto" style={layoutStyle}>
        <div className="mx-auto flex w-full min-w-0 max-w-full flex-col gap-4 p-3 sm:p-4 lg:p-6 2xl:max-w-375">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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

          <div
            ref={filterRef}
            className="sticky top-0 z-30 -mx-3 bg-background/95 px-3 py-2 backdrop-blur supports-backdrop-filter:bg-background/85 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
          >
            <div className="sm:hidden">
              <MobileReportFilterSummary
                branchLabel={report.activeBranchLabel}
                detailPaginationBasis={report.detailPageBasis}
                filters={report.appliedFilters}
                onOpen={report.openMobileFilters}
              />
            </div>
            <div className="hidden sm:block">
              <ReportFilterBar
                branchLoading={report.branchLoading}
                branchLocked={!report.canSelectBranch}
                branchOptions={report.branchOptions}
                canApply={canApplyFilters}
                detailPaginationBasis={report.detailPageBasis}
                draftFilters={report.draftFilters}
                loading={report.loading}
                onApply={report.applyFilters}
                onDraftChange={report.setDraftFilters}
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
              contextRangeLabel: report.contextRangeLabel,
              detailLinesCount: report.rows.length,
              exportDisabled: report.exportDisabled,
              exporting: report.exporting,
              loading: report.loading,
              selectedCount: report.selectedCount,
              typePage: report.appliedFilters.typePage,
              onClearSelection: report.clearSelection,
              onCollapseAllBills: report.collapseAllBills,
              onExpandAllBills: report.expandAllBills,
              onExportExcel: () => void report.exportExcel(),
              onExportPdf: () => void report.exportPdf(),
              onPrintReport: () => void report.printReport(),
              onRefresh: () => void report.load(),
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
