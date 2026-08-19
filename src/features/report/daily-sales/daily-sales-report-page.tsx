"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { ReportError } from "../shared/report-error";
import {
  DailySalesSummaryCards,
  DailySalesTableCard,
  ReportExportLoadingDialog,
} from "./daily-sales-report-components";
import { DailySalesExportSurface } from "./daily-sales-report-export-surface";
import {
  AppliedFilterBadges,
  DailySalesFilterBar,
  DailySalesFilterSheet,
} from "./daily-sales-report-filters";
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
  const report = useDailySalesReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const canApplyFilters = Boolean(report.draftFilters.branchUuid || report.defaultBranchUuid);
  const dateRangeLabel = `${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`;
  const controlsDisabled = report.loading || Boolean(report.exporting);
  const summaryToggleLabel = summaryVisible ? t("report.hideSummary") : t("report.showSummary");
  const refreshButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="h-9 w-9 shrink-0"
      aria-label={t("actions.refresh")}
      disabled={controlsDisabled}
      onClick={() => void report.load()}
    >
      <RefreshCcw className={report.loading ? "animate-spin" : undefined} data-icon="inline-start" />
      <span className="sr-only">{t("actions.refresh")}</span>
    </Button>
  );
  const summaryToggleButton = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="h-9 w-9 shrink-0"
      aria-controls={SUMMARY_CARDS_ID}
      aria-expanded={summaryVisible}
      aria-label={summaryToggleLabel}
      onClick={() => setSummaryVisible((visible) => !visible)}
    >
      {summaryVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
      <span className="sr-only">{summaryToggleLabel}</span>
    </Button>
  );

  return (
    <>
      {/* เต็มหน้าจอแบบ /settings/store: ไม่มี padding รอบนอก แถบตัวกรองกับตารางชนขอบ
          และตารางกินความสูงที่เหลือทั้งหมด (flex-1) แทนที่จะลอยอยู่ในกรอบ */}
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <h1 className="sr-only">{t("report.dailySalesTitle")}</h1>

        {/* จอเล็ก: แถบเครื่องมือมาตรฐาน + แถว badge บอกตัวกรองที่ใช้อยู่ (แก้ค่าผ่าน modal) */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-2 py-2 sm:px-3 lg:hidden">
            <FilterHeaderToolbar
              dateRange={{
                ariaLabel: `${t("report.filters.openFilters")}: ${dateRangeLabel}`,
                disabled: controlsDisabled,
                label: dateRangeLabel,
                onClick: report.openMobileFilters,
              }}
              filterControl={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-9 shrink-0"
                  aria-label={t("report.filters.openFilters")}
                  disabled={controlsDisabled}
                  onClick={report.openMobileFilters}
                >
                  <SlidersHorizontal data-icon="inline-start" />
                  <span className="sr-only">{t("report.filters.openFilters")}</span>
                </Button>
              }
              refreshControl={refreshButton}
              summaryControl={summaryToggleButton}
            />
            <AppliedFilterBadges
              branchLabel={report.activeBranchLabel}
              detailPaginationBasis={report.detailPageBasis}
              filters={report.appliedFilters}
            />
          </div>

          {/* จอ lg ขึ้นไป: ตัวกรองอยู่บนหน้าเลย ไม่ต้องเปิด modal เพื่อเปลี่ยนค่าเดียว */}
          <DailySalesFilterBar
            actions={
              <>
                {summaryToggleButton}
                {refreshButton}
              </>
            }
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

          <DailySalesFilterSheet
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

        {/* ส่วนที่ไม่ใช่ตารางยังต้องมีระยะในของตัวเอง เพราะพ่อแม่ไม่มี padding แล้ว */}
        {report.branchUuid && !report.branchError && !report.error ? null : (
          <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3">
            {!report.branchUuid ? <ReportError message={t("report.branchRequired")} /> : null}
            {report.branchError ? <ReportError message={report.branchError} /> : null}
            {report.error ? <ReportError message={report.error} /> : null}
          </div>
        )}

        <div id={SUMMARY_CARDS_ID} className="shrink-0 px-2 py-2 sm:px-3" hidden={!summaryVisible}>
          <DailySalesSummaryCards
            cards={report.cards}
            reportTotal={report.reportTotal}
            summaryCards={report.summaryCards}
          />
        </div>

          <DailySalesTableCard
            actions={{
              allDetailGroupsExpanded: report.allDetailGroupsExpanded,
              billGroupsLength: report.billGroups.length,
              exportDisabled: report.exportDisabled,
              exporting: report.exporting,
              loading: report.loading,
              selectedCount: report.selectedCount,
              selectedBillCount: report.selectedBillCount,
              typePage: report.appliedFilters.typePage,
              onClearSelection: report.clearSelection,
              onCollapseAllBills: report.collapseAllBills,
              onExpandAllBills: report.expandAllBills,
              onExportExcel: () => void report.exportExcel(),
              onExportPdf: () => void report.exportPdf(),
              onPrintReport: () => void report.printReport(),
              onTypePageChange: (typePage) => report.applyTableHeaderFilters({ typePage }),
            }}
            footer={
              <AppPagination
                page={report.page}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
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
        </DailySalesTableCard>
      </div>

      <ReportExportLoadingDialog exporting={report.exporting} progress={report.exportProgress} />

      {report.exportSurfaceReady ? (
        <DailySalesExportSurface
          cards={report.cards}
          billGroups={report.renderedExportData.billGroups}
          columns={report.exportColumns}
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${report.appliedFilters.dateFrom} - ${report.appliedFilters.dateTo}`}
          itemColumns={report.detailItemColumns}
          noLabel={t("fields.no")}
          reportTotal={report.renderedExportData.reportTotal}
          rows={report.renderedExportData.rows}
          showSummary={summaryVisible}
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
