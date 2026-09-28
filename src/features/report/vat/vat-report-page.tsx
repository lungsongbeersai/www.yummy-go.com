"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, HandPlatter, Landmark, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
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
import { money } from "@/lib/format";
import { PAGE_LIMIT_OPTIONS, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useVatReportStore } from "@/stores/report-store";
import type { VatReportRow } from "@/services/report";
import { VatReportFilterBar, VatReportFilterSheet, type VatReportDraft } from "./vat-report-filter";
import { emptyVatSummary, vatRowId } from "./vat-report-excel";
import { VatExportSurface } from "./vat-report-components";
import { VatReportRowCard, VatReportTable, vatColumnOptions } from "./vat-report-table";
import { validVatDateRange, vatReportToday } from "./vat-report-utils";
import { useVatReportExport } from "./use-vat-report-export";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

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
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
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
  const reportTitle = t("report.vat.title");
  const branchLabel = scope.branchLabelFor(branchUuid);
  const exportReportRef = useRef<HTMLDivElement>(null);
  const rowSelection = useReportRowSelection({ getRowId: vatRowId, rows });
  const columnOptions = useMemo(() => vatColumnOptions(t), [t]);
  const columns = useReportColumnVisibility("vat", columnOptions);
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
        <VatReportFilterBar actions={refreshButton} canApply={valid} loading={loading} onApply={apply} {...filterFieldProps} />
        <VatReportFilterSheet
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

        {/* 6 ใบพอดี 2 แถว (3 คอลัมน์) — รายงาน VAT จึงให้ "ยอด VAT" เป็นใบ highlight แทนยอดรวม */}
        {summaryVisible && summary ? (
          <ReportStatCards
            id={SUMMARY_ID}
            className="lg:grid-cols-3"
            stats={[
              { icon: Landmark, key: "vat", label: t("report.vat.columns.vat"), tone: "highlight", value: money(summary.vat) },
              { icon: ReceiptText, key: "bills", label: t("report.vat.columns.billCount"), tone: "info", value: summary.bill_count.toLocaleString("en-US") },
              { icon: Wallet, key: "net_sale", label: t("report.vat.columns.netSale"), tone: "success", value: money(summary.net_sale) },
              { icon: HandPlatter, key: "service_charge", label: t("report.vat.columns.serviceCharge"), tone: "primary", value: money(summary.service_charge) },
              {
                icon: BadgePercent,
                key: "discount",
                label: t("report.vat.columns.discount"),
                negative: summary.discount_amount > 0,
                tone: "danger",
                value: money(summary.discount_amount),
              },
              { icon: TrendingUp, key: "grand_total", label: t("report.vat.columns.grandTotal"), tone: "success", value: money(summary.grand_total) },
            ]}
          />
        ) : null}

        {loading && !pagedRows.length ? (
          <ReportResultArea>
            <LoadingState label={t("common.loading")} variant="reportTable" />
          </ReportResultArea>
        ) : pagedRows.length ? (
          <>
            <ReportResultArea framed busy={loading} className="hidden md:flex">
              <VatReportTable
                isColumnVisible={columns.isVisible}
                rows={pagedRows}
                selectedRowIds={rowSelection.selectedRowIds}
                summary={summary}
                onToggleRow={rowSelection.toggleRow}
                onToggleRows={rowSelection.toggleRows}
              />
            </ReportResultArea>
            <div className="md:hidden">
              <VatReportRowCard
                rows={pagedRows}
                selectedRowIds={rowSelection.selectedRowIds}
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
          <EmptyState title={t("report.vat.empty")} description={t("report.vat.emptyDescription")} />
        )}
      </ReportPage>

      {exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
        <VatExportSurface
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(applied.dateFrom, applied.dateTo)}`}
          rows={exportHook.exportData?.rows ?? current?.vat_rows ?? EMPTY_ROWS}
          showSummary={summaryVisible}
          summary={exportHook.exportData?.summary ?? current?.summary ?? emptyVatSummary}
          title={exportHook.exportData?.reportName || reportTitle}
        />
      ) : null}
      <BlockingLoadingDialog open={Boolean(exportHook.exporting)} title={exportTitle} description={t("report.exportingDescription")} />
    </>
  );
}
