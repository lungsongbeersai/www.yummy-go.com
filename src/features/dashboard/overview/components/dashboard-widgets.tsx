"use client";

import { memo, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BadgePercent,
  CalendarDays,
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  ReceiptText,
  RefreshCw,
  Search,
  Store,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { VisualEffectsTier } from "@/lib/visual-effects-tier";
import { ReportDateInput } from "@/features/report/shared/report-date-input";
import { RevenuePlate, RevenuePlateSkeleton } from "@/features/dashboard/overview/components/dashboard-plate";
import {
  asRow,
  formatApiMoney,
  formatKip,
  formatNumber,
  formatPercent,
  kipFigureSize,
  numberFrom,
  sparklinePath,
  text,
  type DashboardCopy,
  type DashboardFilters,
  type DashboardWarning,
  type Row,
  type SelectOption,
  type SkylineColumn,
} from "@/features/dashboard/overview/dashboard-view-model";

// ---------------------------------------------------------------------------
// Header

export const DashboardHeader = memo(function DashboardHeader({
  branchLabel,
  copy,
  filtersMeta,
  loading,
  onRefresh,
  scopeLoadingLabel,
  section,
}: {
  branchLabel: string;
  copy: DashboardCopy;
  filtersMeta: Row;
  loading: boolean;
  onRefresh: () => void;
  /** Set while a different branch or period is loading, so the dimmed numbers are not read as current. */
  scopeLoadingLabel: string | null;
  section: Row;
}) {
  const { t } = useTranslation();
  const businessStart = text(filtersMeta.business_date_start, "");
  const businessEnd = text(filtersMeta.business_date_end, "");
  const range = businessStart && businessEnd
    ? businessStart === businessEnd ? businessStart : `${businessStart} – ${businessEnd}`
    : "";
  const updatedAt = text(filtersMeta.updated_at, "");

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="font-heading text-xl font-bold text-primary-text sm:text-2xl lg:text-3xl">{text(section.section_name, copy.title)}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {branchLabel ? (
            <Badge variant="outline" className="h-auto gap-1.5 py-1 text-xs">
              <Store data-icon="inline-start" />
              {branchLabel}
            </Badge>
          ) : null}
          {range ? (
            <Badge variant="outline" className="h-auto gap-1.5 py-1 text-xs tabular-nums">
              <CalendarDays data-icon="inline-start" />
              {range}
            </Badge>
          ) : null}
          {scopeLoadingLabel ? (
            <Badge role="status" variant="secondary" className="h-auto gap-1.5 py-1 text-xs">
              <Spinner data-icon="inline-start" />
              {t("dashboard.loadingPeriod", { range: scopeLoadingLabel })}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {updatedAt ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <Clock aria-hidden="true" className="size-3.5" />
            {t("dashboard.updatedAt", { time: updatedAt })}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="pointer-coarse:size-10"
          aria-label={copy.refresh}
          title={copy.refresh}
          disabled={loading}
          onClick={onRefresh}
        >
          {loading ? <Spinner /> : <RefreshCw />}
        </Button>
      </div>
    </header>
  );
});

// ---------------------------------------------------------------------------
// Filters

type FilterBarProps = {
  activeBranchUuid: string;
  branchLabel: string;
  branchLoading: boolean;
  branchOptions: SelectOption[];
  copy: DashboardCopy;
  filters: DashboardFilters;
  /** The staged filters differ from what is on screen; Apply has something to do. */
  isDirty: boolean;
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
  onThisMonth: () => void;
  onToday: () => void;
  periodSummary: string;
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
    <Field className={cn("md:w-40", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full pointer-coarse:h-10">
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
    <Field className="md:w-40">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ReportDateInput id={id} name={id} label={label} value={value} onValueChange={onChange} />
    </Field>
  );
}

function DirtyDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-card bg-warning"
    />
  );
}

// Scope (branch) → period granularity → the period itself → quick ranges → apply. On phones the
// fields fold behind one summary button so the plate is on the first screen; md+ shows them inline.
export const DashboardFilterBar = memo(function DashboardFilterBar({
  activeBranchUuid,
  branchLabel,
  branchLoading,
  branchOptions,
  copy,
  filters,
  isDirty,
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
  onThisMonth,
  onToday,
  periodSummary,
  periodTypeOptions,
  yearOptions,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const fieldsId = useId();
  const dirtyHintId = useId();

  return (
    <Card size="sm" className="shadow-dash-card">
      <CardContent className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          aria-controls={fieldsId}
          aria-expanded={expanded}
          className="relative h-11 w-full justify-between gap-2 text-sm md:hidden"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Store data-icon="inline-start" />
            <span className="truncate">{[branchLabel, periodSummary].filter(Boolean).join(" · ")}</span>
          </span>
          {expanded ? <ChevronUp data-icon="inline-end" /> : <ChevronDown data-icon="inline-end" />}
          {isDirty ? <DirtyDot /> : null}
        </Button>
        <div
          id={fieldsId}
          className={cn("grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end", expanded ? "grid" : "hidden")}
        >
          <Field className="col-span-2 md:w-56">
            <FieldLabel htmlFor="dashboard-branch">{copy.branch}</FieldLabel>
            <Select
              disabled={branchLoading || !branchOptions.length}
              value={activeBranchUuid}
              onValueChange={onBranchChange}
            >
              <SelectTrigger id="dashboard-branch" className="w-full pointer-coarse:h-10">
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
          <Field className="col-span-2 md:w-auto">
            <FieldLabel id="dashboard-period-type">{copy.periodType}</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              aria-labelledby="dashboard-period-type"
              className="w-full md:w-auto"
              value={filters.periodType}
              onValueChange={(value) => {
                if (value) onPeriodTypeChange(value);
              }}
            >
              {periodTypeOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="flex-1 pointer-coarse:h-10 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground md:flex-none"
                >
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
          <div className="col-span-2 grid grid-cols-3 gap-2 md:ml-auto md:flex">
            <Button
              type="button"
              variant="outline"
              className="pointer-coarse:h-10"
              onClick={() => {
                setExpanded(false);
                onToday();
              }}
            >
              {copy.today}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="pointer-coarse:h-10"
              onClick={() => {
                setExpanded(false);
                onThisMonth();
              }}
            >
              {copy.thisMonth}
            </Button>
            <Button
              type="button"
              className="relative pointer-coarse:h-10"
              aria-describedby={isDirty ? dirtyHintId : undefined}
              disabled={loading || !activeBranchUuid}
              onClick={() => {
                setExpanded(false);
                onApply();
              }}
            >
              {loading ? <Spinner data-icon="inline-start" /> : <Search data-icon="inline-start" />}
              {copy.apply}
              {isDirty ? <DirtyDot /> : null}
            </Button>
            {isDirty ? (
              <span id={dirtyHintId} className="sr-only">
                {copy.unappliedChanges}
              </span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Alerts

function warningMessage(copy: DashboardCopy, warning: DashboardWarning) {
  return warning.copyKey && copy[warning.copyKey] ? copy[warning.copyKey] : warning.value;
}

export const DashboardAlerts = memo(function DashboardAlerts({
  copy,
  errors,
  onRetry,
  warnings,
}: {
  copy: DashboardCopy;
  errors: string[];
  onRetry: () => void;
  warnings: DashboardWarning[];
}) {
  // The payment-split warning is shown inside the sales card, next to the numbers it
  // explains, so it is not repeated here.
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
          {/* Retry sits in the flow, not in AlertAction: that reserves its room with :has(), which
              Swan 1's WebView 101 lacks, so the button would cover the message there. */}
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">{message}</span>
            <Button type="button" variant="outline" size="sm" className="pointer-coarse:h-10" onClick={onRetry}>
              <RefreshCw data-icon="inline-start" />
              {copy.retry}
            </Button>
          </AlertDescription>
        </Alert>
      ))}
      {warningMessages.length ? (
        <Alert className="border-warning">
          <AlertTriangle className="text-warning-text" />
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
// Hero row: the banknote plate and the four numbers that explain it.

function Sparkline({ strokeClassName, values }: { strokeClassName: string; values: number[] }) {
  return (
    // The wrapper clips: Android compat mode forces overflow:visible on every <svg>.
    <div aria-hidden="true" className="h-8 overflow-hidden">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="size-full" focusable="false">
        <path
          d={sparklinePath(values)}
          className={cn("fill-none", strokeClassName)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

type KpiTone = "neutral" | "warning" | "destructive";

// Each tile keeps its own accent whatever its value, so a quiet day (all zeros) still reads as
// four distinct, coloured figures. The value text only turns warning/destructive when there is
// something to look at. Literal class strings so Tailwind emits them.
type KpiAccent = "info" | "primary" | "warning" | "destructive";

const kpiAccents: Record<
  KpiAccent,
  { bar: string; blob: string; chip: string; line: string; meter: string; stroke: string; text: string }
> = {
  destructive: {
    bar: "bg-destructive",
    blob: "bg-destructive/10",
    chip: "bg-destructive text-destructive-foreground",
    line: "bg-destructive/25",
    meter: "bg-destructive/15 *:data-[slot=progress-indicator]:bg-destructive",
    stroke: "stroke-destructive",
    text: "text-destructive",
  },
  info: {
    bar: "bg-info",
    blob: "bg-info/10",
    chip: "bg-info text-info-foreground",
    line: "bg-info/25",
    meter: "bg-info/15 *:data-[slot=progress-indicator]:bg-info",
    stroke: "stroke-info",
    text: "text-info-text",
  },
  // primary-text, not primary, for the thin marks: dark mode's --primary is a deep fill colour that
  // nearly vanishes as a 4px line on a dark card.
  primary: {
    bar: "bg-primary-text",
    blob: "bg-primary-text/10",
    chip: "bg-primary text-primary-foreground",
    line: "bg-primary-text/30",
    meter: "bg-primary-text/15 *:data-[slot=progress-indicator]:bg-primary-text",
    stroke: "stroke-primary-text",
    text: "text-primary-text",
  },
  warning: {
    bar: "bg-warning",
    blob: "bg-warning/10",
    chip: "bg-warning text-warning-foreground",
    line: "bg-warning/25",
    meter: "bg-warning/15 *:data-[slot=progress-indicator]:bg-warning",
    stroke: "stroke-warning",
    text: "text-warning-text",
  },
};

const kpiValueTones: Record<KpiTone, string> = {
  destructive: "text-destructive",
  neutral: "",
  warning: "text-warning-text",
};

// Entrance stagger for the four tiles on the full tier; complete class names so Tailwind emits them.
const kpiDelays = ["motion-safe:delay-200", "motion-safe:delay-[260ms]", "motion-safe:delay-[320ms]", "motion-safe:delay-[380ms]"];

function KpiTile({
  accent,
  badge,
  detail,
  icon: Icon,
  index,
  label,
  meter,
  sparkline,
  tier,
  tone,
  value,
}: {
  accent: KpiAccent;
  badge?: string;
  detail: string;
  icon: LucideIcon;
  index: number;
  label: string;
  /** 0-100 share drawn as a thin meter when there is no sparkline. */
  meter?: number;
  sparkline?: number[] | null;
  /** Entrance classes play once when the tile mounts; refetches keep the same classes. */
  tier: VisualEffectsTier;
  tone: KpiTone;
  value: string;
}) {
  const colors = kpiAccents[accent];

  return (
    <Card
      className={cn(
        "relative isolate gap-3 px-4 shadow-dash-card",
        tier !== "static" && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-300",
        tier === "full" && kpiDelays[index],
      )}
    >
      {/* Accent rule and a soft disc behind the chip. A positioned layer, not border-t: Swan 1's
          card rule overrides card borders. -z-10 inside `isolate` keeps it under the text. */}
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", colors.bar)} />
      <span aria-hidden="true" className={cn("absolute -top-10 -right-10 -z-10 size-32 rounded-full", colors.blob)} />
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm font-semibold", colors.text)}>{label}</span>
        <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm", colors.chip)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p
        className={cn(
          "font-heading leading-tight font-bold font-stretch-semi-condensed tabular-nums wrap-anywhere",
          // The tiles are 4-up (lg/xl) or 2-up beside the plate (2xl), so the size follows the
          // tile, not the viewport alone.
          kipFigureSize(value, 9) === "long" ? "text-xl xl:text-2xl 2xl:text-xl" : "text-2xl xl:text-3xl 2xl:text-2xl",
          tone === "neutral" ? colors.text : kpiValueTones[tone],
        )}
      >
        {value}
      </p>
      {sparkline ? (
        <Sparkline strokeClassName={colors.stroke} values={sparkline} />
      ) : meter !== undefined ? (
        <div className="flex h-8 items-center">
          <Progress aria-hidden="true" value={Math.min(100, Math.max(0, meter))} className={cn("h-2 rounded-full", colors.meter)} />
        </div>
      ) : (
        // No daily series (a single day): a flat accent line keeps the tile's rhythm and colour.
        <div aria-hidden="true" className="flex h-8 items-center">
          <span className={cn("h-1 w-full rounded-full", colors.line)} />
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
        <span>{detail}</span>
        {badge ? (
          <Badge variant="secondary" className="h-auto py-0.5 text-2xs">
            {badge}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}

export const DashboardHeroRow = memo(function DashboardHeroRow({
  avgBillSparkline,
  copy,
  kpis,
  ordersSparkline,
  periodLabel,
  section,
  skyline,
  tier,
}: {
  avgBillSparkline: number[] | null;
  copy: DashboardCopy;
  kpis: Row;
  ordersSparkline: number[] | null;
  periodLabel: string;
  section: Row;
  skyline: SkylineColumn[];
  tier: VisualEffectsTier;
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
    <div className="grid grid-cols-1 gap-4 xl:gap-5 2xl:grid-cols-12">
      <RevenuePlate
        balance={numberFrom(kpis, "balance_total")}
        collectionRate={numberFrom(kpis, "collection_rate")}
        copy={copy}
        label={text(mainTotal.label, copy.revenue)}
        paid={numberFrom(kpis, "paid_total")}
        period={text(mainTotal.sub_label, periodLabel)}
        skyline={skyline}
        tier={tier}
        unpaidRate={numberFrom(kpis, "unpaid_rate")}
        value={formatApiMoney(
          numberFrom(mainTotal, "value") || numberFrom(kpis, "revenue_total"),
          text(mainTotal.unit, ""),
        )}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 2xl:col-span-4 2xl:grid-cols-2">
        <KpiTile
          accent="info"
          index={0}
          tier={tier}
          tone="neutral"
          icon={ReceiptText}
          label={copy.billCount}
          value={`${formatNumber(orders)} ${copy.billUnit}`}
          sparkline={ordersSparkline}
          detail={copy.totalBills}
        />
        <KpiTile
          accent="primary"
          index={1}
          tier={tier}
          tone="neutral"
          icon={Calculator}
          label={copy.avgBill}
          value={formatKip(numberFrom(kpis, "avg_bill"))}
          sparkline={avgBillSparkline}
          detail={`${formatNumber(orders)} ${copy.orders}`}
        />
        <KpiTile
          accent="warning"
          index={2}
          tier={tier}
          tone={discountTotal > 0 ? "warning" : "neutral"}
          icon={BadgePercent}
          label={copy.discount}
          value={formatKip(discountTotal)}
          meter={numberFrom(kpis, "discount_rate")}
          detail={copy.discountRate}
          badge={formatPercent(numberFrom(kpis, "discount_rate"))}
        />
        {/* Cancellations only turn red when there is something to look at. */}
        <KpiTile
          accent="destructive"
          index={3}
          tier={tier}
          tone={cancelledCount > 0 ? "destructive" : "neutral"}
          icon={XCircle}
          label={copy.cancellations}
          value={formatKip(cancelledTotal)}
          meter={numberFrom(kpis, "cancel_rate")}
          detail={`${formatNumber(cancelledCount)} ${copy.orders}`}
          badge={`${copy.cancelRate} ${formatPercent(numberFrom(kpis, "cancel_rate"))}`}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Loading skeletons. Each mirrors the real section's grid (same breakpoints and spans) so
// nothing jumps when data lands.

function KpiTileSkeleton() {
  return (
    <Card className="gap-3 px-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32 max-w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-4 w-24" />
    </Card>
  );
}

function CardSkeleton({ className, lines }: { className?: string; lines: number }) {
  return (
    <Card className={cn("px-4", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="flex justify-between gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </Card>
  );
}

type DashboardDetailFallbackVariant = "products" | "sales";

// Also the loading UI for the lazily imported detail rows (next/dynamic `loading`).
export function DashboardDetailFallback({ variant }: { variant: DashboardDetailFallbackVariant }) {
  if (variant === "sales") {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
        <Card className="px-4 xl:col-span-8">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full lg:h-80" />
        </Card>
        <div className="grid content-start gap-4 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
      <Card className="px-4 xl:col-span-8">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-40" />
        </div>
        {/* 10 rows = the default "top 10" the table renders. */}
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </Card>
      <div className="grid content-start gap-4 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}

// Whole-page skeleton for the first load (and while permissions resolve).
export function DashboardPageSkeleton({ label }: { label: string }) {
  return (
    <section aria-busy="true" aria-label={label} className="flex flex-col gap-4 xl:gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-36 rounded-full" />
        </div>
      </div>
      <Card size="sm">
        <CardContent>
          <Skeleton className="h-11 w-full md:hidden" />
          <div className="hidden gap-3 md:flex md:flex-wrap md:items-end">
            <Skeleton className="h-12 w-56" />
            <Skeleton className="h-12 w-52" />
            <Skeleton className="h-12 w-40" />
            <Skeleton className="h-12 w-40" />
            <Skeleton className="ml-auto h-7 w-64" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:gap-5 2xl:grid-cols-12">
        <RevenuePlateSkeleton />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 2xl:col-span-4 2xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <KpiTileSkeleton key={index} />
          ))}
        </div>
      </div>
      <DashboardDetailFallback variant="sales" />
      <DashboardDetailFallback variant="products" />
    </section>
  );
}
