"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { LoadingState } from "@/components/common/loading-state";
import { ReportPageShell } from "@/features/report/shared/report-page-shell";
import { ReportSummaryCardsGrid } from "@/features/report/shared/report-metric-display";
import { useReportRowSelection } from "@/features/report/shared/report-row-selection";
import { ReportTableCard } from "@/features/report/shared/report-table-card";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { reportLocationParams } from "@/features/report/shared/report-location";
import { useReportLocationOptions } from "@/features/report/shared/use-report-location-options";
import { PAGE_LIMIT_OPTIONS, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useVatReportStore } from "@/stores/report-store";
import type { VatReportRow } from "@/services/report";
import { VatReportFilterBar, VatReportFilterSheet, type VatReportDraft } from "./vat-report-filter";
import { emptyVatSummary, vatRowId } from "./vat-report-excel";
import { VatExportSurface } from "./vat-report-components";
import { VatReportRowCard, VatReportTable } from "./vat-report-table";
import { validVatDateRange, vatReportToday, vatSummaryMetricConfigs } from "./vat-report-utils";
import { useVatReportExport } from "./use-vat-report-export";

const SUMMARY_ID = "vat-report-summary";
// อ้างอิงเดิมทุกครั้งตอนยังไม่มีข้อมูล — ป้องกัน useReportRowSelection มองว่า "rows" เปลี่ยนทุก
// render (อาร์เรย์ [] ใหม่ทุกครั้ง) แล้ว reset ค่าเลือกไว้วนไม่รู้จบ (useResetOnChange เทียบด้วย reference)
const EMPTY_ROWS: VatReportRow[] = [];

export function VatReportPage() {
  const user = useAuthStore(state => state.user);
  return <VatReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function VatReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useVatReportStore();
  const today = vatReportToday();
  const [draft, setDraft] = useState<VatReportDraft>(() => ({
    branchUuid: scope.defaultBranchUuid, dateFrom: today, dateTo: today, search: "", orderBy: "DESC",
    tableUuid: "all", zoneUuid: "all",
  }));
  const [applied, setApplied] = useState(draft);
  const [selectedLimit] = useState(PAGE_LIMIT_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = validVatDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;
  const locationOptions = useReportLocationOptions(draftBranch, draft.zoneUuid, language);

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      ...reportLocationParams({ tableUuid: applied.tableUuid, zoneUuid: applied.zoneUuid }),
      branch_uuid_fk: branchUuid, search: applied.search,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy: applied.orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.search, applied.dateFrom, applied.dateTo, applied.orderBy, applied.tableUuid, applied.zoneUuid, language, refreshToken]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const rows = current?.vat_rows ?? EMPTY_ROWS;
  // API ไม่รองรับ page/limit — โหลดทั้งหมดครั้งเดียวแล้วแบ่งหน้าฝั่งเว็บเอง (แบบเดียวกับ employee-sales)
  const pageSize = pageLimitSize(selectedLimit, rows.length);
  const totalPages = pageTotalPages(0, rows.length, pageSize);
  const pageStart = (page - 1) * pageSize;
  const pagedRows = rows.slice(pageStart, pageStart + pageSize);
  const range = pageRange(pagedRows.length, page, pageSize);
  const summaryCards = current ? vatSummaryMetricConfigs(t).map(metric => ({
    ...metric, value: current.summary[metric.key as keyof typeof current.summary],
  })) : [];
  const reportTitle = t("report.vat.title");
  const branchLabel = scope.branchLabelFor(branchUuid);
  const exportReportRef = useRef<HTMLDivElement>(null);
  const rowSelection = useReportRowSelection({ getRowId: vatRowId, rows });
  const exportHook = useVatReportExport({
    branchLabel,
    current,
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
    exportReportRef,
    language,
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
    setApplied({ ...draft, branchUuid: draftBranch });
    setPage(1);
    setMobileFilterOpen(false);
  }

  function refresh() {
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

  return (
    <ReportPageShell
      accessibleTitle={t("report.vat.title")}
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
        <VatReportFilterBar
          actions={actions}
          canApply={valid}
          loading={loading}
          onApply={apply}
          {...filterFieldProps}
        />
      )}
      filterSheet={
        <VatReportFilterSheet
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
      summary={
        current ? (
          <ReportSummaryCardsGrid
            cards={summaryCards}
            gridClassName="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
            cardClassName={() => "border-border bg-card"}
            labelClassName={() => "text-muted-foreground"}
            valueClassName={() => "font-black text-foreground"}
          />
        ) : null
      }
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
          renderLoading={() => <LoadingState label={t("common.loading")} variant="reportTable" />}
          emptyTitle={t("report.vat.empty")}
          emptyDescription={t("report.vat.emptyDescription")}
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
          <VatReportTable
            rows={pagedRows}
            language={language}
            selectedRowIds={rowSelection.selectedRowIds}
            onToggleRow={rowSelection.toggleRow}
            onToggleRows={rowSelection.toggleRows}
          />
          <VatReportRowCard
            rows={pagedRows}
            language={language}
            selectedRowIds={rowSelection.selectedRowIds}
            onToggleRow={rowSelection.toggleRow}
          />
        </ReportTableCard>
      }
      exportSurface={
        exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
          <VatExportSurface
            containerRef={exportReportRef}
            dateRange={`${t("report.reportDate")}: ${applied.dateFrom} - ${applied.dateTo}`}
            language={language}
            rows={exportHook.exportData?.rows ?? current?.vat_rows ?? EMPTY_ROWS}
            showSummary={summaryVisible}
            summary={exportHook.exportData?.summary ?? current?.summary ?? emptyVatSummary}
            title={exportHook.exportData?.reportName || reportTitle}
          />
        ) : undefined
      }
    />
  );
}
