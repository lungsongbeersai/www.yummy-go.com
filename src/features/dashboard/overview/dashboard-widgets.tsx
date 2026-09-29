"use client";

import { memo } from "react";
import {
  AlertTriangle,
  BadgePercent,
  CalendarDays,
  Calculator,
  HandCoins,
  ReceiptText,
  RotateCcw,
  Search,
  TrendingUp,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { ReportDateInput } from "@/features/report/shared/report-date-input";
import type {
  DashboardFilters,
  DashboardWarning,
  Row,
  SelectOption,
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

const moneyUnits = new Set(["k", "kip", "kib", "lak", "₭", "ກີບ"]);

function formatApiMoney(value: unknown, unit: string) {
  if (!unit || moneyUnits.has(unit.trim().toLowerCase())) return formatKip(value);
  return `${formatNumber(value)} ${unit}`;
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
  const updatedAt = text(filtersMeta.updated_at, "");
  const range = businessStart && businessEnd
    ? businessStart === businessEnd ? businessStart : `${businessStart} – ${businessEnd}`
    : "";
  const meta = [range, updatedAt].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">{text(section.section_name, copy.title)}</h1>
      {meta ? <p className="text-sm text-muted-foreground tabular-nums">{meta}</p> : null}
    </div>
  );
});

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
  onPeriodMonthEndChange: (value: string) => void;
  onPeriodTypeChange: (value: string) => void;
  onPeriodYearChange: (value: string) => void;
  onPeriodYearEndChange: (value: string) => void;
  onReset: () => void;
  periodTypeOptions: SelectOption[];
  yearOptions: SelectOption[];
};

