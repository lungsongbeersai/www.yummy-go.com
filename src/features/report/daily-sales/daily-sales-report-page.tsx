"use client";

import { useMemo, useRef, useState } from "react";
import { RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import type { UrlPaginationState } from "@/lib/url-pagination";
import { ReportColumnsMenu, useReportColumnVisibility } from "../shared/report-column-visibility";
import { ReportError } from "../shared/report-error";
import { ReportSummaryToggle } from "../shared/report-layout";
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
import { detailColumnOptions } from "./daily-sales-detail-table";
import { summaryColumnOptions } from "./daily-sales-summary-table";
import { useDailySalesReportWorkflow } from "./use-daily-sales-report-workflow";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

const SUMMARY_CARDS_ID = "daily-sales-summary-cards";

export function DailySalesReportPage({
  initialPagination,
}: {
  initialPagination: UrlPaginationState;
}) {
  const { t } = useTranslation();
  const exportReportRef = useRef<HTMLDivElement>(null);
  // เปิดการ์ดสรุปไว้ตั้งแต่แรก — เป็นภาพรวมที่คนเปิดรายงานมาดูก่อน (ปุ่มตาซ่อนได้)
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
  const report = useDailySalesReportWorkflow(exportReportRef, initialPagination, summaryVisible);
  const canApplyFilters = Boolean(report.draftFilters.branchUuid || report.defaultBranchUuid);
  const dateRangeLabel = `${formatReportDateRange(report.appliedFilters.dateFrom, report.appliedFilters.dateTo)}`;
  const controlsDisabled = report.loading || Boolean(report.exporting);
  const isDetail = report.appliedFilters.typePage === "detail";
  // เลือกคอลัมน์แยกกันต่อมุมมอง (ตามบิล/รายละเอียด) เพราะชุดคอลัมน์ต่างกัน — จำไว้ต่อเครื่อง
  const billColumnOptions = useMemo(() => summaryColumnOptions(t), [t]);
  const detailOptions = useMemo(() => detailColumnOptions(t), [t]);
  const billColumns = useReportColumnVisibility("daily-sales:bill", billColumnOptions);
  const detailColumns = useReportColumnVisibility("daily-sales:detail", detailOptions);
  const refreshButton = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={t("actions.refresh")}
      disabled={controlsDisabled}
      onClick={() => void report.load()}
    >
      <RefreshCcw className={report.loading ? "animate-spin" : undefined} />
    </Button>
  );
  const summaryToggleButton = (
    <ReportSummaryToggle
      controlsId={SUMMARY_CARDS_ID}
      visible={summaryVisible}
      onToggle={() => setSummaryVisible((visible) => !visible)}
    />
  );

  return (
    <>
      {/* โครงเดียวกับหน้าอื่นที่ปรับแล้ว: ตัวกรอง → แถบเครื่องมือตาราง → การ์ดสรุป → ตารางในกรอบ → แบ่งหน้า
          จอ lg ขึ้นไปตารางสกรอลในกรอบของมันเอง — จอเล็กทั้งหน้าสกรอลไปด้วยกัน */}
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden">
        <h1 className="sr-only">{t("report.dailySalesTitle")}</h1>

        {/* จอเล็ก: ปุ่มช่วงวันที่เปิด modal ตัวกรอง + badge บอกตัวกรองที่ใช้อยู่ในแถบเดียวกัน
            (แยกเป็นแถวของตัวเองแล้วกินความสูงอีกชั้นก่อนถึงข้อมูล ทั้งที่เป็นเรื่องเดียวกับปุ่มวันที่) */}
        <div className="lg:hidden">
          <FilterHeaderToolbar
            dateRange={{
              ariaLabel: `${t("report.filters.openFilters")}: ${dateRangeLabel}`,
              disabled: controlsDisabled,
              label: dateRangeLabel,
              onClick: report.openMobileFilters,
            }}
            extraChips={
              <AppliedFilterBadges
                branchLabel={report.activeBranchLabel}
                filters={report.appliedFilters}
                locationOptions={report.locationOptions}
              />
            }
            filterControl={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("report.filters.openFilters")}
                disabled={controlsDisabled}
                onClick={report.openMobileFilters}
              >
                <SlidersHorizontal />
              </Button>
            }
            refreshControl={refreshButton}
          />
        </div>

        {/* จอ lg ขึ้นไป: ตัวกรองอยู่บนหน้าเลย ไม่ต้องเปิด modal เพื่อเปลี่ยนค่าเดียว */}
        <DailySalesFilterBar
          actions={refreshButton}
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={canApplyFilters}
          draftFilters={report.draftFilters}
          loading={report.loading}
          locationOptions={report.locationOptions}
          onApply={report.applyFilters}
          onDraftChange={report.setDraftFilters}
        />

        <DailySalesFilterSheet
          branchLoading={report.branchLoading}
          branchLocked={!report.canSelectBranch}
          branchOptions={report.branchOptions}
          canApply={canApplyFilters}
          draftFilters={report.draftFilters}
          loading={report.loading}
          locationOptions={report.locationOptions}
          open={report.mobileFilterOpen}
          onApply={report.applyMobileFilters}
          onDraftChange={report.setDraftFilters}
          onOpenChange={report.handleMobileFilterOpenChange}
        />

        {!report.branchUuid ? <ReportError message={t("report.branchRequired")} /> : null}
        {report.branchError ? <ReportError message={report.branchError} /> : null}
        {report.error ? <ReportError message={report.error} /> : null}

        <DailySalesTableCard
          actions={{
            allDetailGroupsExpanded: report.allDetailGroupsExpanded,
            billGroupsLength: report.billGroups.length,
            columnsMenu: (
              <ReportColumnsMenu
                disabled={controlsDisabled}
                options={isDetail ? detailOptions : billColumnOptions}
                visibility={isDetail ? detailColumns : billColumns}
              />
            ),
            exportDisabled: report.exportDisabled,
            exporting: report.exporting,
            loading: report.loading,
            selectedCount: report.selectedCount,
            selectedBillCount: report.selectedBillCount,
            summaryToggle: summaryToggleButton,
            summaryCards: summaryVisible ? (
              <div id={SUMMARY_CARDS_ID}>
                <DailySalesSummaryCards
                  cards={report.cards}
                  reportTotal={report.reportTotal}
                  summaryCards={report.summaryCards}
                />
              </div>
            ) : null,
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
            <div className="pb-[max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px))]">
              <AppPagination
                page={report.page}
                pageSize={{
                  // มุมมองละเอียดแบ่งหน้าตามบิลหรือตามรายการ (ขึ้นกับ API) — ให้ป้ายบอกหน่วยให้ถูก
                  label: isDetail
                    ? report.detailPageBasis === "bills"
                      ? t("report.billsPerPage")
                      : t("report.linesPerPage")
                    : undefined,
                  onChange: report.changePageLimit,
                  value: report.appliedFilters.limit,
                }}
                rangeLabel={report.paginationRangeLabel}
                totalPages={report.totalPages}
                onPageChange={report.setPage}
              />
            </div>
          }
          loading={report.loading}
          rowsLength={isDetail ? report.billGroups.length : report.rows.length}
        >
          {isDetail ? (
            <DetailBillTable
              collapsedGroups={report.collapsedBillGroups}
              groups={report.billGroups}
              isColumnVisible={detailColumns.isVisible}
              itemColumns={report.detailItemColumns}
              pageStart={report.pageStart}
              pinning={detailColumns.pinning}
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
              isColumnVisible={billColumns.isVisible}
              pinning={billColumns.pinning}
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
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(report.appliedFilters.dateFrom, report.appliedFilters.dateTo)}`}
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
