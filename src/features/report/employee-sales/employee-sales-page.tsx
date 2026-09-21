"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { PAGE_LIMIT_OPTIONS, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import { ReportPageShell } from "@/features/report/shared/report-page-shell";
import { useReportRowSelection } from "@/features/report/shared/report-row-selection";
import { ReportTableCard } from "@/features/report/shared/report-table-card";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { businessDateInputValue } from "@/lib/format";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useEmployeeSalesReportStore } from "@/stores/report-store";
import type { EmployeeSalesRow } from "@/services/report";
import { EmployeeSalesDetailSheet } from "./employee-sales-detail-sheet";
import { emptyEmployeeSalesSummary, employeeSalesRowId } from "./employee-sales-report-excel";
import { EmployeeSalesExportSurface } from "./employee-sales-report-components";
import { EmployeeSalesFilterBar, EmployeeSalesFilterSheet, type EmployeeSalesDraft } from "./employee-sales-filter-sheet";
import { EmployeeSalesRowCard } from "./employee-sales-row-card";
import { EmployeeSalesSkeleton } from "./employee-sales-skeleton";
import { EmployeeSalesTable } from "./employee-sales-table";
import { useEmployeeSalesReportExport } from "./use-employee-sales-report-export";

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
    orderBy: "DESC", limit: PAGE_LIMIT_OPTIONS[0],
  }));
  const [applied, setApplied] = useState(draft);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [page, setPage] = useState(1);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = isValidDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      branch_uuid_fk: branchUuid, login_uuid: applied.loginUuid || undefined,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy: applied.orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.loginUuid, applied.dateFrom, applied.dateTo, applied.orderBy, language, refreshToken]);

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
    onDraftChange: setDraft,
  };

  return (
    <>
      <ReportPageShell
        accessibleTitle={t("employeeSales.title")}
        variant="compact"
        dateFrom={applied.dateFrom}
        dateTo={applied.dateTo}
        loading={loading}
        exporting={Boolean(exportHook.exporting)}
        exportingTitle={exportTitle}
        errors={[
          !branchUuid ? t("report.branchRequired") : null,
          scope.branchError,
          error,
        ]}
        inlineFilters={actions => (
          <EmployeeSalesFilterBar
            actions={actions}
            canApply={valid}
            loading={loading}
            onApply={apply}
            {...filterFieldProps}
          />
        )}
        filterSheet={
          <EmployeeSalesFilterSheet
            canApply={valid}
            dateRangeInvalid={!dateRangeValid}
            loading={loading}
            open={mobileFilterOpen}
            onApply={apply}
            onOpenChange={open => { if (!open) setDraft(applied); setMobileFilterOpen(open); }}
            {...filterFieldProps}
          />
        }
        summaryCardsId={SUMMARY_ID}
        summaryVisible={summaryVisible}
        onToggleSummary={() => setSummaryVisible(visible => !visible)}
        summary={null}
        onOpenFilters={() => setMobileFilterOpen(true)}
        onRefresh={refresh}
        table={
          <ReportTableCard
            cardClassName="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card shadow-none"
            contentClassName="flex min-h-0 flex-1 flex-col p-0"
            contentWrapperClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4"
            headerVariant="compact"
            title={reportTitle}
            skeletonMode="whenEmpty"
            renderLoading={() => <EmployeeSalesSkeleton />}
            emptyTitle={t("employeeSales.empty")}
            emptyDescription={t("employeeSales.emptyDescription")}
            loading={loading}
            rowsLength={pagedRows.length}
            selectedCount={rowSelection.selectedCount}
            exportDisabled={exportHook.exportDisabled}
            exporting={exportHook.exporting}
            footer={
              <AppPagination
                page={page}
                totalPages={totalPages}
                rangeLabel={t("common.showingRange", { start: range.start, end: range.end, total: rows.length })}
                onPageChange={setPage}
              />
            }
            onClearSelection={rowSelection.clearSelection}
            onExportExcel={() => void exportHook.exportExcel()}
            onExportPdf={() => void exportHook.exportPdf()}
            onExportPrint={() => void exportHook.printReport()}
          >
            <EmployeeSalesTable
              rows={pagedRows}
              selectedRowIds={rowSelection.selectedRowIds}
              onSelect={setSelectedId}
              onToggleRow={rowSelection.toggleRow}
              onToggleRows={rowSelection.toggleRows}
            />
            <EmployeeSalesRowCard
              rows={pagedRows}
              selectedRowIds={rowSelection.selectedRowIds}
              onSelect={setSelectedId}
              onToggleRow={rowSelection.toggleRow}
            />
          </ReportTableCard>
        }
        exportSurface={
          exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
            <EmployeeSalesExportSurface
              containerRef={exportReportRef}
              dateRange={`${t("report.reportDate")}: ${applied.dateFrom} - ${applied.dateTo}`}
              rows={exportHook.exportData?.rows ?? current?.user_reports ?? []}
              showSummary={summaryVisible}
              summary={exportHook.exportData?.summary ?? current?.summary ?? emptyEmployeeSalesSummary}
              title={exportHook.exportData?.reportName || reportTitle}
            />
          ) : undefined
        }
      />

      <EmployeeSalesDetailSheet
        row={selected}
        language={language}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </>
  );
}
