"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { ReportColumnsMenu, useReportColumnVisibility } from "../shared/report-column-visibility";
import { ReportError } from "../shared/report-error";
import {
  ReportExportMenu,
  ReportMobileFilterBar,
  ReportPage,
  ReportPaginationBar,
  ReportRefreshButton,
  ReportResultArea,
  ReportSummaryToggle,
  ReportToolbar,
} from "../shared/report-layout";
import {
  PaymentMethodShareCards,
  PaymentMethodsExportSurface,
  PaymentMethodsFilterBar,
  PaymentMethodsFilterSheet,
  PaymentMethodsSummaryCards,
  PaymentMethodsTable,
  paymentMethodMetricOptions,
} from "./payment-methods-report-components";
import { usePaymentMethodsReportWorkflow } from "./use-payment-methods-report-workflow";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

const SUMMARY_CARDS_ID = "payment-methods-summary-cards";

// โครงเดียวกับรายงานหน้าอื่นที่ปรับแล้ว (daily-sales / best-selling) ดู shared/report-layout.tsx
export function PaymentMethodsReportPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  // เปิดการ์ดสรุปไว้ตั้งแต่แรก — เป็นภาพรวมที่คนเปิดรายงานมาดูก่อน (ปุ่มตาซ่อนได้)
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = usePaymentMethodsReportWorkflow(exportReportRef, initialPagination);
  const metricOptions = useMemo(() => paymentMethodMetricOptions(t), [t]);
  const metrics = useReportColumnVisibility("payment-methods", metricOptions);
  const controlsDisabled = report.loading || Boolean(report.exporting);
  const selectedCount = report.rowSelection.selectedCount;
  const exportTitle =
    report.exporting === "excel"
      ? t("report.exportingExcel")
      : report.exporting === "pdf"
        ? t("report.exportingPdf")
        : t("report.preparingPrint");
  const errors = [
    !report.branchUuid ? t("report.branchRequired") : null,
    report.branchError,
    report.error,
  ].filter((message): message is string => Boolean(message));
  const refreshButton = (
    <ReportRefreshButton disabled={controlsDisabled} loading={report.loading} onRefresh={() => void report.load()} />
  );

  return (
    <>
      {/* ตารางมีแค่ ~12 แถว แต่มีการ์ดสรุป+การ์ดวิธีชำระหลายใบ — สกรอลทั้งหน้าแทนการล็อกความสูง */}
      <ReportPage pageScroll title={report.reportTitle}>
        <ReportMobileFilterBar
          dateFrom={report.appliedFilters.dateFrom}
          dateTo={report.appliedFilters.dateTo}
          disabled={controlsDisabled}
          extraChips={
            <>
              <Badge variant="secondary">{report.activeBranchLabel}</Badge>
              <Badge variant="secondary">{report.activePaymentMethodLabel}</Badge>
            </>
          }
          refreshButton={refreshButton}
          onOpenFilters={report.openMobileFilters}
        />
        <PaymentMethodsFilterBar
          actions={refreshButton}
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          loading={report.loading}
          locationOptions={report.locationOptions}
          methodOptions={report.methodOptions}
          onApply={report.applyFilters}
          onDraftChange={report.setDraftFilters}
        />
        <PaymentMethodsFilterSheet
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={report.canApply}
          draftFilters={report.draftFilters}
          loading={report.loading}
          locationOptions={report.locationOptions}
          methodOptions={report.methodOptions}
          open={report.mobileFilterOpen}
          onApply={report.applyMobileFilters}
          onDraftChange={report.setDraftFilters}
          onOpenChange={report.handleMobileFilterOpenChange}
        />

        {errors.map((message) => (
          <ReportError key={message} message={message} />
        ))}

        <ReportToolbar
          title={report.reportTitle}
          selectedLabel={selectedCount ? t("report.selectedForExport", { count: selectedCount }) : null}
          onClearSelection={report.rowSelection.clearSelection}
          actions={
            <>
              <ReportSummaryToggle
                controlsId={SUMMARY_CARDS_ID}
                visible={summaryVisible}
                onToggle={() => setSummaryVisible((visible) => !visible)}
              />
              <ReportColumnsMenu
                disabled={controlsDisabled}
                heading={t("report.toggleMetrics")}
                label={t("report.metricsMenu")}
                options={metricOptions}
                visibility={metrics}
              />
              <ReportExportMenu
                disabled={report.exportDisabled}
                exporting={Boolean(report.exporting)}
                onExportExcel={() => void report.exportExcel()}
                onExportPdf={() => void report.exportPdf()}
                onPrint={() => void report.printReport()}
              />
            </>
          }
        />

        {summaryVisible ? (
          <PaymentMethodsSummaryCards id={SUMMARY_CARDS_ID} cards={report.cards} reportTotal={report.reportTotal} />
        ) : null}

        {report.loading && !report.rows.length ? (
          <ReportResultArea>
            <LoadingState label={t("report.loading")} variant="reportTable" />
          </ReportResultArea>
        ) : report.rows.length ? (
          <>
            <PaymentMethodShareCards
              reportTotal={report.reportTotal}
              rows={report.rows}
              selectedRowIds={report.rowSelection.selectedRowIds}
              onToggleRow={report.rowSelection.toggleRow}
            />
            <ReportResultArea framed fill={false} busy={report.loading}>
              <PaymentMethodsTable
                isMetricVisible={metrics.isVisible}
                reportTotal={report.reportTotal}
                rows={report.rows}
                selectedRowIds={report.rowSelection.selectedRowIds}
                onToggleRows={report.rowSelection.toggleRows}
              />
            </ReportResultArea>
            <ReportPaginationBar>
              <AppPagination
                page={report.page}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
                onPageChange={report.setPage}
              />
            </ReportPaginationBar>
          </>
        ) : (
          <EmptyState
            title={t("report.paymentMethodsReport.noData")}
            description={t("report.paymentMethodsReport.adjustFilters")}
          />
        )}
      </ReportPage>

      {report.exporting === "pdf" || report.exporting === "print" ? (
        <PaymentMethodsExportSurface
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(report.appliedFilters.dateFrom, report.appliedFilters.dateTo)}`}
          methodLabel={report.activePaymentMethodLabel}
          reportTotal={report.renderedExportData.reportTotal}
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
