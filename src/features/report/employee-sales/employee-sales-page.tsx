"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Banknote, CircleX, HandCoins, Landmark, ReceiptText, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PAGE_LIMIT_OPTIONS, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import { ReportColumnsMenu, useReportColumnVisibility } from "@/features/report/shared/report-column-visibility";
import { ReportError } from "@/features/report/shared/report-error";
import {
  ReportExportMenu,
  ReportMobileFilterBar,
  ReportPage,
  ReportPaginationBar,
  ReportRefreshButton,
  ReportResultArea,
  ReportSummaryToggle,
  ReportToolbar,
} from "@/features/report/shared/report-layout";
import { ReportStatCards } from "@/features/report/shared/report-stat-cards";
import { useReportRowSelection } from "@/features/report/shared/report-row-selection";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { reportLocationParams } from "@/features/report/shared/report-location";
import { useReportLocationOptions } from "@/features/report/shared/use-report-location-options";
import { businessDateInputValue, money } from "@/lib/format";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useEmployeeSalesReportStore } from "@/stores/report-store";
import type { EmployeeSalesRow } from "@/services/report";
import { EmployeeSalesDetailSheet } from "./employee-sales-detail-sheet";
import { emptyEmployeeSalesSummary, employeeSalesRowId } from "./employee-sales-report-excel";
import { EmployeeSalesExportSurface } from "./employee-sales-report-components";
import { EmployeeSalesFilterBar, EmployeeSalesFilterSheet, type EmployeeSalesDraft } from "./employee-sales-filter-sheet";
import { EmployeeSalesRowCard } from "./employee-sales-row-card";
import { EmployeeSalesSkeleton } from "./employee-sales-skeleton";
import { EmployeeSalesTable, employeeSalesColumnOptions } from "./employee-sales-table";
import { useEmployeeSalesReportExport } from "./use-employee-sales-report-export";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

const SUMMARY_ID = "employee-sales-summary";
// อ้างอิงเดิมทุกครั้งตอนยังไม่มีข้อมูล — ป้องกัน useReportRowSelection มองว่า "rows" เปลี่ยนทุก
// render (อาร์เรย์ [] ใหม่ทุกครั้ง) แล้ว reset ค่าเลือกไว้วนไม่รู้จบ (useResetOnChange เทียบด้วย reference)
const EMPTY_ROWS: EmployeeSalesRow[] = [];

