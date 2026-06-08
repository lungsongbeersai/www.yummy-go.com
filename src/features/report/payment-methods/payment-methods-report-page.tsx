"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { CalendarDays, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { UrlPaginationState } from "@/lib/url-pagination";
import {
  MobilePaymentMethodsFilterSummary,
  PaymentMethodsExportSurface,
  PaymentMethodsFilterBar,
  PaymentMethodsFilterSheet,
  PaymentMethodsMobileList,
  PaymentMethodsSummaryCards,
  PaymentMethodsTable,
  PaymentMethodsTableCard
} from "./payment-methods-report-components";
import { ReportError, ReportPagination, ReportSummaryToggle } from "../daily-sales/daily-sales-report-components";
import { usePaymentMethodsReportWorkflow } from "./use-payment-methods-report-workflow";

const SUMMARY_CARDS_ID = "payment-methods-summary-cards";

export function PaymentMethodsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(0);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = usePaymentMethodsReportWorkflow(exportReportRef, initialPagination);
  const layoutStyle = {
    "--payment-method-filter-height": `${filterHeight}px`
  } as CSSProperties;

  useEffect(() => {
    const node = filterRef.current;
    if (!node) return;

    let frameId = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(node.getBoundingClientRect().height);
        setFilterHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
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
      <div className="h-full min-h-0 overflow-y-auto" style={layoutStyle}>
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-primary">
                <CreditCard className="size-4" />
                {t("nav.report_menu")}
              </div>
              <h1 className="text-2xl font-black tracking-normal text-foreground">{report.reportTitle}</h1>
              <p className="text-sm text-muted-foreground">{t("report.paymentMethodsReport.description")}</p>
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
            className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:-mx-6 lg:px-6"
          >
            <div className="sm:hidden">
              <MobilePaymentMethodsFilterSummary
                branchLabel={report.activeBranchLabel}
                filters={report.appliedFilters}
                methodLabel={report.activePaymentMethodLabel}
                onOpen={report.openMobileFilters}
              />
            </div>
            <div className="hidden sm:block">
              <PaymentMethodsFilterBar
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
            </div>
          </div>

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
              />
            }
            loading={report.loading}
            methodLabel={report.activePaymentMethodLabel}
            rangeLabel={report.paginationRangeLabel}
            rowsLength={report.rows.length}
            title={report.reportTitle}
            onExportExcel={() => void report.exportExcel()}
            onExportPdf={() => void report.exportPdf()}
            onPrintReport={() => void report.printReport()}
            onRefresh={() => void report.load()}
          >
            <PaymentMethodsTable rows={report.rows} />
            <PaymentMethodsMobileList rows={report.rows} />
          </PaymentMethodsTableCard>
        </div>
      </div>
      <PaymentMethodsExportSurface
        cards={report.renderedExportData.cards}
        containerRef={exportReportRef}
        dateRange={`${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
        methodLabel={report.activePaymentMethodLabel}
        reportTotal={report.renderedExportData.reportTotal}
        rows={report.renderedExportData.rows}
        rowsLabel={t("report.paymentMethodsReport.rowsLabel", { count: report.renderedExportData.rows.length })}
        title={report.renderedExportData.reportName || report.reportTitle}
      />
    </>
  );
}
