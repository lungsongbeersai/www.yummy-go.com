"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ORDER_AUDIT_ACTIONS } from "@/config/order-audit";
import { OrderAuditDetailSheet } from "@/features/report/order-audit/order-audit-detail-sheet";
import { OrderAuditFilterSheet, type OrderAuditDraft } from "@/features/report/order-audit/order-audit-filter-sheet";
import { OrderAuditRowCard } from "@/features/report/order-audit/order-audit-row-card";
import { OrderAuditSkeleton } from "@/features/report/order-audit/order-audit-skeleton";
import { OrderAuditTable } from "@/features/report/order-audit/order-audit-table";
import { OrderAuditToolbar } from "@/features/report/order-audit/order-audit-toolbar";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useOrderAuditReportStore } from "@/stores/report-store";
import { activeAuditFilterCount, auditToday, validAuditDateRange } from "./order-audit-utils";

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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
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
  const filterCount = activeAuditFilterCount(applied, auditToday());

  function apply() {
    if (!valid) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setPaging(previous => ({ page: 1, snapshot: "", refresh: previous.refresh + 1, scope: draftBranch }));
    setFilterSheetOpen(false);
  }

  function refresh() {
    setSelectedId(null);
    setPaging(previous => ({ ...previous, page: 1, snapshot: "", refresh: previous.refresh + 1, scope: branchUuid }));
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background font-lao">
      <header className="flex shrink-0 flex-col gap-2 border-b p-3 md:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("orderAudit.title")}</h1>
          <p className="text-sm text-muted-foreground">{scope.branchLabelFor(branchUuid)}</p>
        </div>
        <OrderAuditToolbar
          search={draft.search}
          onSearchChange={search => setDraft(previous => ({ ...previous, search }))}
          onSubmit={apply}
          filterCount={filterCount}
          onOpenFilters={() => setFilterSheetOpen(true)}
          onRefresh={refresh}
          refreshDisabled={loading || !branchUuid}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
        <Alert><AlertDescription>{t("orderAudit.historyNotice")}</AlertDescription></Alert>
        {(error || scope.branchError) && <Alert variant="destructive"><AlertDescription>{error || scope.branchError}</AlertDescription></Alert>}
        {loading ? <OrderAuditSkeleton /> : current ? <>
          <p className="text-sm text-muted-foreground">{t("orderAudit.summary", current.summary)}</p>
          {current.rows.length ? <>
            <OrderAuditTable rows={current.rows} language={language} onSelect={setSelectedId} />
            <OrderAuditRowCard rows={current.rows} language={language} onSelect={setSelectedId} />
          </> : <EmptyState title={t("orderAudit.empty")} description={t("orderAudit.emptyDescription")} />}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm">{t("orderAudit.page", { page: current.pagination.page, total: current.pagination.total_pages })}</span>
            <Button variant="outline" disabled={current.pagination.page <= 1} onClick={() => {
              setSelectedId(null); setPaging(previous => ({ ...previous, page: current.pagination.page - 1, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
            }}>{t("orderAudit.previous")}</Button>
            <Button variant="outline" disabled={current.pagination.page >= current.pagination.total_pages} onClick={() => {
              setSelectedId(null); setPaging(previous => ({ ...previous, page: current.pagination.page + 1, snapshot: current.pagination.snapshot_id, scope: branchUuid }));
            }}>{t("orderAudit.next")}</Button>
          </div>
        </> : null}
      </div>

      <OrderAuditFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        draft={draft}
        draftBranch={draftBranch}
        onDraftChange={setDraft}
        branchLoading={scope.branchLoading}
        branchLocked={!scope.canSelectBranch}
        branchOptions={scope.branchOptions}
        actionOptions={actionOptions}
        entityOptions={entityOptions}
        valid={valid}
        dateRangeInvalid={!dateRangeValid}
        onApply={apply}
      />

      <OrderAuditDetailSheet
        row={selected}
        language={language}
        branchLabel={scope.branchLabelFor(branchUuid)}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </section>
  );
}
