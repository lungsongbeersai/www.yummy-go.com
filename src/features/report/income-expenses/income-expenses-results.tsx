"use client";

import { HandCoins, TrendingDown, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { EmptyState } from "@/components/common/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCashflowAmount } from "@/features/cashflow/cashflow-ui-utils";
import { formatReportDate, formatReportDateRange } from "@/features/report/shared/report-date-format";
import { cn } from "@/lib/utils";
import type { CashflowDirection, CashflowReport } from "@/services/cashflow";
import { cashflowCategorySeries, type CashflowCategorySeriesRow } from "./income-expenses-category-series";

interface CashflowReportResultsProps {
  report: CashflowReport;
  onCategorySelect: (categoryUuid: string, direction: CashflowDirection) => void;
}

export function CashflowReportResults({ report, onCategorySelect }: CashflowReportResultsProps) {
  const { t } = useTranslation();
  const summary = report.summary;
  const incomeCategories = cashflowCategorySeries(report.categories, "income");
  const expenseCategories = cashflowCategorySeries(report.categories, "expense");
  const hasActivity = report.daily.some((day) => day.income_total !== 0 || day.expense_total !== 0);
  const stats = [
    { key: "income", icon: HandCoins, label: t("cashflow.summary.incomeTotal"), amount: summary.income_total,
      tone: "text-success", background: "bg-success/10",
      details: [[t("cashflow.summary.salesIncome"), summary.sales_income], [t("cashflow.summary.otherIncome"), summary.other_income]] as const },
    { key: "expense", icon: TrendingDown, label: t("cashflow.summary.expenseTotal"), amount: summary.expense_total,
      tone: "text-destructive", background: "bg-destructive/10",
      details: [[t("cashflow.summary.shopExpense"), summary.shop_expense], [t("cashflow.summary.otherExpense"), summary.other_expense]] as const },
    { key: "balance", icon: Wallet, label: t("cashflow.summary.balance"), amount: summary.balance,
      tone: summary.balance < 0 ? "text-destructive" : "text-primary-text", background: "bg-primary/10",
      details: [[t("cashflow.summary.incomeTotal"), summary.income_total], [t("cashflow.summary.expenseTotal"), summary.expense_total]] as const },
  ];

  return <>
    <section className="grid min-w-0 gap-3 sm:grid-cols-3" aria-label={t("report.summary")}>
      {stats.map(({ key, icon: Icon, label, amount, tone, background, details }) => <Card key={key} className="min-w-0 gap-3 py-4">
        <CardHeader className="gap-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <CardDescription className="text-sm font-medium">{label}</CardDescription>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone, background)}><Icon className="size-4.5" aria-hidden /></span>
          </div>
          <CardTitle id={`cashflow-report-summary-${key}`} className={cn("break-words text-xl font-bold tabular-nums sm:text-2xl", tone)}>{formatCashflowAmount(amount)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 px-4">
          {details.map(([detail, value]) => <div key={detail} className="flex min-w-0 items-start justify-between gap-3 text-sm">
            <span className="min-w-0 text-muted-foreground">{detail}</span><span className="shrink-0 tabular-nums">{formatCashflowAmount(value, "")}</span>
          </div>)}
        </CardContent>
      </Card>)}
    </section>

    {hasActivity ? <>
      <Card id="cashflow-trend-chart" className="min-w-0 gap-4">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1"><CardTitle className="text-base">{t("cashflow.report.trend")}</CardTitle><CardDescription>{formatReportDateRange(report.date_from, report.date_to)}</CardDescription></div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-success" />{t("cashflow.fields.income")}</span>
            <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-destructive" />{t("cashflow.fields.expense")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer className="aspect-auto h-64 w-full sm:h-72" config={{
            income_total: { label: t("cashflow.summary.incomeTotal"), color: "var(--success)" },
            expense_total: { label: t("cashflow.summary.expenseTotal"), color: "var(--destructive)" },
          }}>
            <BarChart accessibilityLayer data={report.daily} barGap={3} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(value: string) => formatReportDate(value).slice(0, 5)} />
              <YAxis tickLine={false} axisLine={false} width={50} tickFormatter={(value: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatReportDate(value)} formatter={(value, name) => <div className="flex w-full items-center justify-between gap-4"><span>{name === "income_total" ? t("cashflow.fields.income") : t("cashflow.fields.expense")}</span><span className="font-medium tabular-nums">{formatCashflowAmount(Number(value))}</span></div>} />} />
              <Bar dataKey="income_total" fill="var(--color-income_total)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="expense_total" fill="var(--color-expense_total)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <section className="grid min-w-0 gap-4 xl:grid-cols-2" aria-label={t("cashflow.report.categories")}>
        <CategoryChart direction="income" rows={incomeCategories} total={summary.income_total} onCategorySelect={onCategorySelect} />
        <CategoryChart direction="expense" rows={expenseCategories} total={summary.expense_total} onCategorySelect={onCategorySelect} />
      </section>
    </> : <EmptyState title={t("cashflow.report.noActivity")} description={t("cashflow.report.noActivityHint")} />}

    <Tabs defaultValue="categories" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="min-h-11 w-full sm:w-fit">
          <TabsTrigger value="categories" aria-label={t("cashflow.report.categories")} className="min-h-10 px-4 text-sm">{t("cashflow.report.categoriesShort")}</TabsTrigger>
          <TabsTrigger value="daily" aria-label={t("cashflow.report.daily")} className="min-h-10 px-4 text-sm">{t("cashflow.report.dailyShort")}</TabsTrigger>
        </TabsList>
        <span className="text-sm text-muted-foreground">{t("cashflow.report.baseCurrencyHint")}</span>
      </div>
      <TabsContent value="categories"><Card className="min-w-0 overflow-hidden py-0"><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>{t("cashflow.fields.category")}</TableHead><TableHead className="text-right">{t("cashflow.fields.income")}</TableHead><TableHead className="text-right">{t("cashflow.fields.expense")}</TableHead><TableHead className="text-right">{t("cashflow.fields.balance")}</TableHead></TableRow></TableHeader>
        <TableBody>{report.categories.map((row) => <TableRow key={row.category_uuid}>
          <TableCell><span className="flex min-w-36 flex-wrap items-center gap-2">{row.category_uuid === "sales" ? t("cashflow.summary.salesIncome") : row.category_name}<Badge variant="outline" className={row.direction === "income" ? "text-success" : row.direction === "expense" ? "text-destructive" : undefined}>{t(`cashflow.directions.${row.direction}`)}</Badge></span></TableCell>
          <TableCell className="text-right tabular-nums text-success">{formatCashflowAmount(row.income, "")}</TableCell>
          <TableCell className="text-right tabular-nums text-destructive">{formatCashflowAmount(row.expense, "")}</TableCell>
          <TableCell className={cn("text-right tabular-nums", row.balance < 0 && "text-destructive")}>{formatCashflowAmount(row.balance, "")}</TableCell>
        </TableRow>)}
          <TableRow className="bg-muted/50 font-bold"><TableCell>{t("common.total")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.income_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.expense_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.balance, "")}</TableCell></TableRow>
        </TableBody>
      </Table></CardContent></Card></TabsContent>
      <TabsContent value="daily"><Card className="min-w-0 overflow-hidden py-0"><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>{t("cashflow.fields.date")}</TableHead><TableHead className="text-right">{t("cashflow.fields.income")}</TableHead><TableHead className="text-right">{t("cashflow.fields.expense")}</TableHead><TableHead className="text-right">{t("cashflow.fields.balance")}</TableHead></TableRow></TableHeader>
        <TableBody>{report.daily.map((day) => <TableRow key={day.date}><TableCell className="whitespace-nowrap">{formatReportDate(day.date)}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(day.income_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(day.expense_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(day.balance, "")}</TableCell></TableRow>)}
          <TableRow className="bg-muted/50 font-bold"><TableCell>{t("common.total")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.income_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.expense_total, "")}</TableCell><TableCell className="text-right tabular-nums">{formatCashflowAmount(summary.balance, "")}</TableCell></TableRow>
        </TableBody>
      </Table></CardContent></Card></TabsContent>
    </Tabs>
  </>;
}

