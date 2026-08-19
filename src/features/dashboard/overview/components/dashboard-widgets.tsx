"use client";

import { memo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Code2,
  Copy,
  CreditCard,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ReportDateInput } from "@/features/report/shared/report-date-input";
import type {
  DashboardFilters,
  DashboardWarning,
  PaymentSummary,
  PaymentSummaryCard,
  Row,
  SelectOption,
  TrendPoint,
} from "@/features/dashboard/overview/dashboard-view-model";
import {
  asRow,
  formatKip,
  formatNumber,
  formatPercent,
  numberFrom,
  text,
} from "@/features/dashboard/overview/dashboard-view-model";

export type DashboardCopy = Record<string, string>;

const paymentSummaryIconMap = {
  cash: Banknote,
  debt: WalletCards,
  payment_total: ReceiptText,
  transfer: CreditCard,
};
const moneyUnits = new Set(["k", "kip", "kib", "lak", "₭", "ກີບ"]);

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
  onPeriodMonthChange: (value: string) => void;
  onPeriodTypeChange: (value: string) => void;
  onPeriodYearChange: (value: string) => void;
  onReset: () => void;
  periodTypeOptions: SelectOption[];
  yearOptions: SelectOption[];
};

const SelectControl = memo(function SelectControl({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) {
  return (
    <Field className="min-h-[3.4rem] min-w-0 gap-0.5 rounded-[0.55rem] border border-border bg-muted/35 px-2.5 pb-1 pt-1.5 hover:border-border/90 dark:bg-muted/42">
      <FieldLabel className="text-[11px] font-bold text-muted-foreground">
        {label}
      </FieldLabel>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-full min-w-0 border-transparent bg-transparent px-0 font-mono text-[13px] font-semibold shadow-none hover:bg-transparent data-[state=open]:bg-transparent max-md:min-h-[2.35rem]">
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

const DateControl = memo(function DateControl({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field className="min-h-[3.4rem] min-w-0 gap-0.5 rounded-[0.55rem] border border-border bg-muted/35 px-2.5 pb-1 pt-1.5 hover:border-border/90 dark:bg-muted/42">
      <FieldLabel
        className="text-[11px] font-bold text-muted-foreground"
        htmlFor={name}
      >
        {label}
      </FieldLabel>
      <ReportDateInput
        id={name}
        name={name}
        label={label}
        value={value}
        className="h-7 border-transparent bg-transparent px-0 font-mono text-[13px] font-semibold shadow-none hover:bg-transparent max-md:min-h-[2.35rem]"
        onValueChange={onChange}
      />
    </Field>
  );
});

function isMoneyUnit(unit: string) {
  return moneyUnits.has(unit.trim().toLowerCase());
}

function formatApiMoney(value: unknown, unit: string) {
  if (!unit || isMoneyUnit(unit)) return formatKip(value);
  return `${formatNumber(value)} ${unit}`;
}

function SparkPreview({
  primary,
  values,
}: {
  primary?: boolean;
  values: number[];
}) {
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
    <svg
      aria-hidden
      className={cn(
        "dashboard-spark dashboard-spark-line",
        primary && "dashboard-spark-line-primary",
      )}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export const DashboardHeader = memo(function DashboardHeader({
  copy,
  filtersMeta,
  section,
}: {
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
  const metaItems = [
    businessStart && businessEnd ? `${businessStart} - ${businessEnd}` : "",
    [rangeMode, rangeDays ? `${formatNumber(rangeDays)} ${copy.days}` : ""]
      .filter(Boolean)
      .join(" "),
    updatedAt,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-0.5">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold leading-tight tracking-normal md:text-[1.65rem]">
          {sectionTitle}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          {metaItems.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={index === 1 ? "tabular-nums text-foreground" : undefined}
            >
              {index ? (
                <span className="mr-2 text-muted-foreground">·</span>
              ) : null}
              {item}
            </span>
          ))}
        </div>
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
  onPeriodMonthChange,
  onPeriodTypeChange,
  onPeriodYearChange,
  onReset,
  periodTypeOptions,
  yearOptions,
}: FilterBarProps) {
  return (
    <Card className="@container/dashboard-filter z-[15] rounded-xl border-border bg-card/94 shadow-md backdrop-blur-md">
      <CardContent className="grid grid-cols-[minmax(0,1fr)_max-content] max-md:grid-cols-1 items-end gap-2.5 max-md:gap-2 p-1.5">
        <div
          className={cn(
            "grid min-w-0 items-stretch gap-2 max-md:grid-cols-1 grid-cols-[minmax(11rem,1.25fr)_minmax(8.5rem,0.85fr)_repeat(2,minmax(9.5rem,1fr))]",
            filters.periodType === "yearly" &&
              "grid-cols-[minmax(11rem,1.25fr)_minmax(8.5rem,0.85fr)_minmax(8.5rem,0.85fr)]",
          )}
          data-period-type={filters.periodType}
        >
          <SelectControl
            disabled={branchLoading || !branchOptions.length}
            label={copy.branch}
            options={branchOptions}
            value={activeBranchUuid}
            onChange={onBranchChange}
          />
          <SelectControl
            label={copy.periodType}
            options={periodTypeOptions}
            value={filters.periodType}
            onChange={onPeriodTypeChange}
          />
          {filters.periodType === "daily" ? (
            <>
              <DateControl
                label={copy.startDate}
                name="dashboard-start-date"
                value={filters.start_date}
                onChange={(value) => onFilterChange({ start_date: value })}
              />
              <DateControl
                label={copy.endDate}
                name="dashboard-end-date"
                value={filters.end_date}
                onChange={(value) => onFilterChange({ end_date: value })}
              />
            </>
          ) : null}
          {filters.periodType === "monthly" ? (
            <>
              <SelectControl
                label={copy.year}
                options={yearOptions}
                value={String(filters.periodYear)}
                onChange={(value) => onPeriodYearChange(value)}
              />
              <SelectControl
                label={copy.month}
                options={monthOptions}
                value={String(filters.periodMonth)}
                onChange={(value) => onPeriodMonthChange(value)}
              />
            </>
          ) : null}
          {filters.periodType === "yearly" ? (
            <SelectControl
              label={copy.year}
              options={yearOptions}
              value={String(filters.periodYear)}
              onChange={(value) => onPeriodYearChange(value)}
            />
          ) : null}
        </div>
        <div className="flex min-w-max self-center justify-end gap-2 max-md:justify-stretch *:whitespace-nowrap max-md:*:flex-1 max-md:*:w-full">
          <Button
            type="button"
            variant="outline"
            className="max-md:min-h-[2.35rem]"
            onClick={onReset}
          >
            {copy.reset}
          </Button>
          <Button
            type="button"
            disabled={loading || !activeBranchUuid}
            className="max-md:min-h-[2.35rem]"
            onClick={onApply}
          >
            {copy.apply}
            {loading ? (
              <RefreshCcw className="animate-spin" data-icon="inline-end" />
            ) : (
              <Search data-icon="inline-end" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

function paymentSummaryTone(card: PaymentSummaryCard) {
  const key = card.key.toLowerCase();

  if (card.important || key.includes("payment_total") || key.includes("total"))
    return "dashboard-payment-card-total";
  if (key.includes("debt") || key.includes("balance"))
    return "dashboard-payment-card-debt";
  if (key.includes("transfer")) return "dashboard-payment-card-transfer";
  return "dashboard-payment-card-cash";
}

function paymentSummaryIcon(card: PaymentSummaryCard) {
  const key = card.key.toLowerCase();
  if (card.important || key.includes("payment_total") || key.includes("total"))
    return paymentSummaryIconMap.payment_total;
  if (key.includes("debt") || key.includes("balance"))
    return paymentSummaryIconMap.debt;
  if (key.includes("transfer")) return paymentSummaryIconMap.transfer;
  return paymentSummaryIconMap.cash;
}

function warningMessage(copy: DashboardCopy, warning: DashboardWarning) {
  return warning.copyKey && copy[warning.copyKey]
    ? copy[warning.copyKey]
    : warning.value;
}

export const DashboardPaymentSummaryStrip = memo(
  function DashboardPaymentSummaryStrip({
    cards,
    copy,
    paymentSummary,
    warnings = [],
  }: {
    cards: PaymentSummaryCard[];
    copy: DashboardCopy;
    paymentSummary: PaymentSummary;
    warnings?: DashboardWarning[];
  }) {
    const mixedWarning =
      !paymentSummary.hasMixedSplitColumns &&
      (paymentSummary.mixedTotal > 0 ||
        paymentSummary.unallocatedMixedTotal > 0)
        ? copy.paymentSplitWarning
        : "";
    const warningMessages = warnings
      .map((warning) => warningMessage(copy, warning))
      .filter((message) => message && message !== mixedWarning);
    const mixedDetails = [
      paymentSummary.mixedTotal
        ? `${copy.mixedPayment}: ${formatKip(paymentSummary.mixedTotal)}`
        : "",
      paymentSummary.unallocatedMixedTotal
        ? `${copy.unallocatedMixedPayment}: ${formatKip(
            paymentSummary.unallocatedMixedTotal,
          )}`
        : "",
    ].filter(Boolean);
    const messages = [mixedWarning, ...warningMessages].filter(Boolean);

    if (!cards.length && !mixedDetails.length && !messages.length) return null;

    return (
      <div className="dashboard-payment-summary-stack">
        <div
          aria-label={copy.paymentSplit}
          className="grid grid-cols-1 overflow-hidden rounded-xl border border-border md:flex"
        >
          {cards.map((card, index) => {
            const Icon = paymentSummaryIcon(card);
            const isLastItem = index === cards.length - 1;

            return (
              <div
                key={card.key}
                className={cn(
                  "flex-1 min-w-0",
                  paymentSummaryTone(card),
                  !isLastItem &&
                    "border-b border-border md:border-b-0 md:border-r",
                )}
              >
                <CardContent className="dashboard-payment-card-content">
                  <div
                    className="dashboard-payment-card-icon"
                    aria-hidden="true"
                  >
                    <Icon />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-muted-foreground">
                      {card.label}
                    </p>
                    <p
                      className={cn(
                        "mt-1 wrap-break-word font-mono font-semibold leading-tight",
                        card.important ? "text-2xl" : "text-xl",
                      )}
                    >
                      {formatKip(card.value)}
                    </p>
                  </div>
                </CardContent>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);

export const ErrorBanner = memo(function ErrorBanner({
  message,
}: {
  message: string;
}) {
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
  requestParams,
}: {
  activeBranchUuid: string;
  copy: DashboardCopy;
  requestParams: Row;
}) {
  const [copied, setCopied] = useState(false);
  const params = [
    ["branch_uuid_fk", text(requestParams.branch_uuid_fk, activeBranchUuid)],
    ["start_date", text(requestParams.start_date, "")],
    ["end_date", text(requestParams.end_date, "")],
    ["lang", text(requestParams.lang, "")],
    ["top", text(requestParams.top, "")],
  ].filter(([, value]) => value);
  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  async function copyQuery() {
    await navigator.clipboard?.writeText(
      `/api/v1/dashboard/executive?${query}`,
    );
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
          <div
            key={key}
            className="dashboard-query-kv flex shrink-0 items-baseline gap-2 border-r border-dashed border-border px-2 last:border-r-0"
          >
            <span className="font-bold uppercase tracking-wide text-muted-foreground">
              {key}
            </span>
            <span
              className={cn(
                "font-mono font-semibold",
                key === "branch_uuid_fk" && "text-primary",
              )}
            >
              {value || "-"}
            </span>
          </div>
        ))}
        <Button
          className="ml-auto shrink-0"
          size="sm"
          variant="outline"
          type="button"
          onClick={copyQuery}
        >
          <Copy data-icon="inline-start" />
          {copied ? copy.copied : copy.copyQuery}
        </Button>
      </CardContent>
    </Card>
  );
});

export const DashboardWarningBanner = memo(function DashboardWarningBanner({
  copy,
  warnings,
}: {
  copy: DashboardCopy;
  warnings: DashboardWarning[];
}) {
  if (!warnings.length) return null;

  return (
    <Alert className="dashboard-warning-banner border-amber-500/30 bg-amber-500/10 text-amber-700">
      <AlertTriangle />
      <AlertTitle className="font-black">{copy.warnings}</AlertTitle>
      <AlertDescription className="dashboard-warning-body flex flex-col gap-1 text-foreground">
        {warnings.map((warning) => (
          <span key={warning.key}>{warningMessage(copy, warning)}</span>
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
  trendRows,
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
  const cancelledCount =
    numberFrom(cancellationSummary, "cancelled_orders_count") ||
    numberFrom(kpis, "cancelled_orders_count");
  const cancelledTotal =
    numberFrom(cancellationSummary, "cancelled_orders_total") ||
    numberFrom(kpis, "cancelled_total") ||
    numberFrom(kpis, "cancelled_amount_total");
  const metrics = [
    {
      detail: text(mainTotal.sub_label, periodLabel),
      label: text(mainTotal.label, copy.revenue),
      primary: true,
      sparkValues: trendRows.slice(-12).map((row) => row.revenue),
      value: formatApiMoney(
        numberFrom(mainTotal, "value") || numberFrom(kpis, "revenue_total"),
        mainUnit,
      ),
    },
    {
      detail: copy.totalBills,
      label: copy.orders,
      sparkValues: trendRows.slice(-12).map((row) => row.orders),
      value: formatNumber(
        numberFrom(paymentSummary, "orders_count") ||
          numberFrom(kpis, "orders_count"),
      ),
    },
    {
      detail: copy.avgBill,
      label: copy.avgBill,
      sparkValues: trendRows
        .slice(-12)
        .map((row) => (row.orders ? row.revenue / row.orders : 0)),
      value: formatKip(numberFrom(kpis, "avg_bill")),
    },
    {
      detail: `${copy.discountRate}: ${formatPercent(
        numberFrom(kpis, "discount_rate"),
      )}`,
      label: copy.discount,
      value: formatKip(numberFrom(kpis, "discount_total")),
    },
    {
      detail: `${copy.collectionRate}: ${formatPercent(
        numberFrom(kpis, "collection_rate"),
      )}`,
      label: copy.paidTotal,
      value: formatKip(numberFrom(kpis, "paid_total")),
    },
    {
      detail: `${copy.unpaidRate}: ${formatPercent(
        numberFrom(kpis, "unpaid_rate"),
      )}`,
      label: copy.balance,
      rose: true,
      value: formatKip(numberFrom(kpis, "balance_total")),
    },
    {
      detail: `${copy.cancelRate}: ${formatPercent(
        numberFrom(kpis, "cancel_rate"),
      )}`,
      label: copy.cancellations,
      rose: true,
      value: `${formatNumber(cancelledCount)} / ${formatKip(cancelledTotal)}`,
    },
  ];

  return (
    <Card className="dashboard-hero-card overflow-hidden">
      <div className="dashboard-hero-grid grid md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "dashboard-hero-kpi min-w-0 p-4",
              metric.primary &&
                "dashboard-hero-kpi-primary relative overflow-hidden bg-primary text-primary-foreground xl:row-span-2",
              !metric.primary && "bg-card",
            )}
          >
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.12em]",
                metric.primary
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              {metric.label}
            </p>
            <p
              className={cn(
                "mt-2 truncate font-mono text-2xl font-semibold",
                metric.rose && "text-destructive",
              )}
            >
              {metric.value}
            </p>
            <p
              className={cn(
                "mt-2 truncate text-xs",
                metric.primary
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              {metric.detail}
            </p>
            {metric.sparkValues ? (
              <SparkPreview
                primary={metric.primary}
                values={metric.sparkValues}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
});

type DashboardChartFallbackVariant = "operations" | "products" | "revenue";

function DashboardChartFallbackCard({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <Card className={cn("dashboard-card overflow-hidden", className)}>
      <CardHeader className="dashboard-card-header border-b px-4 py-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-48" />
      </CardHeader>
      <CardContent className="flex min-h-64 flex-col gap-3 p-4">
        <Skeleton className="h-40 w-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardChartGridFallback({
  variant,
}: {
  variant: DashboardChartFallbackVariant;
}) {
  if (variant === "revenue") {
    return (
      <div className="dashboard-revenue-grid grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <DashboardChartFallbackCard />
        <DashboardChartFallbackCard rows={5} />
      </div>
    );
  }

  if (variant === "operations") {
    return (
      <div className="dashboard-operations-grid grid gap-4 xl:grid-cols-3">
        <DashboardChartFallbackCard rows={3} />
        <DashboardChartFallbackCard rows={3} />
        <DashboardChartFallbackCard rows={3} />
      </div>
    );
  }

  return (
    <div className="dashboard-products-grid grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <DashboardChartFallbackCard rows={6} />
      <DashboardChartFallbackCard rows={3} />
    </div>
  );
}

export const DashboardFooter = memo(function DashboardFooter({}: {
  activeBranchUuid: string;
  copy: DashboardCopy;
  filtersMeta: Row;
  requestParams: Row;
}) {
  return (
    <div className="dashboard-footer flex flex-wrap justify-between gap-2 pt-2 text-xs text-muted-foreground">
      {/* {activeBranchUuid ? <span>{copy.branch} <span className="font-mono">{activeBranchUuid}</span></span> : null} */}
      {/* {details.length ? <span className="font-mono">{details.join(" / ")}</span> : null} */}
    </div>
  );
});