function SelectField({
  className,
  disabled,
  id,
  label,
  onChange,
  options,
  value,
}: {
  className?: string;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) {
  return (
    <Field className={cn("sm:w-40", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
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
}

function DateField({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field className="sm:w-40">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ReportDateInput id={id} name={id} label={label} value={value} onValueChange={onChange} />
    </Field>
  );
}

// One toolbar row: scope (branch) → period granularity → the period itself → apply.
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
  onPeriodMonthEndChange,
  onPeriodTypeChange,
  onPeriodYearChange,
  onPeriodYearEndChange,
  onReset,
  periodTypeOptions,
  yearOptions,
}: FilterBarProps) {
  return (
    <Card size="sm">
      {/* Phones: a 2-column grid so paired fields (dates, year/month) share a row and the
          KPIs below stay close to the first screen. sm+: one wrapping toolbar row. */}
      <CardContent className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Field className="col-span-2 sm:w-56">
          <FieldLabel htmlFor="dashboard-branch">{copy.branch}</FieldLabel>
          <Select
            disabled={branchLoading || !branchOptions.length}
            value={activeBranchUuid}
            onValueChange={onBranchChange}
          >
            <SelectTrigger id="dashboard-branch">
              <SelectValue placeholder={copy.branch} />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                {branchOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field className="col-span-2 sm:w-auto">
          <FieldLabel id="dashboard-period-type">{copy.periodType}</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            aria-labelledby="dashboard-period-type"
            value={filters.periodType}
            onValueChange={(value) => {
              if (value) onPeriodTypeChange(value);
            }}
          >
            {periodTypeOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        {filters.periodType === "daily" ? (
          <>
            <DateField
              id="dashboard-start-date"
              label={copy.startDate}
              value={filters.start_date}
              onChange={(value) => onFilterChange({ start_date: value })}
            />
            <DateField
              id="dashboard-end-date"
              label={copy.endDate}
              value={filters.end_date}
              onChange={(value) => onFilterChange({ end_date: value })}
            />
          </>
        ) : null}
        {/* Monthly: pick the year first, then the month range inside it. */}
        {filters.periodType === "monthly" ? (
          <>
            <SelectField
              id="dashboard-year"
              label={copy.year}
              className="col-span-2"
              options={yearOptions}
              value={String(filters.periodYear)}
              onChange={onPeriodYearChange}
            />
            <SelectField
              id="dashboard-month-from"
              label={copy.monthFrom}
              options={monthOptions}
              value={String(filters.periodMonth)}
              onChange={onPeriodMonthChange}
            />
            {/* Only months from the start onwards, so the range cannot be picked backwards. */}
            <SelectField
              id="dashboard-month-to"
              label={copy.monthTo}
              options={monthOptions.filter((option) => Number(option.value) >= filters.periodMonth)}
              value={String(filters.periodMonthEnd)}
              onChange={onPeriodMonthEndChange}
            />
          </>
        ) : null}
        {filters.periodType === "yearly" ? (
          <>
            <SelectField
              id="dashboard-year-from"
              label={copy.yearFrom}
              options={yearOptions}
              value={String(filters.periodYear)}
              onChange={onPeriodYearChange}
            />
            <SelectField
              id="dashboard-year-to"
              label={copy.yearTo}
              options={yearOptions.filter((option) => Number(option.value) >= filters.periodYear)}
              value={String(filters.periodYearEnd)}
              onChange={onPeriodYearEndChange}
            />
          </>
        ) : null}
        <div className="col-span-2 flex gap-2 sm:ml-auto">
          <Button type="button" variant="outline" className="max-sm:flex-1" onClick={onReset}>
            <RotateCcw data-icon="inline-start" />
            {copy.reset}
          </Button>
          <Button
            type="button"
            className="max-sm:flex-1"
            disabled={loading || !activeBranchUuid}
            onClick={onApply}
          >
            {loading ? <Spinner data-icon="inline-start" /> : <Search data-icon="inline-start" />}
            {copy.apply}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// Accent per metric: a soft wash of the tone behind the card (fading to the card colour, so
// values stay readable in text tokens) plus a stronger icon tile. Class names are listed in
// full so Tailwind can see them.
const kpiTones = {
  destructive: {
    card: "bg-linear-to-br from-destructive/15 via-destructive/5 to-card",
    icon: "bg-destructive/15 text-destructive",
  },
  info: {
    card: "bg-linear-to-br from-info/20 via-info/5 to-card",
    icon: "bg-info/20 text-info-text",
  },
  muted: {
    card: "bg-linear-to-br from-muted via-muted/40 to-card",
    icon: "bg-muted text-muted-foreground",
  },
  primary: {
    card: "bg-linear-to-br from-primary/15 via-primary/5 to-card",
    icon: "bg-primary/15 text-primary-text",
  },
  warning: {
    card: "bg-linear-to-br from-warning/20 via-warning/5 to-card",
    icon: "bg-warning/20 text-warning-text",
  },
} as const;

function KpiCard({
  badge,
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  badge?: string;
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: keyof typeof kpiTones;
  value: string;
}) {
  return (
    <Card className={cn("@container/kpi", kpiTones[tone].card)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-lg", kpiTones[tone].icon)}>
            <Icon className="size-4" />
          </span>
        </CardAction>
        {/* Size follows the card's own width: money values are long and the cards are narrow. */}
        <CardTitle className="truncate text-xl font-semibold tabular-nums @[16rem]/kpi:text-2xl" title={value}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="mt-auto flex-wrap justify-between gap-2 text-muted-foreground tabular-nums">
        <span className="truncate">{detail}</span>
        {badge ? <Badge variant="secondary">{badge}</Badge> : null}
      </CardFooter>
    </Card>
  );
}

// The headline number gets the only filled card on the page, so the eye lands on it first:
// what was sold, and how much of it is actually in hand.
function RevenueHeroCard({
  balance,
  collectionRate,
  copy,
  label,
  paid,
  period,
  unpaidRate,
  value,
}: {
  balance: number;
  collectionRate: number;
  copy: DashboardCopy;
  label: string;
  paid: number;
  period: string;
  unpaidRate: number;
  value: string;
}) {
  return (
    <Card className="@container/hero bg-linear-to-br from-primary to-primary/80 text-primary-foreground ring-0 sm:col-span-2 lg:row-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary-foreground/85">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
            <TrendingUp className="size-4" />
          </span>
          {label}
        </CardTitle>
        {period ? (
          <CardAction>
            <Badge variant="secondary" className="tabular-nums">
              <CalendarDays data-icon="inline-start" />
              {period}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end gap-5">
        <p
          className="truncate text-3xl font-semibold tracking-tight tabular-nums @[24rem]/hero:text-4xl @[36rem]/hero:text-5xl"
          title={value}
        >
          {value}
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-primary-foreground/85">
            <span>{copy.collectionRate}</span>
            <span className="font-medium text-primary-foreground tabular-nums">{formatPercent(collectionRate)}</span>
          </div>
          {/* Decorative: the percentage is printed right above it. */}
          <Progress
            value={Math.min(100, Math.max(0, collectionRate))}
            aria-hidden="true"
            className="h-2 bg-primary-foreground/20 *:data-[slot=progress-indicator]:bg-primary-foreground"
          />
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-4 border-t border-primary-foreground/20">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-primary-foreground/85">
            <HandCoins aria-hidden="true" className="size-3.5" />
            {copy.paidTotal}
          </span>
          <span className="truncate text-base font-semibold tabular-nums">{formatKip(paid)}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-primary-foreground/85">
            <Wallet aria-hidden="true" className="size-3.5" />
            {copy.balance} · {formatPercent(unpaidRate)}
          </span>
          <span className="truncate text-base font-semibold tabular-nums">{formatKip(balance)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

// Hero (sales + collection) on the left, the four numbers that explain it on the right.
export const DashboardKpiGrid = memo(function DashboardKpiGrid({
  copy,
  kpis,
  periodLabel,
  section,
}: {
  copy: DashboardCopy;
  kpis: Row;
  periodLabel: string;
  section: Row;
}) {
  const mainTotal = asRow(section.main_total);
  const paymentSummary = asRow(section.payment_summary);
  const cancellationSummary = asRow(section.cancellation_summary);
  const orders = numberFrom(paymentSummary, "orders_count") || numberFrom(kpis, "orders_count");
  const cancelledCount =
    numberFrom(cancellationSummary, "cancelled_orders_count") ||
    numberFrom(kpis, "cancelled_orders_count");
  const cancelledTotal =
    numberFrom(cancellationSummary, "cancelled_orders_total") ||
    numberFrom(kpis, "cancelled_total") ||
    numberFrom(kpis, "cancelled_amount_total");
  const discountTotal = numberFrom(kpis, "discount_total");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <RevenueHeroCard
        balance={numberFrom(kpis, "balance_total")}
        collectionRate={numberFrom(kpis, "collection_rate")}
        copy={copy}
        label={text(mainTotal.label, copy.revenue)}
        paid={numberFrom(kpis, "paid_total")}
        period={text(mainTotal.sub_label, periodLabel)}
        unpaidRate={numberFrom(kpis, "unpaid_rate")}
        value={formatApiMoney(
          numberFrom(mainTotal, "value") || numberFrom(kpis, "revenue_total"),
          text(mainTotal.unit, ""),
        )}
      />
      <KpiCard
        tone="info"
        icon={ReceiptText}
        label={copy.billCount}
        value={`${formatNumber(orders)} ${copy.billUnit}`}
        detail={copy.totalBills}
      />
      <KpiCard
        tone="primary"
        icon={Calculator}
        label={copy.avgBill}
        value={formatKip(numberFrom(kpis, "avg_bill"))}
        detail={`${formatNumber(orders)} ${copy.orders}`}
      />
      <KpiCard
        tone={discountTotal > 0 ? "warning" : "muted"}
        icon={BadgePercent}
        label={copy.discount}
        value={formatKip(discountTotal)}
        detail={copy.discountRate}
        badge={formatPercent(numberFrom(kpis, "discount_rate"))}
      />
      {/* Cancellations only turn red when there is something to look at. */}
      <KpiCard
        tone={cancelledCount > 0 ? "destructive" : "muted"}
        icon={XCircle}
        label={copy.cancellations}
        value={formatKip(cancelledTotal)}
        detail={`${formatNumber(cancelledCount)} ${copy.orders}`}
        badge={`${copy.cancelRate} ${formatPercent(numberFrom(kpis, "cancel_rate"))}`}
      />
    </div>
  );
});

function warningMessage(copy: DashboardCopy, warning: DashboardWarning) {
  return warning.copyKey && copy[warning.copyKey] ? copy[warning.copyKey] : warning.value;
}

export const DashboardAlerts = memo(function DashboardAlerts({
  copy,
  errors,
  warnings,
}: {
  copy: DashboardCopy;
  errors: string[];
  warnings: DashboardWarning[];
}) {
  // The payment-split warning is shown inside the payment methods card, next to the
  // numbers it explains, so it is not repeated here.
  const warningMessages = Array.from(
    new Set(
      warnings
        .filter((warning) => warning.copyKey !== "paymentSplitWarning")
        .map((warning) => warningMessage(copy, warning))
        .filter(Boolean),
    ),
  );

  return (
    <>
      {errors.map((message) => (
        <Alert key={message} variant="destructive">
          <AlertTriangle />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ))}
      {warningMessages.length ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{copy.warnings}</AlertTitle>
          <AlertDescription>
            {warningMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
});

// ---------------------------------------------------------------------------
// Loading skeletons. Each mirrors the real section's Card/grid structure (same
// breakpoints, same header/content/footer slots) so nothing jumps when data lands.

type DashboardChartFallbackVariant = "health" | "products" | "sales";

// Heights below were measured against the rendered dashboard (card header 44px, share
// row 56px, table row 49px, …) so the swap to real content does not shift the page.
function SkeletonCardHeader({ action = false, description = true }: { action?: boolean; description?: boolean }) {
  return (
    <CardHeader className="gap-1.5">
      <Skeleton className="h-5 w-36" />
      {description ? <Skeleton className="h-4 w-52 max-w-full" /> : null}
      {action ? (
        <CardAction>
          <Skeleton className="h-6 w-28" />
        </CardAction>
      ) : null}
    </CardHeader>
  );
}

function ShareRowSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-2 w-full" />
      <div className="flex justify-end">
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <SkeletonCardHeader action />
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-4 w-64 max-w-full" />
        </CardFooter>
      </Card>
      <Card>
        <SkeletonCardHeader />
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex justify-between gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <SkeletonCardHeader action />
        <CardContent className="flex flex-col">
          <div className="flex h-10 items-center gap-3 border-b">
            <Skeleton className="h-3 w-5" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="hidden h-3 w-32 md:block" />
          </div>
          {/* 10 rows = the default "top 10" the table renders. */}
          {Array.from({ length: 10 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 border-b py-2 last:border-b-0">
              <Skeleton className="size-5" />
              <Skeleton className="size-8" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="hidden h-2 w-32 md:block" />
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Skeleton className="h-4 w-72 max-w-full" />
        </CardFooter>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <SkeletonCardHeader />
          <CardContent className="flex items-center gap-4">
            <Skeleton className="size-28 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <SkeletonCardHeader />
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <ShareRowSkeleton key={index} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="grid gap-4">
      <Card>
        <SkeletonCardHeader description={false} />
        <CardContent className="grid gap-2.5 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-md border px-3 py-2.5">
              <Skeleton className="size-10" />
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Also the loading UI for the lazily imported chart sections (next/dynamic `loading`).
export function DashboardChartGridFallback({ variant }: { variant: DashboardChartFallbackVariant }) {
  if (variant === "sales") return <SalesSkeleton />;
  if (variant === "products") return <ProductsSkeleton />;
  return <HealthSkeleton />;
}

function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-7 w-full" />
    </div>
  );
}

// Whole-page skeleton for the first load (and while permissions resolve).
export function DashboardPageSkeleton({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="flex flex-col gap-4">
      <Skeleton className="h-8 w-72 max-w-full" />
      <Card size="sm">
        <CardContent className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <FieldSkeleton className="col-span-2 sm:w-56" />
          <FieldSkeleton className="col-span-2 sm:w-39" />
          <FieldSkeleton className="sm:w-40" />
          <FieldSkeleton className="sm:w-40" />
          <div className="col-span-2 flex gap-2 sm:ml-auto">
            <Skeleton className="h-7 flex-1 sm:w-20 sm:flex-none" />
            <Skeleton className="h-7 flex-1 sm:w-24 sm:flex-none" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="sm:col-span-2 lg:row-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-9" />
              <Skeleton className="h-4 w-28" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-end gap-5">
            <Skeleton className="h-12 w-72 max-w-full" />
            <Skeleton className="h-2 w-full" />
          </CardContent>
          <CardFooter className="grid grid-cols-2 gap-4 border-t">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <CardAction>
                <Skeleton className="size-9" />
              </CardAction>
              <Skeleton className="h-7 w-36 max-w-full" />
            </CardHeader>
            <CardFooter className="justify-between gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
      <SalesSkeleton />
      <ProductsSkeleton />
      <HealthSkeleton />
    </section>
  );
}
