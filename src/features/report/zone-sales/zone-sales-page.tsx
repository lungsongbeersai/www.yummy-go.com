"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { ReportPageShell } from "@/features/report/shared/report-page-shell";
import { ReportSummaryCardsGrid } from "@/features/report/shared/report-metric-display";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useZoneSalesReportStore } from "@/stores/report-store";
import { ZoneSalesFilterBar, ZoneSalesFilterSheet, type ZoneSalesDraft } from "./zone-sales-filter";
import { ZoneSalesRowCard, ZoneSalesTable } from "./zone-sales-table";
import { validZoneSalesDateRange, zoneSalesSummaryMetricConfigs, zoneSalesToday } from "./zone-sales-utils";

const SUMMARY_ID = "zone-sales-summary";

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
  const rows = current?.zone_reports ?? [];
  const summaryCards = current ? zoneSalesSummaryMetricConfigs(t).map(metric => ({
    ...metric, value: current.summary[metric.key as keyof typeof current.summary],
  })) : [];

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
      exporting={false}
      exportingTitle=""
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
          {current ? (
            rows.length ? <>
              <ZoneSalesTable rows={rows} summary={current.summary} language={language} />
              <ZoneSalesRowCard rows={rows} language={language} />
            </> : <EmptyState title={t("report.zoneSales.empty")} description={t("report.zoneSales.emptyDescription")} />
          ) : null}
        </div>
      }
    />
  );
}
