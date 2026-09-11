"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ORDER_AUDIT_ACTIONS } from "@/config/order-audit";
import { OrderAuditDetailSheet } from "@/features/report/order-audit/order-audit-detail-sheet";
import { OrderAuditFilterBar, OrderAuditFilterSheet, type OrderAuditDraft } from "@/features/report/order-audit/order-audit-filter-sheet";
import { OrderAuditRowCard } from "@/features/report/order-audit/order-audit-row-card";
import { OrderAuditSkeleton } from "@/features/report/order-audit/order-audit-skeleton";
import { OrderAuditTable } from "@/features/report/order-audit/order-audit-table";
import { ReportPageShell } from "@/features/report/shared/report-page-shell";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOrderAuditReportStore } from "@/stores/report-store";
import { auditToday, validAuditDateRange } from "./order-audit-utils";

const SUMMARY_ID = "order-audit-summary";

export function OrderAuditPage() {
  const user = useAuthStore(state => state.user);
  // Recreate filter/detail state when the authenticated store, branch or role changes.
  return <OrderAuditReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function OrderAuditReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useOrderAuditReportStore();
  const [draft, setDraft] = useState<OrderAuditDraft>(() => ({
    branchUuid: scope.defaultBranchUuid,
    dateFrom: auditToday(), dateTo: auditToday(), search: "", action: "all", entity: "all",
  }));
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, snapshot: "", refresh: 0, scope: scope.defaultBranchUuid });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = validAuditDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({ branch_uuid_fk: branchUuid, date_from: applied.dateFrom, date_to: applied.dateTo,
      search: applied.search, action: applied.action === "all" ? "" : applied.action,
      entity_type: applied.entity === "all" ? "" : applied.entity,
      page: paging.scope === branchUuid ? paging.page : 1, limit: 20,
      snapshot_id: paging.scope === branchUuid ? paging.snapshot || undefined : undefined,
      lang: language }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.dateFrom, applied.dateTo, applied.search,
    applied.action, applied.entity, paging.page, paging.snapshot, paging.refresh, paging.scope, language]);

  // Do not expose stale details from another scope while a replacement request starts.
  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo &&
    report.rows.every(row => row.store_uuid_fk === scope.storeUuid) ? report : null;
  const selected = current?.rows.find(row => row.audit_id === selectedId) ?? null;
  const actionOptions = [{ value: "all", label: t("orderAudit.all") },
    ...ORDER_AUDIT_ACTIONS.map(value => ({ value, label: t(`orderAudit.actions.${value}`) }))];
  const entityOptions = [{ value: "all", label: t("orderAudit.all") },
    ...["ORDER", "ITEM", "TOPPING", "PAYMENT"].map(value => ({ value, label: t(`orderAudit.entities.${value}`) }))];

  function apply() {
    if (!valid || loading) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setPaging(previous => ({ page: 1, snapshot: "", refresh: previous.refresh + 1, scope: draftBranch }));
    setMobileFilterOpen(false);
  }

  function refresh() {
    setSelectedId(null);
    setPaging(previous => ({ ...previous, page: 1, snapshot: "", refresh: previous.refresh + 1, scope: branchUuid }));
  }

  const filterFieldProps = {
    branchLoading: scope.branchLoading,
    branchLocked: !scope.canSelectBranch,
    branchOptions: scope.branchOptions,
    actionOptions,
    entityOptions,
    draft,
    draftBranch,
    onDraftChange: setDraft,
  };

  return (
    <>
      <ReportPageShell
        accessibleTitle={t("orderAudit.title")}
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
          <OrderAuditFilterBar
            actions={actions}
            canApply={valid}
            loading={loading}
            onApply={apply}
            {...filterFieldProps}
          />
        )}
        filterSheet={
          <OrderAuditFilterSheet
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
          <div className="flex flex-col gap-2">
            <Alert><AlertDescription>{t("orderAudit.historyNotice")}</AlertDescription></Alert>
            {current ? <p className="text-sm text-muted-foreground">{t("orderAudit.summary", current.summary)}</p> : null}
          </div>
        }
        onOpenFilters={() => setMobileFilterOpen(true)}
        onRefresh={refresh}
        table={
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
            {loading ? <OrderAuditSkeleton /> : current ? <>
              {current.rows.length ? <>
                <OrderAuditTable rows={current.rows} language={language} onSelect={setSelectedId} />
                <OrderAuditRowCard rows={current.rows} language={language} onSelect={setSelectedId} />
              </> : <EmptyState title={t("orderAudit.empty")} description={t("orderAudit.emptyDescription")} />}
              <AppPagination
                page={current.pagination.page}
                totalPages={current.pagination.total_pages}
                rangeLabel={t("common.showingRange", {
                  start: (current.pagination.page - 1) * current.pagination.limit + 1,
                  end: Math.min(current.pagination.page * current.pagination.limit, current.pagination.total),
                  total: current.pagination.total,
                })}
                onPageChange={targetPage => {
                  setSelectedId(null);
                  setPaging(previous => ({ ...previous, page: targetPage, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
                }}
              />
            </> : null}
          </div>
        }
      />

      <OrderAuditDetailSheet
        row={selected}
        language={language}
        branchLabel={scope.branchLabelFor(branchUuid)}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </>
  );
}
