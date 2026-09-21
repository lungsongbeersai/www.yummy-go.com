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
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useZoneSalesReportStore } from "@/stores/report-store";
import type { ZoneSalesRow } from "@/services/report";
import { ZoneSalesExportSurface } from "./zone-sales-components";
import { emptyZoneSalesSummary, zoneSalesRowId } from "./zone-sales-excel";
import { ZoneSalesFilterBar, ZoneSalesFilterSheet, type ZoneSalesDraft } from "./zone-sales-filter";
import { ZoneSalesRowCard, ZoneSalesTable } from "./zone-sales-table";
import { validZoneSalesDateRange, zoneSalesSummaryMetricConfigs, zoneSalesToday } from "./zone-sales-utils";
import { useZoneSalesExport } from "./use-zone-sales-export";

const SUMMARY_ID = "zone-sales-summary";
// อ้างอิงเดิมทุกครั้งตอนยังไม่มีข้อมูล — ป้องกัน useReportRowSelection มองว่า "rows" เปลี่ยนทุก
// render (อาร์เรย์ [] ใหม่ทุกครั้ง) แล้ว reset ค่าเลือกไว้วนไม่รู้จบ (useResetOnChange เทียบด้วย reference)
const EMPTY_ROWS: ZoneSalesRow[] = [];

export function ZoneSalesPage() {
  const user = useAuthStore(state => state.user);
  return <ZoneSalesReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function ZoneSalesReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useZoneSalesReportStore();
  const today = zoneSalesToday();
  const [draft, setDraft] = useState<ZoneSalesDraft>(() => ({
    branchUuid: scope.defaultBranchUuid, zoneUuid: "all", dateFrom: today, dateTo: today,
  }));
  const [applied, setApplied] = useState(draft);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = validZoneSalesDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      branch_uuid_fk: branchUuid, zone_uuid_fk: applied.zoneUuid === "all" ? undefined : applied.zoneUuid,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.zoneUuid, applied.dateFrom, applied.dateTo, language, refreshToken]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const rows = current?.zone_reports ?? EMPTY_ROWS;
  const summaryCards = current ? zoneSalesSummaryMetricConfigs(t).map(metric => ({
    ...metric, value: current.summary[metric.key as keyof typeof current.summary],
  })) : [];
  const reportTitle = t("report.zoneSales.title");
  const branchLabel = scope.branchLabelFor(branchUuid);
  const exportReportRef = useRef<HTMLDivElement>(null);
  const rowSelection = useReportRowSelection({ getRowId: zoneSalesRowId, rows });
  const exportHook = useZoneSalesExport({
    branchLabel,
    current,
    dateFrom: applied.dateFrom,
    dateTo: applied.dateTo,
    exportReportRef,
    language,
    loading,
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
    setMobileFilterOpen(false);
  }

  function refresh() {
    setRefreshToken(previous => previous + 1);
  }

  const filterFieldProps = {
    branchLoading: scope.branchLoading,
    branchLocked: !scope.canSelectBranch,
    branchOptions: scope.branchOptions,
    draft,
    draftBranch,
    language,
    onDraftChange: setDraft,
  };

  return (
    <ReportPageShell
      accessibleTitle={t("report.zoneSales.title")}
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
        <ZoneSalesFilterBar
          actions={actions}
          canApply={valid}
          loading={loading}
          onApply={apply}
          {...filterFieldProps}
        />
      )}
      filterSheet={
        <ZoneSalesFilterSheet
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
            gridClassName="sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7"
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
          emptyTitle={t("report.zoneSales.empty")}
          emptyDescription={t("report.zoneSales.emptyDescription")}
          loading={loading}
          rowsLength={rows.length}
          selectedCount={rowSelection.selectedCount}
          exportDisabled={exportHook.exportDisabled}
          exporting={exportHook.exporting}
          footer={
            <AppPagination
              page={1}
              totalPages={1}
              rangeLabel={t("common.showingRange", { start: rows.length ? 1 : 0, end: rows.length, total: rows.length })}
              onPageChange={() => undefined}
            />
          }
          onClearSelection={rowSelection.clearSelection}
          onExportExcel={() => void exportHook.exportExcel()}
          onExportPdf={() => void exportHook.exportPdf()}
          onExportPrint={() => void exportHook.printReport()}
        >
          {current ? (
            <ZoneSalesTable
              rows={rows}
              summary={current.summary}
              language={language}
              selectedRowIds={rowSelection.selectedRowIds}
              onToggleRow={rowSelection.toggleRow}
              onToggleRows={rowSelection.toggleRows}
            />
          ) : null}
          <ZoneSalesRowCard
            rows={rows}
            language={language}
            selectedRowIds={rowSelection.selectedRowIds}
            onToggleRow={rowSelection.toggleRow}
          />
        </ReportTableCard>
      }
      exportSurface={
        exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
          <ZoneSalesExportSurface
            containerRef={exportReportRef}
            dateRange={`${t("report.reportDate")}: ${applied.dateFrom} - ${applied.dateTo}`}
            language={language}
            rows={exportHook.exportData?.rows ?? current?.zone_reports ?? EMPTY_ROWS}
            showSummary={summaryVisible}
            summary={exportHook.exportData?.summary ?? current?.summary ?? emptyZoneSalesSummary}
            title={exportHook.exportData?.reportName || reportTitle}
          />
        ) : undefined
      }
    />
  );
}
