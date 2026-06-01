"use client";

import { memo, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Code2,
  Copy,
  Download,
  Info,
  RefreshCcw
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  AccountingRow,
  BreakdownRow,
  DashboardFilters,
  ProductRow,
  Row,
  SelectOption,
  Tone,
  TrendPoint
} from "@/features/dashboard/dashboard-view-model";
import {
  asRow,
  formatCompactKip,
  formatKip,
  formatNumber,
  formatPercent,
  numberFrom,
  text
} from "@/features/dashboard/dashboard-view-model";

export type DashboardCopy = Record<string, string>;

type FilterBarProps = {
  activeBranchUuid: string;
  branchLoading: boolean;
  branchOptions: SelectOption[];
  copy: DashboardCopy;
  filters: DashboardFilters;
  loading: boolean;
  monthOptions: SelectOption[];
  onApply: () => void;
  onBranchChange: (value: string) => void;
  onFilterChange: (patch: Partial<DashboardFilters>) => void;
  onReset: () => void;
  rangeOptions: SelectOption[];
  yearOptions: SelectOption[];
};

type RevenueChartMode = "orders" | "payments" | "revenue";

const toneClasses: Record<Tone, { bar: string; soft: string; text: string }> = {
  primary: {
    bar: "bg-primary",
    soft: "bg-primary/10",
    text: "text-primary"
  },
  sky: {
    bar: "bg-primary/70",
    soft: "bg-primary/10",
    text: "text-primary"
  },
  amber: {
    bar: "bg-muted-foreground",
    soft: "bg-muted",
    text: "text-muted-foreground"
  },
  rose: {
    bar: "bg-destructive",
    soft: "bg-destructive/10",
    text: "text-destructive"
  },
  violet: {
    bar: "bg-primary/80",
    soft: "bg-primary/10",
    text: "text-primary"
  },
  slate: {
    bar: "bg-muted-foreground",
    soft: "bg-muted",
    text: "text-muted-foreground"
  }
};

const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.72)",
  "hsl(38 92% 50%)",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--primary) / 0.42)"
];

