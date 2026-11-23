"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, HandCoins, Info, RefreshCcw, SlidersHorizontal, TrendingDown, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { CashflowAccessDenied, CashflowSelectField, CashflowWorkspace } from "@/features/cashflow/cashflow-workspace";
import { formatCashflowAmount, validCashflowDateRange } from "@/features/cashflow/cashflow-ui-utils";
import { ReportDateRangeFields } from "@/features/report/shared/report-filter-fields";
import { ReportFilterSheet } from "@/features/report/shared/report-filter-shell";
import { formatReportDate, formatReportDateRange } from "@/features/report/shared/report-date-format";
import { ReportStatCards } from "@/features/report/shared/report-stat-cards";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { createReportWorkbook } from "@/lib/export/excel";
import { businessDateInputValue } from "@/lib/format";
import { canManageCashflow } from "@/lib/permissions";
import type { CashflowReport, FetchCashflowReportParams } from "@/services/cashflow";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCashflowStore } from "@/stores/cashflow-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useToastStore } from "@/stores/toast-store";
import { CASHFLOW_SUMMARY_METRICS, cashflowReportWorksheets } from "./income-expenses-export";

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
      disabled={exporting} onValueChange={(value) => { if (value === "all" || value === "income" || value === "expense") setDirection(value); }} />
    <CashflowSelectField id={`${prefix}-category`} label={t("cashflow.fields.category")} value={selectedCategory}
      options={categoryOptions} disabled={exporting} onValueChange={(value) => { setCategoryBranch(branchUuid); setCategory(value); }} />
    <CashflowSelectField id={`${prefix}-expense-group`} label={t("cashflow.fields.expenseGroup")} value={expenseGroup}
      options={( ["all", "shop", "other"] as const).map((value) => ({ value, label: t(`cashflow.expenseGroups.${value}`) }))}
      disabled={exporting} onValueChange={(value) => { if (value === "all" || value === "shop" || value === "other") setExpenseGroup(value); }} />
    <div className="flex items-center text-sm text-muted-foreground">{t("cashflow.report.baseCurrencyHint")}</div>
  </>;

  return (
    <CashflowWorkspace active="report" title={t("cashflow.report.title")} description={t("cashflow.report.description")}
      branchLabel={branchLabel} actions={<>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void refresh()} disabled={!branchUuid || loading || !validDates}>
          <RefreshCcw aria-hidden className={loading ? "animate-spin" : undefined} />{t("actions.refresh")}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void exportExcel()} disabled={!current || loading || exporting}>
          {exporting ? <Spinner aria-hidden /> : <Download aria-hidden />}{t("report.exportExcel")}
        </Button>
      </>}>
      <Card className="hidden lg:block">
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filterFields("cashflow-report")}
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2 lg:hidden">
        <Button type="button" variant="outline" className="min-h-11 w-full justify-between" disabled={exporting}
          aria-label={t("report.filters.openFilters")} onClick={() => setFiltersOpen(true)}>
          <span>{formatReportDateRange(dateFrom, dateTo)}</span><SlidersHorizontal aria-hidden />
        </Button>
        <div className="flex flex-wrap gap-2">
          {source !== "all" ? <Badge variant="secondary">{t(`cashflow.sources.${source}`)}</Badge> : null}
          {direction !== "all" ? <Badge variant="secondary">{t(`cashflow.directions.${direction}`)}</Badge> : null}
          {expenseGroup !== "all" ? <Badge variant="secondary">{t(`cashflow.expenseGroups.${expenseGroup}`)}</Badge> : null}
          {selectedCategory !== "all" ? <Badge variant="secondary">{categoryOptions.find((option) => option.value === selectedCategory)?.label}</Badge> : null}
        </div>
      </div>
      <ReportFilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} canApply={Boolean(branchUuid && validDates)}
        description={t("cashflow.report.description")} gridClassName="grid-cols-1 sm:grid-cols-2" loading={loading}
        onApply={() => setFiltersOpen(false)}>{filterFields("cashflow-report-mobile")}</ReportFilterSheet>

      {[branch.branchError, reportError, !validDates ? t("cashflow.report.invalidDateRange") : null].filter(Boolean).map((error, index) => (
        <Alert key={index} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      ))}
      <Alert><Info aria-hidden /><AlertDescription className="text-sm">{t("cashflow.report.salesIncomeHint")}</AlertDescription></Alert>

      {loading || (validDates && !current && !reportError && branchUuid) ? <div className="flex flex-col gap-4" role="status" aria-label={t("common.loading")}>
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-28 w-full" />)}</div>
        <Skeleton className="h-72 w-full" />
      </div> : current ? <CashflowReportResults report={current} /> : null}
    </CashflowWorkspace>
  );
}

