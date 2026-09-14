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
import { useCustomerSalesReportStore } from "@/stores/report-store";
import { CustomerSalesDetailDialog } from "./customer-sales-detail-dialog";
import { CustomerSalesFilterBar, CustomerSalesFilterSheet, type CustomerSalesDraft } from "./customer-sales-filter";
import { CustomerSalesRowCard, CustomerSalesTable } from "./customer-sales-table";
import { customerSalesSummaryMetricConfigs, customerSalesToday, validCustomerSalesDateRange } from "./customer-sales-utils";

const SUMMARY_ID = "customer-sales-summary";

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
  const rows = current?.customer_reports ?? [];
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
        exporting={false}
        exportingTitle=""
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
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
            {current ? <>
              {pagedRows.length ? <>
                <CustomerSalesTable rows={pagedRows} onSelect={setSelectedId} />
                <CustomerSalesRowCard rows={pagedRows} onSelect={setSelectedId} />
                <AppPagination
                  page={page}
                  totalPages={totalPages}
                  rangeLabel={t("common.showingRange", { start: range.start, end: range.end, total: rows.length })}
                  onPageChange={setPage}
                />
              </> : <EmptyState title={t("report.customerSales.empty")} description={t("report.customerSales.emptyDescription")} />}
            </> : null}
          </div>
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