export function EmployeeSalesPage() {
  const user = useAuthStore(state => state.user);
  return <EmployeeSalesReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function isValidDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

function EmployeeSalesReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useEmployeeSalesReportStore();
  const exportReportRef = useRef<HTMLDivElement>(null);
  const today = businessDateInputValue();
  const [draft, setDraft] = useState<EmployeeSalesDraft>(() => ({
    branchUuid: scope.defaultBranchUuid, loginUuid: "", dateFrom: today, dateTo: today,
    orderBy: "DESC", limit: PAGE_LIMIT_OPTIONS[0], tableUuid: "all", zoneUuid: "all",
  }));
  const [applied, setApplied] = useState(draft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [page, setPage] = useState(1);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = isValidDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;
  const locationOptions = useReportLocationOptions(draftBranch, draft.zoneUuid, language);

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      ...reportLocationParams({ tableUuid: applied.tableUuid, zoneUuid: applied.zoneUuid }),
      branch_uuid_fk: branchUuid, login_uuid: applied.loginUuid || undefined,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy: applied.orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.loginUuid, applied.dateFrom, applied.dateTo, applied.orderBy, applied.tableUuid, applied.zoneUuid, language, refreshToken]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const rows = current?.user_reports ?? EMPTY_ROWS;
  // จำนวนแถวมาจากการโหลดทั้งหมดในครั้งเดียว (API ไม่รองรับ page/limit) จึงแบ่งหน้าฝั่งเว็บเอง
  const pageSize = pageLimitSize(applied.limit, rows.length);
  const totalPages = pageTotalPages(0, rows.length, pageSize);
  const pageStart = (page - 1) * pageSize;
  const pagedRows = rows.slice(pageStart, pageStart + pageSize);
  const range = pageRange(pagedRows.length, page, pageSize);
  const selected = current?.user_reports.find(row => row.login_uuid === selectedId) ?? null;
  const reportTitle = t("employeeSales.title");
  const branchLabel = scope.branchLabelFor(branchUuid);
  const rowSelection = useReportRowSelection({ getRowId: employeeSalesRowId, rows });
  const columnOptions = useMemo(() => employeeSalesColumnOptions(t), [t]);
  const columns = useReportColumnVisibility("employee-sales", columnOptions);
  const exportHook = useEmployeeSalesReportExport({
    branchLabel,
    branchUuid,
    current,
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
    exportReportRef,
    loading,
    orderBy: applied.orderBy,
    reportTitle,
    selectedCount: rowSelection.selectedCount,
    selectedRowIds: rowSelection.selectedRowIds,
  });
  const exportTitle =
    exportHook.exporting === "excel"
      ? t("report.exportingExcel")
      : exportHook.exporting === "pdf"
        ? t("report.exportingPdf")
        : t("report.preparingPrint");

  function apply() {
    if (!valid) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setPage(1);
    setMobileFilterOpen(false);
  }

  function refresh() {
    setSelectedId(null);
    setPage(1);
    setRefreshToken(previous => previous + 1);
  }

  const filterFieldProps = {
    branchLoading: scope.branchLoading,
    branchLocked: !scope.canSelectBranch,
    branchOptions: scope.branchOptions,
    draft,
    draftBranch,
    locationOptions,
    onDraftChange: setDraft,
  };

  const summary = current?.summary ?? null;
  const controlsDisabled = loading || Boolean(exportHook.exporting);
  const errors = [!branchUuid ? t("report.branchRequired") : null, scope.branchError, error].filter(
    (message): message is string => Boolean(message),
  );
  const refreshButton = <ReportRefreshButton disabled={controlsDisabled} loading={loading} onRefresh={refresh} />;

  return (
    <>
      <ReportPage title={reportTitle}>
        <ReportMobileFilterBar
          dateFrom={applied.dateFrom}
          dateTo={applied.dateTo}
          disabled={controlsDisabled}
          refreshButton={refreshButton}
          onOpenFilters={() => setMobileFilterOpen(true)}
        />
        <EmployeeSalesFilterBar actions={refreshButton} canApply={valid} loading={loading} onApply={apply} {...filterFieldProps} />
        <EmployeeSalesFilterSheet
          canApply={valid}
          dateRangeInvalid={!dateRangeValid}
          loading={loading}
          open={mobileFilterOpen}
          onApply={apply}
          onOpenChange={(open) => {
            if (!open) setDraft(applied);
            setMobileFilterOpen(open);
          }}
          {...filterFieldProps}
        />

        {errors.map((message) => (
          <ReportError key={message} message={message} />
        ))}

        <ReportToolbar
          title={reportTitle}
          selectedLabel={rowSelection.selectedCount ? t("report.selectedForExport", { count: rowSelection.selectedCount }) : null}
          onClearSelection={rowSelection.clearSelection}
          actions={
            <>
              <ReportSummaryToggle
                controlsId={SUMMARY_ID}
                visible={summaryVisible}
                onToggle={() => setSummaryVisible((visible) => !visible)}
              />
              <ReportColumnsMenu disabled={controlsDisabled} options={columnOptions} visibility={columns} />
              <ReportExportMenu
                disabled={exportHook.exportDisabled}
                exporting={Boolean(exportHook.exporting)}
                onExportExcel={() => void exportHook.exportExcel()}
                onExportPdf={() => void exportHook.exportPdf()}
                onPrint={() => void exportHook.printReport()}
              />
            </>
          }
        />

        {/* เดิมหน้านี้ส่ง summary={null} — มีปุ่มสรุปแต่ไม่มีอะไรให้ดู ทั้งที่ API ส่งยอดรวมมาครบ */}
        {summaryVisible && summary ? (
          <ReportStatCards
            id={SUMMARY_ID}
            stats={[
              { icon: TrendingUp, key: "grand_total", label: t("employeeSales.grandTotal"), tone: "highlight", value: money(summary.grand_total) },
              { icon: Users, key: "employees", label: t("employeeSales.employeeCount"), tone: "info", value: summary.employee_count.toLocaleString("en-US") },
              { icon: ReceiptText, key: "bills", label: t("employeeSales.billCount"), tone: "info", value: summary.bill_count.toLocaleString("en-US") },
              { icon: Banknote, key: "cash", label: t("employeeSales.cash"), tone: "success", value: money(summary.cash) },
              { icon: ArrowLeftRight, key: "transfer", label: t("employeeSales.transfer"), tone: "info", value: money(summary.transfer) },
              { icon: HandCoins, key: "credit", label: t("employeeSales.credit"), tone: "warning", value: money(summary.credit) },
              { icon: Landmark, key: "vat", label: t("employeeSales.vat"), tone: "warning", value: money(summary.vat) },
              {
                icon: CircleX,
                key: "cancel",
                label: t("employeeSales.cancelledBadge", { count: summary.cancel_bill_count }),
                negative: summary.cancel_total_amount > 0,
                tone: "danger",
                value: money(summary.cancel_total_amount),
              },
            ]}
          />
        ) : null}

        {loading && !pagedRows.length ? (
          <ReportResultArea>
            <EmployeeSalesSkeleton />
          </ReportResultArea>
        ) : pagedRows.length ? (
          <>
            <ReportResultArea framed busy={loading} className="hidden md:flex">
              <EmployeeSalesTable
                isColumnVisible={columns.isVisible}
                rows={pagedRows}
                selectedRowIds={rowSelection.selectedRowIds}
                summary={summary}
                onSelect={setSelectedId}
                onToggleRow={rowSelection.toggleRow}
                onToggleRows={rowSelection.toggleRows}
              />
            </ReportResultArea>
            <div className="md:hidden">
              <EmployeeSalesRowCard
                rows={pagedRows}
                selectedRowIds={rowSelection.selectedRowIds}
                total={summary?.grand_total ?? 0}
                onSelect={setSelectedId}
                onToggleRow={rowSelection.toggleRow}
              />
            </div>
            <ReportPaginationBar>
              <AppPagination
                page={page}
                totalPages={totalPages}
                rangeLabel={t("common.showingRange", { start: range.start, end: range.end, total: rows.length })}
                onPageChange={setPage}
              />
            </ReportPaginationBar>
          </>
        ) : (
          <EmptyState title={t("employeeSales.empty")} description={t("employeeSales.emptyDescription")} />
        )}
      </ReportPage>

      {exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
        <EmployeeSalesExportSurface
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(applied.dateFrom, applied.dateTo)}`}
          rows={exportHook.exportData?.rows ?? current?.user_reports ?? []}
          showSummary={summaryVisible}
          summary={exportHook.exportData?.summary ?? current?.summary ?? emptyEmployeeSalesSummary}
          title={exportHook.exportData?.reportName || reportTitle}
        />
      ) : null}
      <BlockingLoadingDialog open={Boolean(exportHook.exporting)} title={exportTitle} description={t("report.exportingDescription")} />

      <EmployeeSalesDetailSheet
        row={selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
