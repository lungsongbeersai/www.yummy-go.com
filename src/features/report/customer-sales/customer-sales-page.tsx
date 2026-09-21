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
import { PAGE_LIMIT_OPTIONS, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerSalesReportStore } from "@/stores/report-store";
import type { CustomerSalesRow } from "@/services/report";
import { CustomerSalesDetailDialog } from "./customer-sales-detail-dialog";
import { CustomerSalesExportSurface } from "./customer-sales-components";
import { customerSalesRowId, emptyCustomerSalesSummary } from "./customer-sales-excel";
import { CustomerSalesFilterBar, CustomerSalesFilterSheet, type CustomerSalesDraft } from "./customer-sales-filter";
import { CustomerSalesRowCard, CustomerSalesTable } from "./customer-sales-table";
import { customerSalesSummaryMetricConfigs, customerSalesToday, validCustomerSalesDateRange } from "./customer-sales-utils";
import { useCustomerSalesExport } from "./use-customer-sales-export";

const SUMMARY_ID = "customer-sales-summary";
// อ้างอิงเดิมทุกครั้งตอนยังไม่มีข้อมูล — ป้องกัน useReportRowSelection มองว่า "rows" เปลี่ยนทุก
// render (อาร์เรย์ [] ใหม่ทุกครั้ง) แล้ว reset ค่าเลือกไว้วนไม่รู้จบ (useResetOnChange เทียบด้วย reference)
const EMPTY_ROWS: CustomerSalesRow[] = [];

export function CustomerSalesPage() {
  const user = useAuthStore(state => state.user);
  return <CustomerSalesReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function CustomerSalesReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useCustomerSalesReportStore();
  const today = customerSalesToday();
  const [draft, setDraft] = useState<CustomerSalesDraft>(() => ({
    branchUuid: scope.defaultBranchUuid, customerUuid: "", customerLabel: "",
    dateFrom: today, dateTo: today, search: "", orderBy: "DESC",
  }));
  const [applied, setApplied] = useState(draft);
  const [selectedLimit] = useState(PAGE_LIMIT_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = validCustomerSalesDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      branch_uuid_fk: branchUuid, customer_uuid: applied.customerUuid || undefined, search: applied.search,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy: applied.orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.customerUuid, applied.search, applied.dateFrom, applied.dateTo, applied.orderBy, language, refreshToken]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const rows = current?.customer_reports ?? EMPTY_ROWS;
  // API ไม่รองรับ page/limit — โหลดทั้งหมดครั้งเดียวแล้วแบ่งหน้าฝั่งเว็บเอง (แบบเดียวกับ employee-sales/vat)
  const pageSize = pageLimitSize(selectedLimit, rows.length);
  const totalPages = pageTotalPages(0, rows.length, pageSize);
  const pageStart = (page - 1) * pageSize;
  const pagedRows = rows.slice(pageStart, pageStart + pageSize);
  const range = pageRange(pagedRows.length, page, pageSize);
  const selected = current?.customer_reports.find(row => row.customer_uuid === selectedId) ?? null;
  const summaryCards = current ? customerSalesSummaryMetricConfigs(t).map(metric => ({
    ...metric, value: current.summary[metric.key as keyof typeof current.summary],
  })) : [];
  const reportTitle = t("report.customerSales.title");
  const branchLabel = scope.branchLabelFor(branchUuid);
  const exportReportRef = useRef<HTMLDivElement>(null);
  const rowSelection = useReportRowSelection({ getRowId: customerSalesRowId, rows });
  const exportHook = useCustomerSalesExport({
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
    language,
    onDraftChange: setDraft,
  };

  return (
    <>
      <ReportPageShell
        accessibleTitle={t("report.customerSales.title")}
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
          <CustomerSalesFilterBar
            actions={actions}
            canApply={valid}
            loading={loading}
            onApply={apply}
            {...filterFieldProps}
          />
        )}
        filterSheet={
          <CustomerSalesFilterSheet
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
            emptyTitle={t("report.customerSales.empty")}
            emptyDescription={t("report.customerSales.emptyDescription")}
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
            <CustomerSalesTable
              rows={pagedRows}
              selectedRowIds={rowSelection.selectedRowIds}
              onSelect={setSelectedId}
              onToggleRow={rowSelection.toggleRow}
              onToggleRows={rowSelection.toggleRows}
            />
            <CustomerSalesRowCard
              rows={pagedRows}
              selectedRowIds={rowSelection.selectedRowIds}
              onSelect={setSelectedId}
              onToggleRow={rowSelection.toggleRow}
            />
          </ReportTableCard>
        }
        exportSurface={
          exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
            <CustomerSalesExportSurface
              containerRef={exportReportRef}
              dateRange={`${t("report.reportDate")}: ${applied.dateFrom} - ${applied.dateTo}`}
              rows={exportHook.exportData?.rows ?? current?.customer_reports ?? EMPTY_ROWS}
              showSummary={summaryVisible}
              summary={exportHook.exportData?.summary ?? current?.summary ?? emptyCustomerSalesSummary}
              title={exportHook.exportData?.reportName || reportTitle}
            />
          ) : undefined
        }
      />

      <CustomerSalesDetailDialog
        row={selected}
        language={language}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </>
  );
}
