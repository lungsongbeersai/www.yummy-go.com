"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { Badge } from "@/components/ui/badge";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  PaymentMethodsExportSurface,
  PaymentMethodsFilterBar,
  PaymentMethodsFilterSheet,
  PaymentMethodsLoadingSkeleton,
  PaymentMethodsMobileList,
  PaymentMethodsSummaryCards,
  PaymentMethodsTable,
} from "./payment-methods-report-components";
import { ReportPageShell } from "../shared/report-page-shell";
import { ReportTableCard } from "../shared/report-table-card";
import { usePaymentMethodsReportWorkflow } from "./use-payment-methods-report-workflow";

const SUMMARY_CARDS_ID = "payment-methods-summary-cards";

export function PaymentMethodsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = usePaymentMethodsReportWorkflow(exportReportRef, initialPagination);
  const exportTitle =
    report.exporting === "excel"
      ? t("report.exportingExcel")
      : report.exporting === "pdf"
        ? t("report.exportingPdf")
        : t("report.preparingPrint");

  return (
    <ReportPageShell
      accessibleTitle={report.reportTitle}
      variant="compact"
      dateFrom={report.appliedFilters.dateFrom}
      dateTo={report.appliedFilters.dateTo}
      loading={report.loading}
      exporting={Boolean(report.exporting)}
      exportingTitle={exportTitle}
      errors={[
        !report.branchUuid ? t("report.branchRequired") : null,
        report.branchError,
        report.error,
      ]}
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
      inlineFilters={(actions) => (
        <PaymentMethodsFilterBar
          actions={actions}
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          loading={report.loading}
          methodOptions={report.methodOptions}
          onApply={report.applyFilters}
          onDraftChange={report.setDraftFilters}
        />
      )}
      filterSheet={
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
      }
      summaryCardsId={SUMMARY_CARDS_ID}
      summaryVisible={summaryVisible}
      onToggleSummary={() => setSummaryVisible((visible) => !visible)}
      summary={<PaymentMethodsSummaryCards cards={report.cards} reportTotal={report.reportTotal} />}
      onOpenFilters={report.openMobileFilters}
      onRefresh={() => void report.load()}
      table={
        <ReportTableCard
          cardClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card shadow-none"
          contentClassName="flex min-h-0 flex-1 flex-col p-0"
          contentWrapperClassName="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
          headerVariant="compact"
          title={report.reportTitle}
          subtitle={
            report.rows.length ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {t("report.paymentMethodsReport.rowsLabel", { count: report.rows.length })}
              </p>
            ) : null
          }
          showLoadingBadge
          renderLoading={() => <PaymentMethodsLoadingSkeleton />}
          emptyTitle={t("report.paymentMethodsReport.noData")}
          emptyDescription={t("report.paymentMethodsReport.adjustFilters")}
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
        </ReportTableCard>
      }
      exportSurface={
        report.exporting === "pdf" || report.exporting === "print" ? (
          <PaymentMethodsExportSurface
            containerRef={exportReportRef}
            dateRange={`${t("report.reportDate")}: ${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
            methodLabel={report.activePaymentMethodLabel}
            reportTotal={report.renderedExportData.reportTotal}
            rows={report.renderedExportData.rows}
            title={report.renderedExportData.reportName || report.reportTitle}
          />
        ) : undefined
      }
    />
  );
}