function CashflowReportResults({ report }: { report: CashflowReport }) {
  const { t } = useTranslation();
  const summary = report.summary;
  const hasActivity = report.daily.some((day) => day.income_total !== 0 || day.expense_total !== 0);
  const sourceMetrics = CASHFLOW_SUMMARY_METRICS.filter(([key]) => ["sales_income", "other_income", "shop_expense", "other_expense"].includes(key));
  return <>
    <ReportStatCards className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3" stats={[
      { key: "income", icon: HandCoins, label: t("cashflow.summary.incomeTotal"), value: formatCashflowAmount(summary.income_total), tone: "success" },
      { key: "expense", icon: TrendingDown, label: t("cashflow.summary.expenseTotal"), value: formatCashflowAmount(summary.expense_total), tone: "danger" },
      { key: "balance", icon: Wallet, label: t("cashflow.summary.balance"), value: formatCashflowAmount(summary.balance), tone: summary.balance < 0 ? "danger" : "primary", negative: summary.balance < 0 },
    ]} />
    <Card>
      <CardHeader><CardTitle>{t("cashflow.report.sourceBreakdown")}</CardTitle><CardDescription>{formatReportDateRange(report.date_from, report.date_to)}</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sourceMetrics.map(([key, label]) => <div key={key} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">{t(`cashflow.summary.${label}`)}</p>
        <p className="break-words text-lg font-bold tabular-nums">{formatCashflowAmount(summary[key])}</p>
      </div>)}</CardContent>
    </Card>
    {hasActivity ? <Card>
      <CardHeader><CardTitle>{t("cashflow.report.trend")}</CardTitle><CardDescription>{t("cashflow.report.baseCurrencyHint")}</CardDescription></CardHeader>
      <CardContent>
        <ChartContainer className="h-64 w-full" config={{ income_total: { label: t("cashflow.summary.incomeTotal"), color: "var(--success)" }, expense_total: { label: t("cashflow.summary.expenseTotal"), color: "var(--destructive)" } }}>
          <BarChart accessibilityLayer data={report.daily}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(value: string) => formatReportDate(value).slice(0, 5)} />
            <YAxis tickLine={false} axisLine={false} width={70} tickFormatter={(value: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatReportDate(value)} formatter={(value, name) => <div className="flex w-full items-center justify-between gap-4"><span>{name === "income_total" ? t("cashflow.summary.incomeTotal") : t("cashflow.summary.expenseTotal")}</span><span className="font-medium tabular-nums">{formatCashflowAmount(Number(value))}</span></div>} />} />
            <Bar dataKey="income_total" fill="var(--color-income_total)" radius={3} />
            <Bar dataKey="expense_total" fill="var(--color-expense_total)" radius={3} />
          </BarChart>
        </ChartContainer>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm"><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-success" />{t("cashflow.summary.incomeTotal")}</span><span className="flex items-center gap-2"><span className="size-3 rounded-sm bg-destructive" />{t("cashflow.summary.expenseTotal")}</span></div>
      </CardContent>
    </Card> : <EmptyState title={t("cashflow.report.noActivity")} description={t("cashflow.report.noActivityHint")} />}
    <Tabs defaultValue="daily" className="min-w-0">
      <TabsList className="min-h-11 w-full sm:w-fit"><TabsTrigger value="daily" className="min-h-10 px-4 text-sm">{t("cashflow.report.daily")}</TabsTrigger><TabsTrigger value="categories" className="min-h-10 px-4 text-sm">{t("cashflow.report.categories")}</TabsTrigger></TabsList>
      <TabsContent value="daily"><Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>{t("cashflow.fields.date")}</TableHead>{CASHFLOW_SUMMARY_METRICS.map(([key, label]) => <TableHead key={key} className="text-right">{t(`cashflow.summary.${label}`)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{report.daily.map((day) => <TableRow key={day.date}><TableCell className="whitespace-nowrap">{formatReportDate(day.date)}</TableCell>{CASHFLOW_SUMMARY_METRICS.map(([key]) => <TableCell key={key} className="text-right tabular-nums">{formatCashflowAmount(day[key], "")}</TableCell>)}</TableRow>)}
          <TableRow className="bg-muted/50 font-bold"><TableCell>{t("common.total")}</TableCell>{CASHFLOW_SUMMARY_METRICS.map(([key]) => <TableCell key={key} className="text-right tabular-nums">{formatCashflowAmount(summary[key], "")}</TableCell>)}</TableRow>
        </TableBody>
      </Table></CardContent></Card></TabsContent>
      <TabsContent value="categories"><Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>{t("cashflow.fields.category")}</TableHead><TableHead className="text-right">{t("cashflow.fields.income")}</TableHead><TableHead className="text-right">{t("cashflow.fields.expense")}</TableHead><TableHead className="text-right">{t("cashflow.fields.balance")}</TableHead></TableRow></TableHeader>
        <TableBody>{report.categories.map((row) => <TableRow key={`${row.category_uuid}-${row.direction}`}><TableCell><span className="flex flex-wrap items-center gap-2">{row.category_uuid === "sales" ? t("cashflow.summary.salesIncome") : row.category_name}{row.category_uuid === "sales" ? <Badge variant="secondary">{t("cashflow.sources.sales")}</Badge> : null}</span></TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(row.income, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(row.expense, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(row.balance, "")}</TableCell></TableRow>)}
          <TableRow className="bg-muted/50 font-bold"><TableCell>{t("common.total")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.income_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.expense_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.balance, "")}</TableCell></TableRow>
        </TableBody>
      </Table></CardContent></Card></TabsContent>
    </Tabs>
  </>;
}