const SelectControl = memo(function SelectControl({
  disabled = false,
  label,
  onChange,
  options,
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) {
  return (
    <Field className="dashboard-filter-field min-w-0 gap-1.5">
      <FieldLabel className="text-[11px] font-bold text-muted-foreground">{label}</FieldLabel>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full text-[13px] font-semibold">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
});

function compactMoney(value: unknown) {
  return `${formatCompactKip(value)} ₭`;
}

function formatApiMoney(value: unknown, unit: string) {
  return unit ? `${formatNumber(value)} ${unit}` : formatKip(value);
}

function paymentLabel(rows: BreakdownRow[], terms: string[], fallback: string) {
  const match = rows.find((row) => {
    const target = `${row.key} ${row.label}`.toLowerCase();
    return terms.some((term) => target.includes(term));
  });

  return match?.label ?? fallback;
}

function ProgressBar({ percent, tone = "primary" }: { percent: number; tone?: Tone }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", toneClasses[tone].bar)}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

function ProgressRow({
  label,
  percent,
  subValue,
  tone = "primary",
  value
}: {
  label: string;
  percent: number;
  subValue?: string;
  tone?: Tone;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="truncate font-bold">{label}</p>
          {subValue ? <p className="text-xs text-muted-foreground">{subValue}</p> : null}
        </div>
        <p className="shrink-0 font-black">{value}</p>
      </div>
      <ProgressBar percent={percent} tone={tone} />
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <Empty className="min-h-28 border border-border bg-muted/20 p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Info />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-bold text-muted-foreground">{label}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

function MiniFact({ label, title, value }: { label: string; title: string; value: string }) {
  return (
    <div className="dashboard-mini-fact rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] font-black uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{value}</p>
    </div>
  );
}

function SparkPreview({ primary, values }: { primary?: boolean; values: number[] }) {
  if (!values.length) return <div className="dashboard-spark-empty" />;
  const max = Math.max(1, ...values);
  const width = 150;
  const height = 34;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - Math.max(4, (value / max) * (height - 4));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg aria-hidden className={cn("dashboard-spark dashboard-spark-line", primary && "dashboard-spark-line-primary")} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export const DashboardHeader = memo(function DashboardHeader({
  activeBranchLabel,
  copy,
  filtersMeta,
  section
}: {
  activeBranchLabel: string;
  copy: DashboardCopy;
  filtersMeta: Row;
  section: Row;
}) {
  const businessStart = text(filtersMeta.business_date_start, "");
  const businessEnd = text(filtersMeta.business_date_end, "");
  const sectionTitle = text(section.section_name, copy.title);
  const rangeMode = text(filtersMeta.range_mode, "");
  const rangeDays = numberFrom(filtersMeta, "days_in_month");
  const updatedAt = text(filtersMeta.updated_at, "");
  const sectionType = text(section.section_type, "");
  const metaItems = [
    sectionType,
    businessStart && businessEnd ? `${businessStart} - ${businessEnd}` : "",
    [rangeMode, rangeDays ? `${formatNumber(rangeDays)} ${copy.days}` : ""].filter(Boolean).join(" "),
    updatedAt
  ].filter(Boolean);

  function handleExport() {
    window.print();
  }

  return (
    <div className="dashboard-page-head flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-normal md:text-[1.65rem]">
          {sectionTitle}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          {metaItems.map((item, index) => (
            <span key={`${item}-${index}`} className={index === 1 ? "font-mono text-foreground" : undefined}>
              {index ? <span className="mr-2 text-muted-foreground">·</span> : null}
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="dashboard-head-actions flex flex-wrap items-center justify-end gap-2">
        <Button aria-label={`${copy.export} ${activeBranchLabel}`} size="sm" type="button" variant="outline" onClick={handleExport}>
          <Download data-icon="inline-start" />
          {copy.export}
        </Button>
      </div>
    </div>
  );
});

export const DashboardFilterBar = memo(function DashboardFilterBar({
  activeBranchUuid,
  branchLoading,
  branchOptions,
  copy,
  filters,
  loading,
  monthOptions,
  onApply,
  onBranchChange,
  onFilterChange,
  onReset,
  rangeOptions,
  yearOptions
}: FilterBarProps) {
  return (
    <Card className="dashboard-filter-card border-border bg-card shadow-sm">
      <CardContent className="dashboard-filter-content">
        <div className="dashboard-range-segment">
          {rangeOptions.map((option) => (
            <Button
              key={option.value}
              size="sm"
              type="button"
              variant={filters.summary_range === option.value ? "outline" : "ghost"}
              className="h-8 px-3"
              onClick={() => onFilterChange({ summary_range: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="dashboard-filter-selects">
          <SelectControl
            disabled={branchLoading || !branchOptions.length}
            label={copy.branch}
            options={branchOptions}
            value={activeBranchUuid}
            onChange={onBranchChange}
          />
          <SelectControl
            label={copy.year}
            options={yearOptions}
            value={filters.report_year}
            onChange={(value) => onFilterChange({ report_year: value })}
          />
          <SelectControl
            label={copy.month}
            options={monthOptions}
            value={filters.report_month}
            onChange={(value) => onFilterChange({ report_month: value })}
          />
        </div>
        <div className="dashboard-filter-actions">
          <Button className="flex-1 xl:flex-none" size="sm" type="button" variant="outline" onClick={onReset}>
            {copy.reset}
          </Button>
          <Button className="flex-1 xl:flex-none" size="sm" type="button" disabled={loading || !activeBranchUuid} onClick={onApply}>
            {copy.apply}
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-end" /> : <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

export const ErrorBanner = memo(function ErrorBanner({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-3 text-sm text-destructive">
        <AlertTriangle />
        {message}
      </CardContent>
    </Card>
  );
});

export const DashboardQueryBar = memo(function DashboardQueryBar({
  activeBranchUuid,
  copy,
  requestParams
}: {
  activeBranchUuid: string;
  copy: DashboardCopy;
  requestParams: Row;
}) {
  const [copied, setCopied] = useState(false);
  const params = [
    ["branch_uuid_fk", text(requestParams.branch_uuid_fk, activeBranchUuid)],
    ["summary_range", text(requestParams.summary_range, "")],
    ["report_year", text(requestParams.report_year, "")],
    ["report_month", text(requestParams.report_month, "")],
    ["lang", text(requestParams.lang, "")],
    ["top", text(requestParams.top, "")]
  ].filter(([, value]) => value);
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");

  async function copyQuery() {
    await navigator.clipboard?.writeText(`/api/v1/dashboard/executive?${query}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="dashboard-query-card overflow-hidden">
      <CardContent className="dashboard-query-content flex min-w-0 items-center gap-2 overflow-x-auto p-2 text-xs">
        <Badge className="shrink-0 border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
          <Code2 />
          {copy.activeQuery}
        </Badge>
        {params.map(([key, value]) => (
          <div key={key} className="dashboard-query-kv flex shrink-0 items-baseline gap-2 border-r border-dashed border-border px-2 last:border-r-0">
            <span className="font-bold uppercase tracking-wide text-muted-foreground">{key}</span>
            <span className={cn("font-mono font-semibold", key === "branch_uuid_fk" && "text-primary")}>{value || "-"}</span>
          </div>
        ))}
        <Button className="ml-auto shrink-0" size="sm" variant="outline" type="button" onClick={copyQuery}>
          <Copy data-icon="inline-start" />
          {copied ? copy.copied : copy.copyQuery}
        </Button>
      </CardContent>
    </Card>
  );
});

export const DashboardWarningBanner = memo(function DashboardWarningBanner({
  copy,
  warnings
}: {
  copy: DashboardCopy;
  warnings: Array<{ key: string; value: string }>;
}) {
  if (!warnings.length) return null;

  return (
    <Alert className="dashboard-warning-banner border-amber-500/30 bg-amber-500/10 text-amber-700">
      <AlertTriangle />
      <AlertTitle className="font-black">{copy.warnings}</AlertTitle>
      <AlertDescription className="dashboard-warning-body flex flex-col gap-1 text-foreground">
        {warnings.map((warning) => (
          <span key={warning.key}>{warning.value}</span>
        ))}
      </AlertDescription>
    </Alert>
  );
});

export const DashboardHeroStrip = memo(function DashboardHeroStrip({
  copy,
  kpis,
  periodLabel,
  section,
  trendRows
}: {
  copy: DashboardCopy;
  kpis: Row;
  periodLabel: string;
  section: Row;
  trendRows: TrendPoint[];
}) {
  const mainTotal = asRow(section.main_total);
  const paymentSummary = asRow(section.payment_summary);
  const cancellationSummary = asRow(section.cancellation_summary);
  const mainUnit = text(mainTotal.unit, "");
  const cancelledCount = numberFrom(cancellationSummary, "cancelled_orders_count") || numberFrom(kpis, "cancelled_orders_count");
  const cancelledTotal = numberFrom(cancellationSummary, "cancelled_orders_total") || numberFrom(kpis, "cancelled_total") || numberFrom(kpis, "cancelled_amount_total");
  const metrics = [
    {
      detail: text(mainTotal.sub_label, periodLabel),
      label: text(mainTotal.label, copy.revenue),
      primary: true,
      sparkValues: trendRows.slice(-12).map((row) => row.revenue),
      value: formatApiMoney(numberFrom(mainTotal, "value") || numberFrom(kpis, "revenue_total"), mainUnit)
    },
    {
      detail: copy.totalBills,
      label: copy.orders,
      sparkValues: trendRows.slice(-12).map((row) => row.orders),
      value: formatNumber(numberFrom(paymentSummary, "orders_count") || numberFrom(kpis, "orders_count"))
    },
    {
      detail: copy.avgBill,
      label: copy.avgBill,
      sparkValues: trendRows.slice(-12).map((row) => row.orders ? row.revenue / row.orders : 0),
      value: formatKip(numberFrom(kpis, "avg_bill"))
    },
    {
      detail: `${copy.discountRate}: ${formatPercent(numberFrom(kpis, "discount_rate"))}`,
      label: copy.discount,
      value: formatKip(numberFrom(kpis, "discount_total"))
    },
    {
      detail: `${copy.cancelRate}: ${formatPercent(numberFrom(kpis, "cancel_rate"))}`,
      label: copy.cancellations,
      rose: true,
      value: `${formatNumber(cancelledCount)} / ${compactMoney(cancelledTotal)}`
    }
  ];

  return (
    <Card className="dashboard-hero-card overflow-hidden">
      <div className="dashboard-hero-grid grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-[1.6fr_repeat(4,1fr)]">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "dashboard-hero-kpi min-w-0 p-4",
              metric.primary && "dashboard-hero-kpi-primary relative overflow-hidden bg-primary text-primary-foreground",
              !metric.primary && "bg-card"
            )}
          >
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", metric.primary ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {metric.label}
            </p>
            <p className={cn("mt-2 truncate font-mono text-2xl font-semibold", metric.rose && "text-destructive")}>{metric.value}</p>
            <p className={cn("mt-2 truncate text-xs", metric.primary ? "text-primary-foreground/75" : "text-muted-foreground")}>{metric.detail}</p>
            {metric.sparkValues ? <SparkPreview primary={metric.primary} values={metric.sparkValues} /> : null}
          </div>
        ))}
      </div>
    </Card>
  );
});

function DashboardRevenueChart({
  copy,
  mode,
  paymentRows,
  paymentTrendRows,
  trendRows
}: {
  copy: DashboardCopy;
  mode: RevenueChartMode;
  paymentRows: BreakdownRow[];
  paymentTrendRows: TrendPoint[];
  trendRows: TrendPoint[];
}) {
  const rows = mode === "payments" ? paymentTrendRows : trendRows;
  const chartRows = rows.map((row) => ({
    ...row,
    label: row.day || row.date
  }));
  const config = {
    cash: { label: paymentLabel(paymentRows, ["cash"], copy.cash), color: "hsl(var(--primary))" },
    transfer: { label: paymentLabel(paymentRows, ["transfer"], copy.transfer), color: "hsl(var(--primary) / 0.62)" },
    mixed: { label: copy.mixed, color: "hsl(var(--primary) / 0.38)" },
    balance: { label: paymentLabel(paymentRows, ["debt", "balance"], copy.debt), color: "hsl(var(--destructive))" },
    orders: { label: copy.orders, color: "hsl(38 92% 50%)" },
    revenue: { label: copy.revenue, color: "hsl(var(--primary))" }
  } satisfies ChartConfig;

  if (!rows.length) return <EmptyPanel label={copy.noData} />;
  const isOrders = mode === "orders";

  return (
    <ChartContainer config={config} className="dashboard-main-chart h-[20rem] w-full">
      <ComposedChart data={chartRows} margin={{ bottom: 0, left: 0, right: 0, top: 14 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis axisLine={false} tickLine={false} tickFormatter={isOrders ? (value) => formatNumber(value) : formatCompactKip} width={42} />
        <Tooltip content={<ChartTooltipContent valueFormatter={(value, name) => name === copy.orders ? formatNumber(value) : formatKip(value)} />} />
        {mode === "payments" ? (
          <>
            <Bar dataKey="cash" stackId="payments" fill="var(--color-cash)" radius={[2, 2, 0, 0]} barSize={10} />
            <Bar dataKey="transfer" stackId="payments" fill="var(--color-transfer)" radius={[2, 2, 0, 0]} barSize={10} />
            <Bar dataKey="mixed" stackId="payments" fill="var(--color-mixed)" radius={[2, 2, 0, 0]} barSize={10} />
            <Bar dataKey="balance" stackId="payments" fill="var(--color-balance)" radius={[2, 2, 0, 0]} barSize={10} />
          </>
        ) : null}
        {mode === "revenue" ? <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[2, 2, 0, 0]} barSize={10} /> : null}
        {mode === "orders" ? <Bar dataKey="orders" fill="var(--color-orders)" radius={[2, 2, 0, 0]} barSize={10} /> : null}
        {mode === "payments" ? <Line dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeDasharray="4 4" strokeWidth={2} dot={false} /> : null}
      </ComposedChart>
    </ChartContainer>
  );
}

export const DashboardRevenueAccountingGrid = memo(function DashboardRevenueAccountingGrid({
  accountingRows,
  copy,
  paymentRows,
  paymentTrendRows,
  trendRows
}: {
  accountingRows: AccountingRow[];
  copy: DashboardCopy;
  paymentRows: BreakdownRow[];
  paymentTrendRows: TrendPoint[];
  trendRows: TrendPoint[];
}) {
  const [chartMode, setChartMode] = useState<RevenueChartMode>("revenue");
  const paymentTiles = paymentRows.map((row) => ({
    className: row.key.toLowerCase().includes("debt") || row.key.toLowerCase().includes("balance")
      ? "bg-destructive/10 text-destructive"
      : row.key.toLowerCase().includes("cash")
        ? "bg-primary/10 text-primary"
        : "text-primary",
    label: row.label,
    value: row.value
  }));
  const legendItems = [
    { className: "bg-primary", label: paymentLabel(paymentRows, ["cash"], copy.cash) },
    { className: "bg-primary/60", label: paymentLabel(paymentRows, ["transfer"], copy.transfer) },
    { className: "bg-primary/35", label: copy.mixed },
    { className: "bg-destructive", label: paymentLabel(paymentRows, ["debt", "balance"], copy.debt) }
  ];

  return (
    <div className="dashboard-revenue-grid grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <Card className="dashboard-card dashboard-chart-card overflow-hidden">
        <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold">{copy.dailySales}</CardTitle>
            <p className="mt-1 truncate text-xs text-muted-foreground">{copy.dailySalesSubtitle}</p>
          </div>
          <div className="dashboard-chart-tools flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="dashboard-chart-legend flex flex-wrap items-center gap-3">
              {legendItems.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-sm", item.className)} />
                  {item.label}
                </span>
              ))}
            </div>
            <div className="dashboard-chart-tabs">
              <Button size="sm" type="button" variant={chartMode === "revenue" ? "outline" : "ghost"} onClick={() => setChartMode("revenue")}>{copy.revenue}</Button>
              <Button size="sm" type="button" variant={chartMode === "payments" ? "outline" : "ghost"} onClick={() => setChartMode("payments")}>{copy.payments}</Button>
              <Button size="sm" type="button" variant={chartMode === "orders" ? "outline" : "ghost"} onClick={() => setChartMode("orders")}>{copy.orders}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="dashboard-chart-body p-3">
          <DashboardRevenueChart
            copy={copy}
            mode={chartMode}
            paymentRows={paymentRows}
            paymentTrendRows={paymentTrendRows}
            trendRows={trendRows}
          />
        </CardContent>
      </Card>

      <Card className="dashboard-card dashboard-ledger-card overflow-hidden">
        <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
          <div>
            <CardTitle className="text-sm font-semibold">{copy.accounting}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{copy.ledger}</p>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {accountingRows.length ? (
            <div className="flex flex-col">
              {accountingRows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "dashboard-ledger-row flex items-center justify-between gap-3 border-b border-dashed py-2 text-sm last:border-b-0",
                    row.important && "dashboard-ledger-total mt-2 rounded-md border border-border bg-primary/10 px-3 font-semibold"
                  )}
                >
                  <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
                  <span className={cn("shrink-0 font-mono font-semibold", row.negative && "text-destructive", row.important && "text-primary")}>
                    {row.negative ? "- " : row.important ? "" : "+ "}
                    {formatKip(row.value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel label={copy.noData} />
          )}

          {paymentTiles.length ? (
            <>
              <Separator className="my-4" />
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{copy.paymentSplit}</p>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {paymentTiles.map((tile) => (
                  <div key={tile.label} className={cn("dashboard-pay-tile rounded-md border border-border bg-muted/30 p-3", tile.className)}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tile.label}</p>
                    <p className="mt-1 font-mono text-lg font-semibold">{compactMoney(tile.value)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
});

function ChannelDonutPanel({ copy, rows }: { copy: DashboardCopy; rows: BreakdownRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const main = rows.reduce<BreakdownRow | undefined>(
    (selected, row) => (!selected || row.value > selected.value ? row : selected),
    undefined
  );
  const config = { value: { label: copy.revenue, color: "hsl(var(--primary))" } } satisfies ChartConfig;

  return (
    <Card className="dashboard-card dashboard-channel-card overflow-hidden">
      <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
        <div>
          <CardTitle className="text-sm font-semibold">{copy.orderChannels}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{rows.length} {copy.channels}</p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{formatKip(total)}</span>
      </CardHeader>
      <CardContent className="dashboard-channel-content grid gap-4 p-4 md:grid-cols-[10.5rem_1fr] xl:grid-cols-1 2xl:grid-cols-[10.5rem_1fr]">
        {rows.length ? (
          <>
            <div className="relative mx-auto size-40">
              <ChartContainer config={config} className="size-40">
                <PieChart>
                  <Pie data={rows} dataKey="value" nameKey="label" innerRadius={52} outerRadius={70} paddingAngle={2}>
                    {rows.map((row, index) => (
                      <Cell key={row.key} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="font-mono text-xl font-semibold">{formatPercent(main?.percent ?? 0)}</p>
                <p className="max-w-28 truncate text-xs text-muted-foreground">{main?.label ?? copy.channels}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <div key={row.key} className="dashboard-channel-row grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{formatKip(row.value)}</p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{formatNumber(row.count ?? 0)}</span>
                  <span className="font-mono font-semibold">{formatPercent(row.percent)}</span>
                </div>
              ))}
              <p className="border-t pt-3 text-xs text-muted-foreground">
                {main ? `${copy.mainChannel}: ${main.label} / ${formatPercent(main.percent)}` : copy.noData}
              </p>
            </div>
          </>
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
    </Card>
  );
}

function TableStatusPanel({ copy, summary }: { copy: DashboardCopy; summary: Row }) {
  const total = Math.max(0, numberFrom(summary, "total_tables"));
  const occupied = Math.max(0, numberFrom(summary, "occupied_tables"));
  const available = Math.max(0, numberFrom(summary, "available_tables"));
  const waiting = Math.max(0, numberFrom(summary, "waiting_tables"));
  const occupancy = Math.max(0, numberFrom(summary, "occupancy_rate"));
  const stats = [
    { label: copy.available, tone: "primary" as Tone, value: available },
    { label: copy.occupied, tone: "rose" as Tone, value: occupied },
    { label: copy.waiting, tone: "amber" as Tone, value: waiting }
  ];

  return (
    <Card className="dashboard-card dashboard-table-status-card overflow-hidden">
      <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
        <div>
          <CardTitle className="text-sm font-semibold">{copy.tableStatus}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{formatNumber(total)} {copy.tables}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <ProgressRow
            label={copy.occupancy}
            percent={occupancy}
            subValue={`${formatNumber(occupied)} / ${formatNumber(total)} ${copy.tables}`}
            tone="primary"
            value={formatPercent(occupancy)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 rounded-lg border border-border bg-card p-3">
              <p className={cn("font-mono text-xl font-semibold", toneClasses[stat.tone].text)}>
                {formatNumber(stat.value)}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCardsPanel({ copy, insights, productSummary }: { copy: DashboardCopy; insights: Row; productSummary: Row }) {
  const bestProduct = asRow(insights.best_selling_product);
  const watchProduct = asRow(insights.watch_product);
  const cancelledBill = asRow(insights.cancelled_bill);
  const lowestProduct = asRow(productSummary.lowest_selling_product);
  const cards = [
    {
      className: "border-primary/20 bg-primary/10 text-primary",
      label: copy.bestProduct,
      name: text(bestProduct.prod_name),
      value: `${formatNumber(numberFrom(bestProduct, "qty_total"))} ${copy.productsSold} / ${formatKip(numberFrom(bestProduct, "revenue_total"))}`
    },
    {
      className: "border-primary/20 bg-muted text-muted-foreground",
      label: copy.watchProduct,
      name: text(watchProduct.prod_name, text(lowestProduct.prod_name)),
      value: `${formatNumber(numberFrom(watchProduct, "qty_total") || numberFrom(lowestProduct, "qty_total"))} ${copy.productsSold}`
    },
    {
      className: "border-destructive/25 bg-destructive/10 text-destructive",
      label: copy.cancellations,
      name: `${formatNumber(numberFrom(cancelledBill, "count"))} ${copy.orders}`,
      value: formatKip(numberFrom(cancelledBill, "total"))
    }
  ];

  return (
    <Card className="dashboard-card dashboard-insight-card overflow-hidden">
      <CardHeader className="dashboard-card-header border-b px-4 py-3">
        <CardTitle className="text-sm font-semibold">{copy.insights}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4">
        {cards.map((card) => (
          <div key={card.label} className={cn("dashboard-insight-tile rounded-lg border p-4", card.className)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{card.label}</p>
            <p className="mt-2 truncate text-lg font-semibold text-foreground">{card.name}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{card.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export const DashboardOperationsGrid = memo(function DashboardOperationsGrid({
  channelRows,
  copy,
  insights,
  productSummary,
  tableSummary
}: {
  channelRows: BreakdownRow[];
  copy: DashboardCopy;
  insights: Row;
  productSummary: Row;
  tableSummary: Row;
}) {
  return (
    <div className="dashboard-operations-grid grid gap-4 xl:grid-cols-3">
      <ChannelDonutPanel copy={copy} rows={channelRows} />
      <TableStatusPanel copy={copy} summary={tableSummary} />
      <InsightCardsPanel copy={copy} insights={insights} productSummary={productSummary} />
    </div>
  );
});

function ProductsTablePanel({
  copy,
  loading,
  onTopChange,
  products,
  top,
  topOptions
}: {
  copy: DashboardCopy;
  loading: boolean;
  onTopChange: (value: string) => void;
  products: ProductRow[];
  top: string;
  topOptions: SelectOption[];
}) {
  const [sortMode, setSortMode] = useState<"qty" | "revenue">("qty");
  const sortedProducts = useMemo(
    () => [...products].sort((left, right) => sortMode === "qty" ? right.qty - left.qty : right.revenue - left.revenue),
    [products, sortMode]
  );

  return (
    <Card className="dashboard-card dashboard-products-card overflow-hidden">
      <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-semibold">{copy.topProducts}</CardTitle>
          <p className="mt-1 truncate text-xs text-muted-foreground">{products.length} {copy.products}</p>
        </div>
        <div className="dashboard-products-actions flex shrink-0 items-center gap-2">
          <div className="dashboard-chart-tabs">
            <Button size="sm" type="button" variant={sortMode === "qty" ? "outline" : "ghost"} onClick={() => setSortMode("qty")}>{copy.byQty}</Button>
            <Button size="sm" type="button" variant={sortMode === "revenue" ? "outline" : "ghost"} onClick={() => setSortMode("revenue")}>{copy.byRevenue}</Button>
          </div>
          <div className="w-28 shrink-0">
            <Select disabled={loading} value={top} onValueChange={onTopChange}>
              <SelectTrigger className="h-8 w-full font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  {topOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sortedProducts.length ? (
          <div className="dashboard-table-wrap overflow-x-auto">
            <Table className="dashboard-products-table min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{copy.products}</TableHead>
                  <TableHead className="text-right">{copy.productsSold}</TableHead>
                  <TableHead className="text-right">{copy.revenue}</TableHead>
                  <TableHead className="w-44">{copy.shareOfQty}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((product, index) => (
                  <TableRow key={`${product.key}-${index}`}>
                    <TableCell className={cn("font-mono font-semibold text-muted-foreground", index < 3 && "text-primary")}>#{product.rank}</TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <span className="truncate font-semibold">{product.name}</span>
                        {product.size ? <Badge className="ml-2">{product.size}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(product.qty)}</TableCell>
                    <TableCell className="text-right font-mono">{formatKip(product.revenue)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <ProgressBar percent={product.percent} tone={index < 3 ? "primary" : index < 6 ? "sky" : "amber"} />
                        </div>
                        <span className="w-9 text-right font-mono text-xs text-muted-foreground">{formatNumber(product.percent)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
    </Card>
  );
}

function ParetoPanel({ copy, products }: { copy: DashboardCopy; products: ProductRow[] }) {
  const [metric, setMetric] = useState<"qty" | "revenue">("revenue");
  const data = useMemo(() => {
    const valueKey = metric === "revenue" ? "revenue" : "qty";
    const sorted = [...products].sort((a, b) => b[valueKey] - a[valueKey]);
    const total = sorted.reduce((sum, product) => sum + product[valueKey], 0) || 1;
    let cumulative = 0;

    return sorted.map((product) => {
      cumulative += product[valueKey];
      return {
        ...product,
        cumulativePercent: (cumulative / total) * 100,
        label: product.size ? `${product.name} (${product.size})` : product.name
      };
    });
  }, [metric, products]);
  const thresholdCount = data.findIndex((product) => product.cumulativePercent >= 80) + 1 || data.length;
  const metricValue = (product: ProductRow) => metric === "revenue" ? product.revenue : product.qty;
  const metricFormatter = metric === "revenue" ? formatKip : formatNumber;
  const totalMetric = data.reduce((sum, item) => sum + metricValue(item), 0);
  const topTwoShare = data.slice(0, 2).reduce((sum, product) => sum + metricValue(product), 0) / Math.max(1, totalMetric) * 100;
  const config = {
    value: { label: metric === "revenue" ? copy.revenue : copy.qty, color: "hsl(var(--primary))" },
    cumulativePercent: { label: copy.cumulativePercent, color: "hsl(38 92% 50%)" }
  } satisfies ChartConfig;

  return (
    <Card className="dashboard-card dashboard-pareto-card overflow-hidden">
      <CardHeader className="dashboard-card-header border-b px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold">{copy.pareto}</CardTitle>
          <p className="text-xs text-muted-foreground">{copy.paretoHint}</p>
        </div>
        <div className="dashboard-chart-tabs">
          <Button size="sm" type="button" variant={metric === "revenue" ? "outline" : "ghost"} onClick={() => setMetric("revenue")}>{copy.revenue}</Button>
          <Button size="sm" type="button" variant={metric === "qty" ? "outline" : "ghost"} onClick={() => setMetric("qty")}>{copy.qty}</Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {data.length ? (
          <>
            <ChartContainer config={config} className="dashboard-pareto-chart h-[18rem] w-full">
              <ComposedChart data={data} margin={{ bottom: 48, left: 0, right: 0, top: 16 }}>
                <CartesianGrid vertical={false} strokeDasharray="2 4" />
                <XAxis dataKey="label" angle={-30} textAnchor="end" height={62} interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="money" axisLine={false} tickLine={false} tickFormatter={metric === "revenue" ? formatCompactKip : formatNumber} width={42} />
                <YAxis yAxisId="percent" orientation="right" axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={36} />
                <Tooltip content={<ChartTooltipContent valueFormatter={(value, name) => name === copy.cumulativePercent ? `${formatNumber(value, 1)}%` : metricFormatter(value)} />} />
                <Bar yAxisId="money" dataKey={metric === "revenue" ? "revenue" : "qty"} fill="var(--color-value)" radius={[2, 2, 0, 0]} />
                <Line yAxisId="percent" dataKey="cumulativePercent" type="monotone" stroke="var(--color-cumulativePercent)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartContainer>
            <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3">
              <MiniFact label={copy.driveRevenue} title={`${formatNumber(thresholdCount)} ${copy.products}`} value="80%" />
              <MiniFact label={copy.topShare} title={formatPercent(topTwoShare)} value={data.slice(0, 2).map((item) => item.name).join(" + ")} />
              <MiniFact label={copy.trackedTotal} title={metricFormatter(totalMetric)} value={copy.topProducts} />
            </div>
          </>
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
    </Card>
  );
}

export const DashboardProductsParetoGrid = memo(function DashboardProductsParetoGrid({
  copy,
  loading,
  onTopChange,
  products,
  top,
  topOptions
}: {
  copy: DashboardCopy;
  loading: boolean;
  onTopChange: (value: string) => void;
  products: ProductRow[];
  top: string;
  topOptions: SelectOption[];
}) {
  return (
    <div className="dashboard-products-grid grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <ProductsTablePanel copy={copy} loading={loading} products={products} top={top} topOptions={topOptions} onTopChange={onTopChange} />
      <ParetoPanel copy={copy} products={products} />
    </div>
  );
});

export const DashboardFooter = memo(function DashboardFooter({
  activeBranchUuid,
  copy,
  filtersMeta,
  requestParams
}: {
  activeBranchUuid: string;
  copy: DashboardCopy;
  filtersMeta: Row;
  requestParams: Row;
}) {
  const cutoff = numberFrom(filtersMeta, "business_cutoff_hour");
  const details = [
    cutoff ? `${copy.cutoff} ${cutoff}:00` : "",
    text(requestParams.summary_range, ""),
    text(requestParams.report_month, "")
  ].filter(Boolean);

  return (
    <div className="dashboard-footer flex flex-wrap justify-between gap-2 pt-2 text-xs text-muted-foreground">
      {activeBranchUuid ? <span>{copy.branch} <span className="font-mono">{activeBranchUuid}</span></span> : null}
      {details.length ? <span className="font-mono">{details.join(" / ")}</span> : null}
    </div>
  );
});
