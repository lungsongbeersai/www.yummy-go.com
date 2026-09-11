"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { PAGE_LIMIT_OPTIONS, pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import { ReportPageShell } from "@/features/report/shared/report-page-shell";
import { ReportSummaryCardsGrid } from "@/features/report/shared/report-metric-display";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useVatReportStore } from "@/stores/report-store";
import { VatReportFilterBar, VatReportFilterSheet, type VatReportDraft } from "./vat-report-filter";
import { VatReportRowCard, VatReportTable } from "./vat-report-table";
import { validVatDateRange, vatReportToday, vatSummaryMetricConfigs } from "./vat-report-utils";

const SUMMARY_ID = "vat-report-summary";

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

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      branch_uuid_fk: branchUuid, search: applied.search,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy: applied.orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.search, applied.dateFrom, applied.dateTo, applied.orderBy, language, refreshToken]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const rows = current?.vat_rows ?? [];
  // API ไม่รองรับ page/limit — โหลดทั้งหมดครั้งเดียวแล้วแบ่งหน้าฝั่งเว็บเอง (แบบเดียวกับ employee-sales)
  const pageSize = pageLimitSize(selectedLimit, rows.length);
  const totalPages = pageTotalPages(0, rows.length, pageSize);
  const pageStart = (page - 1) * pageSize;
  const pagedRows = rows.slice(pageStart, pageStart + pageSize);
  const range = pageRange(pagedRows.length, page, pageSize);
  const summaryCards = current ? vatSummaryMetricConfigs(t).map(metric => ({
    ...metric, value: current.summary[metric.key as keyof typeof current.summary],
  })) : [];

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
    onDraftChange: setDraft,
  };

  return (
    <ReportPageShell
      accessibleTitle={t("report.vat.title")}
      variant="compact"
      dateFrom={applied.dateFrom}
      dateTo={applied.dateTo}
      loading={loading}
      exporting={false}
      exportingTitle=""
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
          {current ? <>
            {pagedRows.length ? <>
              <VatReportTable rows={pagedRows} language={language} />
              <VatReportRowCard rows={pagedRows} language={language} />
              <AppPagination
                page={page}
                totalPages={totalPages}
                rangeLabel={t("common.showingRange", { start: range.start, end: range.end, total: rows.length })}
                onPageChange={setPage}
              />
            </> : <EmptyState title={t("report.vat.empty")} description={t("report.vat.emptyDescription")} />}
          </> : null}
        </div>
      }
    />
  );
}
