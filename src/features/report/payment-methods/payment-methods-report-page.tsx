"use client";

import { type CSSProperties, useRef, useState } from "react";
import { CreditCard, Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  PaymentMethodsExportSurface,
  PaymentMethodsFilterSheet,
  PaymentMethodsMobileList,
  PaymentMethodsSummaryCards,
  PaymentMethodsTable,
  PaymentMethodsTableCard
} from "./payment-methods-report-components";
import { ReportError } from "../shared/report-error";
import { ReportPagination } from "../shared/report-pagination";
import { usePaymentMethodsReportWorkflow } from "./use-payment-methods-report-workflow";

const SUMMARY_CARDS_ID = "payment-methods-summary-cards";

export function PaymentMethodsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const nativeApp = useIsCapacitorNativeApp();
  const report = usePaymentMethodsReportWorkflow(exportReportRef, initialPagination);
  const layoutStyle = {
    "--payment-method-filter-height": "0px"
  } as CSSProperties;
  const dateRangeLabel = `${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`;
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
                <CreditCard className="size-4" />
                {t("nav.report_menu")}
              </div>
              <h1 className="truncate text-xl font-black tracking-normal text-foreground sm:text-2xl">
                {report.reportTitle}
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {t("report.paymentMethodsReport.description")}
              </p>
            </div>
          </div>

          <FilterHeaderToolbar
            dateRange={{
              ariaLabel: `${t("report.filters.openFilters")}: ${dateRangeLabel}`,
              disabled: report.loading || Boolean(report.exporting),
              label: dateRangeLabel,
              onClick: report.openMobileFilters
            }}
            extraChips={
              <>
                <Badge className="h-7 max-w-56 rounded-full border-border bg-muted px-3 text-xs text-muted-foreground">
                  <span className="truncate">{report.activeBranchLabel}</span>
                </Badge>
                <Badge className="h-7 max-w-44 rounded-full border-border bg-muted px-3 text-xs text-muted-foreground">
                  <span className="truncate">{report.activePaymentMethodLabel}</span>
                </Badge>
              </>
            }
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

          <PaymentMethodsFilterSheet
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

          {!report.branchUuid ? <ReportError message={t("report.branchRequired")} /> : null}
          {report.branchError ? <ReportError message={report.branchError} /> : null}
          {report.error ? <ReportError message={report.error} /> : null}

          <div id={SUMMARY_CARDS_ID} hidden={!summaryVisible}>
            <PaymentMethodsSummaryCards cards={report.cards} reportTotal={report.reportTotal} />
          </div>

          <PaymentMethodsTableCard
            exportDisabled={report.exportDisabled}
            exporting={report.exporting}
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
            printDisabled={report.exportDisabled || nativeApp}
            rowsLength={report.rows.length}
            selectedCount={report.rowSelection.selectedCount}
            title={report.reportTitle}
            onClearSelection={report.rowSelection.clearSelection}
            onExportExcel={() => void report.exportExcel()}
            onExportPdf={() => void report.exportPdf()}
            onPrintReport={() => void report.printReport()}
            onRefresh={() => void report.load()}
          >
            <PaymentMethodsTable
              reportTotal={report.reportTotal}
              rows={report.rows}
              selectedRowIds={report.rowSelection.selectedRowIds}
              onToggleRow={report.rowSelection.toggleRow}
              onToggleRows={report.rowSelection.toggleRows}
            />
            <PaymentMethodsMobileList
              reportTotal={report.reportTotal}
              rows={report.rows}
              selectedRowIds={report.rowSelection.selectedRowIds}
              onToggleRow={report.rowSelection.toggleRow}
            />
          </PaymentMethodsTableCard>
        </div>
      </div>
      {report.exporting === "pdf" || report.exporting === "print" ? (
        <PaymentMethodsExportSurface
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
          methodLabel={report.activePaymentMethodLabel}
          rows={report.renderedExportData.rows}
          title={report.renderedExportData.reportName || report.reportTitle}
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
