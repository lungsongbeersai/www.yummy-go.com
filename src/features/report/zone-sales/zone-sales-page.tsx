"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HandPlatter, Landmark, MapPin, ReceiptText, TrendingUp, Users, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { money } from "@/lib/format";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useZoneSalesReportStore } from "@/stores/report-store";
import type { ZoneSalesRow } from "@/services/report";
import { ZoneSalesExportSurface } from "./zone-sales-components";
import { emptyZoneSalesSummary, zoneSalesRowId } from "./zone-sales-excel";
import { ZoneSalesFilterBar, ZoneSalesFilterSheet, type ZoneSalesDraft } from "./zone-sales-filter";
import { ZoneSalesRowCard, ZoneSalesTable, zoneSalesColumnOptions } from "./zone-sales-table";
import { validZoneSalesDateRange, zoneSalesToday } from "./zone-sales-utils";
import { useZoneSalesExport } from "./use-zone-sales-export";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

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
  // การ์ดสรุปซ่อนไว้ก่อน — ผู้ใช้กดปุ่ม "แสดงสรุป" เองเมื่ออยากดู
  const [summaryVisible, setSummaryVisible] = useState(false);
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
  const reportTitle = t("report.zoneSales.title");
  const branchLabel = scope.branchLabelFor(branchUuid);
  const exportReportRef = useRef<HTMLDivElement>(null);
  const rowSelection = useReportRowSelection({ getRowId: zoneSalesRowId, rows });
  const columnOptions = useMemo(() => zoneSalesColumnOptions(t), [t]);
  const columns = useReportColumnVisibility("zone-sales", columnOptions);
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

  const summary = current?.summary ?? null;
  const controlsDisabled = loading || Boolean(exportHook.exporting);
  const errors = [!branchUuid ? t("report.branchRequired") : null, scope.branchError, error].filter(
    (message): message is string => Boolean(message),
  );
  const refreshButton = <ReportRefreshButton disabled={controlsDisabled} loading={loading} onRefresh={refresh} />;

  return (
    <>
      {/* ตารางมีไม่กี่แถว (จำนวนโซน) แต่มีการ์ดสรุป 8 ใบ — สกรอลทั้งหน้าแทนการล็อกความสูง
          ไม่งั้นการ์ดกินพื้นที่จนตารางเหลือนิดเดียว (แบบเดียวกับ payment-methods) */}
      <ReportPage pageScroll title={reportTitle}>
        <ReportMobileFilterBar
          dateFrom={applied.dateFrom}
          dateTo={applied.dateTo}
          disabled={controlsDisabled}
          refreshButton={refreshButton}
          onOpenFilters={() => setMobileFilterOpen(true)}
        />
        <ZoneSalesFilterBar actions={refreshButton} canApply={valid} loading={loading} onApply={apply} {...filterFieldProps} />
        <ZoneSalesFilterSheet
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

        {/* ยอดรวมเป็นใบ highlight กว้าง 2 ช่อง + อีก 6 ใบ = 2 แถวเต็ม (4 คอลัมน์) */}
        {summaryVisible && summary ? (
          <ReportStatCards
            id={SUMMARY_ID}
            stats={[
              { icon: TrendingUp, key: "grand_total", label: t("report.zoneSales.columns.grandTotal"), span: true, tone: "highlight", value: money(summary.grand_total) },
              { icon: MapPin, key: "zones", label: t("report.zoneSales.columns.zoneCount"), tone: "info", value: summary.zone_count.toLocaleString("en-US") },
              { icon: ReceiptText, key: "bills", label: t("report.zoneSales.columns.billCount"), tone: "info", value: summary.bill_count.toLocaleString("en-US") },
              { icon: Users, key: "customers", label: t("report.zoneSales.columns.customerCount"), tone: "info", value: summary.customer_count.toLocaleString("en-US") },
              { icon: Wallet, key: "net_sale", label: t("report.zoneSales.columns.netSale"), tone: "success", value: money(summary.net_sale) },
              { icon: HandPlatter, key: "service_charge", label: t("report.zoneSales.columns.serviceCharge"), tone: "primary", value: money(summary.service_charge) },
              { icon: Landmark, key: "vat", label: t("report.zoneSales.columns.vat"), tone: "warning", value: money(summary.vat) },
            ]}
          />
        ) : null}

        {loading && !rows.length ? (
          <ReportResultArea>
            <LoadingState label={t("common.loading")} variant="reportTable" />
          </ReportResultArea>
        ) : rows.length && current ? (
          <>
            <ReportResultArea framed fill={false} busy={loading} className="hidden md:flex">
              <ZoneSalesTable
                isColumnVisible={columns.isVisible}
                pinning={columns.pinning}
                language={language}
                rows={rows}
                selectedRowIds={rowSelection.selectedRowIds}
                summary={current.summary}
                onToggleRow={rowSelection.toggleRow}
                onToggleRows={rowSelection.toggleRows}
              />
            </ReportResultArea>
            <div className="md:hidden">
              <ZoneSalesRowCard
                language={language}
                rows={rows}
                selectedRowIds={rowSelection.selectedRowIds}
                total={current.summary.grand_total}
                onToggleRow={rowSelection.toggleRow}
              />
            </div>
            {/* API ส่งทุกโซนมาครั้งเดียว ไม่มีการแบ่งหน้า — เหลือแค่ป้ายบอกจำนวน */}
            <ReportPaginationBar>
              {/* Same style as the range label AppPagination renders on the other reports. */}
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                {t("common.showingRange", { start: 1, end: rows.length, total: rows.length })}
              </p>
            </ReportPaginationBar>
          </>
        ) : (
          <EmptyState title={t("report.zoneSales.empty")} description={t("report.zoneSales.emptyDescription")} />
        )}
      </ReportPage>

      {exportHook.exporting === "pdf" || exportHook.exporting === "print" ? (
        <ZoneSalesExportSurface
          containerRef={exportReportRef}
          dateRange={`${t("report.reportDate")}: ${formatReportDateRange(applied.dateFrom, applied.dateTo)}`}
          language={language}
          rows={exportHook.exportData?.rows ?? current?.zone_reports ?? EMPTY_ROWS}
          showSummary={summaryVisible}
          summary={exportHook.exportData?.summary ?? current?.summary ?? emptyZoneSalesSummary}
          title={exportHook.exportData?.reportName || reportTitle}
        />
      ) : null}
      <BlockingLoadingDialog open={Boolean(exportHook.exporting)} title={exportTitle} description={t("report.exportingDescription")} />
    </>
  );
}