interface CategoryChartProps {
  direction: CashflowDirection;
  rows: CashflowCategorySeriesRow[];
  total: number;
  onCategorySelect: CashflowReportResultsProps["onCategorySelect"];
}

function CategoryChart({ direction, rows, total, onCategorySelect }: CategoryChartProps) {
  const { t } = useTranslation();
  const income = direction === "income";
  return <Card id={`cashflow-${direction}-category-chart`} className="min-w-0 gap-4">
    <CardHeader className="gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">{t(income ? "cashflow.report.categoryIncome" : "cashflow.report.categoryExpense")}</CardTitle><Badge variant="secondary">{t("cashflow.report.categoryCount", { count: rows.length })}</Badge></div>
      <CardDescription className={cn("text-xl font-bold tabular-nums", income ? "text-success" : "text-destructive")}>{formatCashflowAmount(total)}</CardDescription>
    </CardHeader>
    <CardContent className="max-h-96 overflow-y-auto">
      {rows.length ? <div className="flex flex-col gap-4">{rows.map((row) => {
        const name = row.categoryUuid === "sales" ? t("cashflow.summary.salesIncome") : row.name;
        const share = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(row.share);
        return <button key={row.categoryUuid} type="button" data-report-category={row.categoryUuid} data-report-direction={direction}
          data-category-amount={row.amount} data-category-share={row.share}
          aria-label={`${name}: ${formatCashflowAmount(row.amount)}, ${share}%. ${t("cashflow.report.viewCategory")}`}
          className="group flex min-h-14 w-full flex-col gap-2 rounded-md p-1 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onCategorySelect(row.categoryUuid, direction)}>
          <span className="flex w-full items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words font-medium group-hover:text-primary-text">{name}</span><span className="shrink-0 text-right"><span className="font-semibold tabular-nums">{formatCashflowAmount(row.amount, "")}</span><span className="ml-2 text-muted-foreground tabular-nums">{share}%</span></span></span>
          <span className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden><span className={cn("block h-full rounded-full", income ? "bg-success" : "bg-destructive")} style={{ width: `${row.share}%` }} /></span>
        </button>;
      })}</div> : <EmptyState title={t(income ? "cashflow.report.noIncome" : "cashflow.report.noExpense")} description={t("cashflow.report.noActivityHint")} />}
    </CardContent>
  </Card>;
}
