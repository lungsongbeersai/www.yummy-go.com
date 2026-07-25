"use client";

import { useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  PaymentMethodsExportSurface,
  PaymentMethodsFilterSheet,
  PaymentMethodsLoadingSkeleton,
  PaymentMethodsMobileList,
  PaymentMethodsSummaryCards,
  PaymentMethodsTable,
} from "./payment-methods-report-components";
import { ReportPageShell } from "../shared/report-page-shell";
import { ReportDataCard, useReportChrome } from "../shared/report-standard-page";
import { usePaymentMethodsReportWorkflow } from "./use-payment-methods-report-workflow";

const SUMMARY_CARDS_ID = "payment-methods-summary-cards";

export function PaymentMethodsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = usePaymentMethodsReportWorkflow(exportReportRef, initialPagination);
  const chrome = useReportChrome(report);

  return (
    <ReportPageShell
      variant="compact"
      icon={CreditCard}
      title={report.reportTitle}
      description={t("report.paymentMethodsReport.description")}
      dateFrom={report.appliedFilters.dateFrom}
      dateTo={report.appliedFilters.dateTo}
      loading={report.loading}
      exporting={Boolean(report.exporting)}
      exportingTitle={chrome.exportTitle}
      errors={chrome.errors}
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
        <ReportDataCard
          report={report}
          cardClassName="min-w-0 overflow-hidden border-border bg-card shadow-sm"
          contentClassName="p-0"
          contentWrapperClassName="min-w-0 overflow-x-auto overscroll-x-contain"
          headerVariant="compact"
          icon={CreditCard}
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
        </ReportDataCard>
      }
      exportSurface={
        report.exporting === "pdf" || report.exporting === "print" ? (
          <PaymentMethodsExportSurface
            containerRef={exportReportRef}
            dateRange={chrome.dateRangeLabel}
            methodLabel={report.activePaymentMethodLabel}
            rows={report.renderedExportData.rows}
            title={report.renderedExportData.reportName || report.reportTitle}
          />
        ) : undefined
      }
    />
  );
}
