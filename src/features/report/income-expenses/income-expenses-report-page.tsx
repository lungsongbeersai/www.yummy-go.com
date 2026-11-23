"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Info, RefreshCcw, SlidersHorizontal, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { CashflowAccessDenied, CashflowSelectField, CashflowWorkspace } from "@/features/cashflow/cashflow-workspace";
import { validCashflowDateRange } from "@/features/cashflow/cashflow-ui-utils";
import { ReportDateRangeFields } from "@/features/report/shared/report-filter-fields";
import { ReportFilterSheet } from "@/features/report/shared/report-filter-shell";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { createReportWorkbook } from "@/lib/export/excel";
import { businessDateInputValue } from "@/lib/format";
import { canManageCashflow } from "@/lib/permissions";
import type { FetchCashflowReportParams } from "@/services/cashflow";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCashflowStore } from "@/stores/cashflow-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useToastStore } from "@/stores/toast-store";
import { cashflowReportWorksheets } from "./income-expenses-export";
import { CashflowReportResults } from "./income-expenses-results";

export function IncomeExpensesReportPage() {
  const status = useAuthStore((state) => state.user?.status);
  return canManageCashflow(status) ? <IncomeExpensesReport /> : <CashflowAccessDenied />;
}

function IncomeExpensesReport() {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const branch = useReportBranchSelection();
  const [selectedBranch, setSelectedBranch] = useState("");
  const branchUuid = branch.canSelectBranch && branch.branchOptions.some((option) => option.value === selectedBranch)
    ? selectedBranch : branch.defaultBranchUuid;
  const [dateFrom, setDateFrom] = useState(() => `${businessDateInputValue().slice(0, 7)}-01`);
  const [dateTo, setDateTo] = useState(() => businessDateInputValue());
  const [direction, setDirection] = useState<NonNullable<FetchCashflowReportParams["direction"]>>("all");
  const [source, setSource] = useState<NonNullable<FetchCashflowReportParams["source"]>>("all");
  const [expenseGroup, setExpenseGroup] = useState<NonNullable<FetchCashflowReportParams["expense_group"]>>("all");
  const [category, setCategory] = useState("all");
  const [categoryBranch, setCategoryBranch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useCashflowStore((state) => state.categories);
  const storeBranch = useCashflowStore((state) => state.branchUuid);
  const report = useCashflowStore((state) => state.report);
  const reportParams = useCashflowStore((state) => state.reportParams);
  const loading = useCashflowStore((state) => state.reportLoading);
  const reportError = useCashflowStore((state) => state.reportError);
  const loadReport = useCashflowStore((state) => state.loadReport);
  const loadCategories = useCashflowStore((state) => state.loadCategories);
  const showToast = useToastStore((state) => state.show);
  const validDates = validCashflowDateRange(dateFrom, dateTo);
  const effectiveCategory = categoryBranch === branchUuid ? category : "all";
  const params = useMemo<FetchCashflowReportParams>(() => ({
    branch_uuid: branchUuid, date_from: dateFrom, date_to: dateTo, direction, source,
    expense_group: expenseGroup, ...(effectiveCategory !== "all" ? { category_uuid_fk: effectiveCategory } : {}), lang: language,
  }), [branchUuid, dateFrom, dateTo, direction, source, expenseGroup, effectiveCategory, language]);
  const queryKey = JSON.stringify(params);
  const current = validDates && storeBranch === branchUuid && report?.branch_uuid.toLowerCase() === branchUuid.toLowerCase() && JSON.stringify(reportParams) === queryKey
    ? report : null;
  const branchLabel = branch.branchLabelFor(branchUuid);

  const refresh = useCallback(async () => {
    if (!branchUuid || !validDates) return;
    try {
      await loadReport(params);
    } catch {
      // The scoped store exposes the actual API error to the page.
    }
  }, [branchUuid, validDates, loadReport, params]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (branchUuid) void loadCategories({ branch_uuid: branchUuid, include_inactive: true }).catch(() => undefined);
  }, [branchUuid, loadCategories]);

  const categoryOptions = [
    { value: "all", label: t("common.all") },
    { value: "sales", label: t("cashflow.summary.salesIncome") },
    ...(storeBranch === branchUuid ? categories : []).map((row) => ({ value: row.category_uuid, label: row.name })),
  ];
  const selectedCategory = categoryOptions.some((option) => option.value === effectiveCategory) ? effectiveCategory : "all";
  const filtered = source !== "all" || direction !== "all" || expenseGroup !== "all" || selectedCategory !== "all";
  const filterLabels = [
    `${t("cashflow.fields.direction")}: ${t(`cashflow.directions.${direction}`)}`,
    `${t("cashflow.fields.source")}: ${t(`cashflow.sources.${source}`)}`,
    `${t("cashflow.fields.expenseGroup")}: ${t(`cashflow.expenseGroups.${expenseGroup}`)}`,
    `${t("cashflow.fields.category")}: ${categoryOptions.find((option) => option.value === effectiveCategory)?.label ?? t("common.all")}`,
  ];

  async function exportExcel() {
    if (!current || exporting) return;
    const isCurrentSession = createSessionGuard();
    const snapshot = current;
    setExporting(true);
    try {
      const XLSX = await import("xlsx-js-style");
      if (!isCurrentSession() || useCashflowStore.getState().branchUuid.toLowerCase() !== snapshot.branch_uuid.toLowerCase()) return;
      const workbook = createReportWorkbook(XLSX, cashflowReportWorksheets(snapshot, branchLabel, filterLabels, (key) => String(t(key))));
      XLSX.writeFile(workbook, `income-expenses-${snapshot.date_from}-to-${snapshot.date_to}.xlsx`);
    } catch (error) {
      if (isCurrentSession()) showToast({ title: t("cashflow.report.exportFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"), tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  const filterFields = (prefix: string) => <>
    <CashflowSelectField id={`${prefix}-branch`} label={t("nav.branch")} value={branchUuid}
      options={branch.branchOptions} disabled={!branch.canSelectBranch || branch.branchLoading || exporting}
      onValueChange={(value) => { setSelectedBranch(value); setCategory("all"); }} />
    <ReportDateRangeFields idPrefix={prefix} dateFrom={dateFrom} dateTo={dateTo} disabled={exporting}
      onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
    <CashflowSelectField id={`${prefix}-source`} label={t("cashflow.fields.source")} value={source}
      options={( ["all", "sales", "manual"] as const).map((value) => ({ value, label: t(`cashflow.sources.${value}`) }))}
      disabled={exporting} onValueChange={(value) => { if (value === "all" || value === "sales" || value === "manual") setSource(value); }} />
    <CashflowSelectField id={`${prefix}-direction`} label={t("cashflow.fields.direction")} value={direction}
      options={( ["all", "income", "expense"] as const).map((value) => ({ value, label: t(`cashflow.directions.${value}`) }))}
      disabled={exporting} onValueChange={(value) => {
        if ((value === "all" || value === "income" || value === "expense") && value !== direction) {
          setDirection(value); setCategoryBranch(branchUuid); setCategory("all");
        }
      }} />
    <CashflowSelectField id={`${prefix}-category`} label={t("cashflow.fields.category")} value={selectedCategory}
      options={categoryOptions} disabled={exporting} onValueChange={(value) => { setCategoryBranch(branchUuid); setCategory(value); }} />
    <CashflowSelectField id={`${prefix}-expense-group`} label={t("cashflow.fields.expenseGroup")} value={expenseGroup}
      options={( ["all", "shop", "other"] as const).map((value) => ({ value, label: t(`cashflow.expenseGroups.${value}`) }))}
      disabled={exporting} onValueChange={(value) => { if (value === "all" || value === "shop" || value === "other") setExpenseGroup(value); }} />
    <div className="flex items-center text-sm text-muted-foreground">{t("cashflow.report.baseCurrencyHint")}</div>
  </>;

  return (
    <CashflowWorkspace compact active="report" title={t("cashflow.report.title")} description={t("cashflow.report.description")}
      branchUuid={branchUuid} branchLabel={branchLabel} actions={<>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void refresh()} disabled={!branchUuid || loading || !validDates}>
          <RefreshCcw aria-hidden className={loading ? "animate-spin" : undefined} />{t("actions.refresh")}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void exportExcel()} disabled={!current || loading || exporting}>
          {exporting ? <Spinner aria-hidden /> : <Download aria-hidden />}{t("report.exportExcel")}
        </Button>
      </>}>
      <Card className="min-w-0 py-3"><CardContent className="flex flex-col gap-3 px-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11 w-full justify-between sm:w-auto sm:gap-4" disabled={exporting}
            aria-label={t("report.filters.openFilters")} onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal aria-hidden /><span>{formatReportDateRange(dateFrom, dateTo)}</span>
          </Button>
          {source !== "all" ? <Badge variant="secondary">{t(`cashflow.sources.${source}`)}</Badge> : null}
          {expenseGroup !== "all" ? <Badge variant="secondary">{t(`cashflow.expenseGroups.${expenseGroup}`)}</Badge> : null}
          {selectedCategory !== "all" ? <Badge variant="secondary">{categoryOptions.find((option) => option.value === selectedCategory)?.label}</Badge> : null}
          {filtered ? <Button id="cashflow-report-clear-filters" type="button" variant="ghost" className="min-h-11 text-sm" disabled={exporting}
            onClick={() => { setSource("all"); setDirection("all"); setExpenseGroup("all"); setCategoryBranch(branchUuid); setCategory("all"); }}>
            <X aria-hidden />{t("cashflow.report.clearFilters")}
          </Button> : null}
        </div>
        <div className="flex min-h-11 rounded-lg bg-muted p-1" aria-label={t("cashflow.fields.direction")}>
          {(["all", "income", "expense"] as const).map((value) => <Button key={value} type="button" variant={direction === value ? "default" : "ghost"}
            aria-pressed={direction === value} className="min-h-10 flex-1 px-4 sm:flex-none" disabled={exporting} onClick={() => {
              if (value !== direction) { setDirection(value); setCategoryBranch(branchUuid); setCategory("all"); }
            }}>{t(`cashflow.directions.${value}`)}</Button>)}
        </div>
      </CardContent></Card>
      <ReportFilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} canApply={Boolean(branchUuid && validDates)}
        description={t("cashflow.report.description")} gridClassName="grid-cols-1 sm:grid-cols-2" loading={loading}
        onApply={() => setFiltersOpen(false)}>{filterFields("cashflow-report-mobile")}</ReportFilterSheet>

      {[branch.branchError, reportError, !validDates ? t("cashflow.report.invalidDateRange") : null].filter(Boolean).map((error, index) => (
        <Alert key={index} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ))}
      <details className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <summary className="flex min-h-5 cursor-pointer items-center gap-2 text-foreground"><Info className="size-4 shrink-0" aria-hidden />{t("cashflow.report.readOnlySales")}</summary>
        <p className="pt-2 leading-6">{t("cashflow.report.salesIncomeHint")}</p>
      </details>

      {loading || (validDates && !current && !reportError && branchUuid) ? <div className="flex flex-col gap-4" role="status" aria-label={t("common.loading")}>
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-28 w-full" />)}</div>
        <Skeleton className="h-72 w-full" />
      </div> : current ? <CashflowReportResults report={current} onCategorySelect={(categoryUuid, selectedDirection) => {
        setCategoryBranch(branchUuid); setCategory(categoryUuid); setDirection(selectedDirection);
      }} /> : null}
    </CashflowWorkspace>
  );
}
