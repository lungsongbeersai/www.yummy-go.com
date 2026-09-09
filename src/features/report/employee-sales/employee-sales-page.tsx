// src/features/report/employee-sales/employee-sales-page.tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { businessDateInputValue, money } from "@/lib/format";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useEmployeeSalesReportStore } from "@/stores/report-store";
import { EmployeeSalesDetailSheet } from "./employee-sales-detail-sheet";
import { EmployeeSalesFilterSheet, type EmployeeSalesDraft } from "./employee-sales-filter-sheet";
import { EmployeeSalesRowCard } from "./employee-sales-row-card";
import { EmployeeSalesSkeleton } from "./employee-sales-skeleton";
import { EmployeeSalesTable } from "./employee-sales-table";
import { EmployeeSalesToolbar } from "./employee-sales-toolbar";
import { activeEmployeeSalesFilterCount } from "./employee-sales-utils";

export function EmployeeSalesPage() {
  const user = useAuthStore(state => state.user);
  return <EmployeeSalesReport key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function isValidDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

function EmployeeSalesReport() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const scope = useReportBranchSelection();
  const { load, reset, loading, error, report } = useEmployeeSalesReportStore();
  const today = businessDateInputValue();
  const [draft, setDraft] = useState<EmployeeSalesDraft>(() => ({
    branchUuid: scope.defaultBranchUuid, loginUuid: "", dateFrom: today, dateTo: today,
  }));
  const [applied, setApplied] = useState(draft);
  const [orderBy, setOrderBy] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const branchUuid = scope.normalizeBranchFilters(applied).branchUuid;
  const draftBranch = scope.normalizeBranchFilters(draft).branchUuid;
  const dateRangeValid = isValidDateRange(draft.dateFrom, draft.dateTo);
  const valid = Boolean(draftBranch) && dateRangeValid;

  useEffect(() => {
    if (!branchUuid) return;
    void load({
      branch_uuid_fk: branchUuid, login_uuid: applied.loginUuid || undefined,
      date_from: applied.dateFrom, date_to: applied.dateTo, lang: language, orderBy,
    }).catch(() => undefined);
    return reset;
  }, [load, reset, branchUuid, applied.loginUuid, applied.dateFrom, applied.dateTo, orderBy, language, refreshToken]);

  const current = report?.filters.branch_uuid_fk === branchUuid &&
    report.filters.date_from === applied.dateFrom && report.filters.date_to === applied.dateTo ? report : null;
  const selected = current?.user_reports.find(row => row.login_uuid === selectedId) ?? null;
  const filterCount = activeEmployeeSalesFilterCount({ dateFrom: applied.dateFrom, dateTo: applied.dateTo, loginUuid: applied.loginUuid }, today);

  function apply() {
    if (!valid) return;
    setSelectedId(null);
    setApplied({ ...draft, branchUuid: draftBranch });
    setFilterSheetOpen(false);
  }

  function refresh() {
    setSelectedId(null);
    setRefreshToken(previous => previous + 1);
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background font-lao">
      <header className="flex shrink-0 flex-col gap-2 border-b p-3 md:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">{t("employeeSales.title")}</h1>
          <p className="text-sm text-muted-foreground">{scope.branchLabelFor(branchUuid)}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("employeeSales.description")}</p>
        <EmployeeSalesToolbar
          filterCount={filterCount}
          onOpenFilters={() => setFilterSheetOpen(true)}
          onRefresh={refresh}
          onToggleOrderBy={() => setOrderBy(previous => (previous === "asc" ? "desc" : "asc"))}
          orderBy={orderBy}
          refreshDisabled={loading || !branchUuid}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 md:p-4">
        {(error || scope.branchError) && <Alert variant="destructive"><AlertDescription>{error || scope.branchError}</AlertDescription></Alert>}
        {loading ? <EmployeeSalesSkeleton /> : current ? <>
          <p className="text-sm text-muted-foreground">
            {t("employeeSales.summaryLine", { employeeCount: current.summary.employee_count, billCount: current.summary.bill_count })}
            {" · "}{t("employeeSales.grandTotal")}: {money(current.summary.grand_total)}
          </p>
          {current.user_reports.length ? <>
            <EmployeeSalesTable rows={current.user_reports} onSelect={setSelectedId} />
            <EmployeeSalesRowCard rows={current.user_reports} onSelect={setSelectedId} />
          </> : <EmptyState title={t("employeeSales.empty")} description={t("employeeSales.emptyDescription")} />}
        </> : null}
      </div>

      <EmployeeSalesFilterSheet
        open={filterSheetOpen}
        onOpenChange={open => { if (!open) setDraft(applied); setFilterSheetOpen(open); }}
        draft={draft}
        draftBranch={draftBranch}
        onDraftChange={setDraft}
        branchLoading={scope.branchLoading}
        branchLocked={!scope.canSelectBranch}
        branchOptions={scope.branchOptions}
        valid={valid}
        dateRangeInvalid={!dateRangeValid}
        onApply={apply}
      />

      <EmployeeSalesDetailSheet
        row={selected}
        language={language}
        onOpenChange={open => { if (!open) setSelectedId(null); }}
      />
    </section>
  );
}
