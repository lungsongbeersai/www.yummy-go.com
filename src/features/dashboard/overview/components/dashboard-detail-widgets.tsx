"use client";

import dynamic from "next/dynamic";
import { Fragment, memo, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Armchair,
  Banknote,
  Calculator,
  Coins,
  CreditCard,
  Layers,
  Percent,
  Settings2,
  Tag,
  CalendarRange,
  ChartColumn,
  Info,
  Lightbulb,
  ReceiptText,
  ShoppingBag,
  Store,
  TrendingDown,
  Trophy,
  Truck,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { DashboardCard } from "@/features/dashboard/overview/components/dashboard-card";
import type { VisualEffectsTier } from "@/lib/visual-effects-tier";
import {
  asRow,
  bucketTrendRows,
  buildLedgerSteps,
  cumulativeShares,
  formatKip,
  formatNumber,
  formatPercent,
  numberFrom,
  paretoCount,
  paymentSplit,
  plottedRevenue,
  seatSummary,
  trendBucketKind,
  unsplitRevenue,
  share,
  text,
  type AccountingRow,
  type BreakdownRow,
  type DashboardCopy,
  type PaymentSplitKey,
  type PaymentSummary,
  type PaymentSummaryCard,
  type ProductRow,
  type Row,
  type SeatState,
  type SelectOption,
  type TrendMetric,
  type TrendBucketKind,
  type TrendPoint,
} from "@/features/dashboard/overview/dashboard-view-model";

// Keep chart code lazy; an empty response needs no chart bundle.
const DailySalesChart = dynamic(
  () => import("./dashboard-chart-widgets").then((module) => module.DailySalesChart),
  { loading: () => <Skeleton className="h-56 w-full sm:h-64 lg:h-72" />, ssr: false },
);

function entranceClassName(tier: VisualEffectsTier) {
  return tier === "static" ? undefined : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300";
}

// Every card on the page shares one header shape: a muted icon tile, a real h2, an optional
// description and actions. Not CardAction: its :has()-based grid does not lay out on WebView 101.
function SectionCard({
  action,
  children,
  className,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  const titleId = useId();

  return (
    <DashboardCard role="region" aria-labelledby={titleId} className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="text-sm font-semibold text-foreground lg:text-base dark:text-primary-text">
              {title}
            </h2>
            {description ? <p className="text-xs text-muted-foreground tabular-nums">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-4">{children}</div>
    </DashboardCard>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <Empty className="py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Info />
        </EmptyMedia>
        <EmptyTitle>{label}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

// ---------------------------------------------------------------------------
// Sales and order channels share one surface; accounting remains a separate receipt.

const splitSegmentClassNames: Record<PaymentSplitKey, string> = {
  cash: "bg-chart-cat-1",
  debt: "bg-hatch text-chart-cat-3",
  transfer: "bg-chart-cat-2",
  unallocated: "bg-muted-foreground",
};

function splitLabel(copy: DashboardCopy, key: PaymentSplitKey, apiLabel: string) {
  if (key === "unallocated") return copy.unallocatedMixedPayment;
  return apiLabel && apiLabel !== "-" ? apiLabel : copy[key];
}

function SalesCard({
  channelRows,
  copy,
  isSingleDay,
  mainChannelKey,
  onThisMonth,
  paymentSummary,
  paymentSummaryCards,
  paymentTrendRows,
  tier,
  trendRows,
}: {
  channelRows: BreakdownRow[];
  copy: DashboardCopy;
  isSingleDay: boolean;
  mainChannelKey: string | null;
  onThisMonth: () => void;
  paymentSummary: PaymentSummary;
  paymentSummaryCards: PaymentSummaryCard[];
  paymentTrendRows: TrendPoint[];
  tier: VisualEffectsTier;
  trendRows: TrendPoint[];
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [metric, setMetric] = useState<TrendMetric>("revenue");
  const [grouping, setGrouping] = useState<TrendBucketKind | null>(null);
  const split = useMemo(() => paymentSplit(paymentSummaryCards), [paymentSummaryCards]);
  const revenueSource = paymentTrendRows.length ? paymentTrendRows : trendRows;
  const ordersSource = trendRows.length ? trendRows : paymentTrendRows;
  const source = metric === "revenue" ? revenueSource : ordersSource;
  const bucketKind = grouping ?? trendBucketKind(source.length);
  const bucketed = useMemo(() => bucketTrendRows(source, bucketKind), [source, bucketKind]);
  const isBucketed = bucketed.kind !== "day";
  const cash = split.segments.find((segment) => segment.key === "cash")?.value ?? 0;
  const transfer = split.segments.find((segment) => segment.key === "transfer")?.value ?? 0;
  // Collected money excludes debt and the mixed remainder the Backend could not allocate.
  const collected = cash + transfer;
  const additional = split.segments.filter((segment) => segment.value > 0 && segment.key !== "cash" && segment.key !== "transfer");
  const splitWarning = !paymentSummary.hasMixedSplitColumns &&
    (paymentSummary.mixedTotal > 0 || paymentSummary.unallocatedMixedTotal > 0);
  const labels = {
    cash: splitLabel(copy, "cash", split.segments[0]?.label ?? ""),
    collected: t("dashboard.collectedTotal"),
    debt: splitLabel(copy, "debt", split.segments[2]?.label ?? ""),
    other: copy.unallocatedMixedPayment,
    transfer: splitLabel(copy, "transfer", split.segments[1]?.label ?? ""),
  };
  const average = source.length
    ? source.reduce((sum, row) => sum + (metric === "revenue" ? plottedRevenue(row) : row.orders), 0) / source.length
    : 0;
  const peakKey = bucketed.rows.reduce<{ key: string | null; value: number }>(
    (best, row) => {
      const value = metric === "revenue" ? plottedRevenue(row) : row.orders;
      return value > best.value ? { key: row.key, value } : best;
    }, { key: null, value: 0 },
  ).key;
  const summaries = [
    { key: "cash", label: t("dashboard.cashTotal"), value: cash, icon: Banknote, tone: "bg-success/10 text-success-text" },
    { key: "transfer", label: t("dashboard.transferTotal"), value: transfer, icon: CreditCard, tone: "bg-info/10 text-info-text" },
    { key: "collected", label: labels.collected, value: collected, icon: Layers, tone: "bg-dashboard-collected-surface text-dashboard-collected-text" },
  ];

  return (
    <DashboardCard role="region" aria-labelledby={titleId} className="min-w-0 gap-5 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success-text">
            <ChartColumn className="size-6" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="font-heading text-base font-bold text-foreground sm:text-lg">{copy.dailySales}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{copy.dailySalesSubtitle}</p>
          </div>
        </div>
        <ToggleGroup
          type="single" variant="outline" spacing={0} aria-label={t("dashboard.chartGrouping")}
          value={bucketKind}
          onValueChange={(value) => { if (value) setGrouping(value as TrendBucketKind); }}
        >
          {(["day", "week", "month"] as const).map((kind) => (
            <ToggleGroupItem key={kind} value={kind} className="min-h-10 px-3 pointer-coarse:min-h-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground">
              {t(`dashboard.group${kind === "day" ? "Day" : kind === "week" ? "Week" : "Month"}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summaries.map(({ key, label, value, icon: Icon, tone }) => (
          <div key={key} className={cn("flex min-w-0 items-start gap-3 rounded-xl p-3 sm:flex-col 2xl:flex-row", tone)}>
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card"><Icon className="size-5" /></span>
            <div className="min-w-0">
              <dt className="text-sm font-semibold">{label}</dt>
              <dd className="mt-1 font-heading text-2xl leading-snug font-bold tabular-nums wrap-anywhere">{formatKip(value)}</dd>
            </div>
          </div>
        ))}
      </dl>
      {additional.length ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg bg-muted px-3 py-2">
          {additional.map((segment) => (
            <li key={segment.key} className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-foreground tabular-nums">
              <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-xs", splitSegmentClassNames[segment.key])} />
              {splitLabel(copy, segment.key, segment.label)}
              <strong>{formatKip(segment.value)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {splitWarning ? (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            <p>{copy.paymentSplitWarning}</p>
            {paymentSummary.mixedTotal > 0 ? <p className="tabular-nums">{copy.mixedPayment}: {formatKip(paymentSummary.mixedTotal)}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t("dashboard.groupingLoadedRange")}</p>
          <ToggleGroup
            type="single" variant="outline" spacing={0} aria-label={t("dashboard.chartMetric")}
            value={metric} onValueChange={(value) => { if (value) setMetric(value as TrendMetric); }}
          >
            <ToggleGroupItem value="revenue" className="pointer-coarse:min-h-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground">{copy.revenue}</ToggleGroupItem>
            <ToggleGroupItem value="orders" className="pointer-coarse:min-h-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground">{copy.orders}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {metric === "revenue" ? (
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold tabular-nums">
            {(["cash", "transfer", "collected"] as const).map((key) => (
              <li key={key} className="flex min-w-0 flex-wrap items-center gap-2">
                <span aria-hidden="true" className={cn(key === "collected" ? "h-0.5 w-5 bg-success" : "size-2.5 rounded-full", key === "cash" && "bg-chart-cat-1", key === "transfer" && "bg-chart-cat-2")} />
                <span className="text-foreground">{labels[key]} {formatKip(key === "cash" ? cash : key === "transfer" ? transfer : collected)}</span>
              </li>
            ))}
            {revenueSource.some((row) => row.debt > 0) ? <li className="flex items-center gap-2 text-foreground"><span aria-hidden="true" className="size-3 rounded-xs bg-hatch text-chart-cat-3" />{labels.debt}</li> : null}
            {revenueSource.some((row) => unsplitRevenue(row) > 0) ? <li className="flex items-center gap-2 text-foreground"><span aria-hidden="true" className="size-2.5 rounded-full bg-muted-foreground" />{labels.other}</li> : null}
          </ul>
        ) : null}
        {source.length ? (
          <>
            <DailySalesChart average={average} bucketed={isBucketed} copy={copy} labels={labels} metric={metric} peakKey={peakKey} rows={bucketed.rows} tier={tier} />
            <div className="sr-only">
              <table>
                <caption>{copy.dailyTable}</caption>
                <thead><tr><th scope="col">{copy.startDate}</th><th scope="col">{labels.cash}</th><th scope="col">{labels.transfer}</th><th scope="col">{labels.collected}</th><th scope="col">{labels.debt}</th><th scope="col">{copy.revenue}</th><th scope="col">{copy.orders}</th></tr></thead>
                <tbody>{bucketed.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{isBucketed ? `${row.label} · ${formatNumber(row.days)} ${copy.days}` : row.date}</th>
                    <td>{formatKip(row.cash)}</td><td>{formatKip(row.transfer)}</td><td>{formatKip(row.cash + row.transfer)}</td><td>{formatKip(row.debt)}</td><td>{formatKip(plottedRevenue(row))}</td><td>{formatNumber(row.orders)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        ) : <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border"><EmptyPanel label={copy.noData} /></div>}
        {isSingleDay ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="text-xs text-muted-foreground">{copy.singleDayHint}</span>
            <Button type="button" variant="outline" className="pointer-coarse:min-h-11" onClick={onThisMonth}>
              <CalendarRange data-icon="inline-start" />{t("dashboard.viewMonthTrend")}
            </Button>
          </div>
        ) : null}
      </div>
      <OrderChannelsSummary copy={copy} mainChannelKey={mainChannelKey} rows={channelRows} />
    </DashboardCard>
  );
}

const ledgerIcons: Record<string, LucideIcon> = {
  gross: Coins, discount: Tag, subtotal: Percent, service: Settings2,
  before_vat: ReceiptText, vat: Calculator, total: Coins,
};

function AccountingCard({ copy, rows }: { copy: DashboardCopy; rows: AccountingRow[] }) {
  const { t } = useTranslation();
  const titleId = useId();
  const ledger = useMemo(() => buildLedgerSteps(rows), [rows]);
  const last = rows.length - 1;
  const stamped = rows.length > 1 && rows[last].important;
  const listed = stamped ? rows.slice(0, last) : rows;

  return (
    <DashboardCard role="region" aria-labelledby={titleId} className="min-w-0 gap-0 rounded-2xl py-0">
      <div className="flex items-start gap-3 bg-primary px-4 py-5 text-primary-foreground sm:px-5">
        <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-foreground text-primary"><Calculator className="size-6" /></span>
        <div className="min-w-0">
          <h2 id={titleId} className="font-heading text-lg font-bold">{copy.accounting}</h2>
          <p className="mt-1 text-xs">{copy.ledger}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-5">
        {rows.length ? (
          <>
            <dl className="flex flex-col gap-1">
              {listed.map((row, index) => {
                const Icon = ledgerIcons[row.key] ?? ReceiptText;
                return (
                  <div key={row.key} className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-2 py-3", index === 0 && "rounded-xl border-b-0 bg-success/10", row.important && "text-success-text")}>
                    <dt className="flex min-w-0 items-center gap-3 text-sm font-medium">
                      <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", row.important ? "bg-card text-success-text" : "bg-muted text-muted-foreground")}><Icon className="size-4" /></span>
                      <span className="min-w-0 wrap-anywhere">{row.label}</span>
                    </dt>
                    <dd className={cn("max-w-48 text-right font-heading text-base font-bold tabular-nums wrap-anywhere", row.negative ? "text-destructive" : row.important ? "text-success-text" : "text-foreground")}>
                      {row.negative ? "− " : ""}{formatKip(row.negative ? Math.abs(row.value) : row.value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {stamped ? (
              <div className="mt-auto flex flex-col gap-5 pt-2">
                <div aria-hidden="true" className="h-2 bg-perforation" />
                <dl className="rounded-xl bg-primary p-4 text-primary-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <dt className="flex min-w-0 items-center gap-3 text-sm font-bold"><Coins aria-hidden="true" className="size-6 shrink-0" />{rows[last].label}</dt>
                    <dd className="font-heading text-3xl font-bold tabular-nums wrap-anywhere">{rows[last].negative ? "− " : ""}{formatKip(rows[last].negative ? Math.abs(rows[last].value) : rows[last].value)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
            {ledger.reconciles && ledger.gap > 1 ? <p className="text-2xs text-muted-foreground">{t("dashboard.ledgerGap", { amount: formatKip(ledger.gap) })}</p> : null}
          </>
        ) : <EmptyPanel label={copy.noData} />}
      </div>
    </DashboardCard>
  );
}

function channelTone(key: string) {
  const channel = key.toUpperCase();
  if (channel === "DINE_IN") return "bg-success/10 text-success-text";
  if (channel === "TAKEAWAY") return "bg-info/10 text-info-text";
  if (channel === "DELIVERY") return "bg-warning/10 text-warning-text";
  return "bg-primary/10 text-primary-text";
}

function channelIcon(key: string): LucideIcon {
  const channel = key.toUpperCase();
  if (channel === "DINE_IN") return Utensils;
  if (channel === "TAKEAWAY") return ShoppingBag;
  if (channel === "DELIVERY") return Truck;
  return Store;
}

function OrderChannelsSummary({ copy, mainChannelKey, rows }: {
  copy: DashboardCopy;
  mainChannelKey: string | null;
  rows: BreakdownRow[];
}) {
  const titleId = useId();
  const orderTotal = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);

  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-xl border border-border p-3">
      <h3 id={titleId} className="flex items-center gap-2 font-heading text-sm font-bold text-foreground">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success-text"><Utensils className="size-4" /></span>
        {copy.orderChannels}
      </h3>
      {rows.length ? (
        <ul className="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
          {rows.map((row) => {
            const Icon = channelIcon(row.key);
            const count = row.count ?? 0;
            const isMain = count > 0 && mainChannelKey?.toUpperCase() === row.key.toUpperCase();
            return (
              <li key={row.key} className={cn("flex min-w-0 flex-col gap-2 rounded-lg p-3", channelTone(row.key))}>
                <span className="flex min-w-0 items-start gap-2">
                  <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card"><Icon className="size-4" /></span>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold">{row.label}{isMain ? <Badge variant="secondary" className="h-auto py-0.5 text-2xs">{copy.mainChannel}</Badge> : null}</span>
                </span>
                <div className="mt-auto flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-xs text-foreground tabular-nums">{formatNumber(count)} {copy.orders} ({formatPercent(share(count, orderTotal))})</span>
                  <strong className="max-w-full font-heading text-base font-bold tabular-nums wrap-anywhere">{formatKip(row.value)}</strong>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <EmptyPanel label={copy.noData} />}
    </section>
  );
}

export const DashboardSalesRow = memo(function DashboardSalesRow({
  accountingRows,
  channelRows,
  copy,
  isSingleDay,
  mainOrderChannel,
  onThisMonth,
  paymentSummary,
  paymentSummaryCards,
  paymentTrendRows,
  tier,
  trendRows,
}: {
  accountingRows: AccountingRow[];
  channelRows: BreakdownRow[];
  copy: DashboardCopy;
  isSingleDay: boolean;
  mainOrderChannel: BreakdownRow | null;
  onThisMonth: () => void;
  paymentSummary: PaymentSummary;
  paymentSummaryCards: PaymentSummaryCard[];
  paymentTrendRows: TrendPoint[];
  tier: VisualEffectsTier;
  trendRows: TrendPoint[];
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5", entranceClassName(tier))}>
      <div className="grid min-w-0 xl:col-span-8">
        <SalesCard
          channelRows={channelRows}
          copy={copy}
          isSingleDay={isSingleDay}
          mainChannelKey={mainOrderChannel?.key ?? null}
          onThisMonth={onThisMonth}
          paymentSummary={paymentSummary}
          paymentSummaryCards={paymentSummaryCards}
          paymentTrendRows={paymentTrendRows}
          tier={tier}
          trendRows={trendRows}
        />
      </div>
      <div className="grid min-w-0 xl:col-span-4">
        <AccountingCard copy={copy} rows={accountingRows} />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Products: coin rank badges for the podium, the 80% line drawn where it falls.

type ProductSort = "qty" | "revenue";

const rankCoinClassNames = [
  "bg-primary text-primary-foreground",
  "bg-foreground text-background",
  "border border-border bg-muted text-foreground",
];

function RankMark({ rank }: { rank: number }) {
  const coin = rankCoinClassNames[rank - 1];
  return coin ? (
    <span className={cn("flex size-7 items-center justify-center rounded-full font-heading text-xs font-bold tabular-nums", coin)}>
      {rank}
    </span>
  ) : (
    <span className="flex size-7 items-center justify-center text-xs text-muted-foreground tabular-nums">{rank}</span>
  );
}

function TopProductsCard({
  className,
  copy,
  dimmed,
  loading,
  onTopChange,
  products,
  top,
  topOptions,
}: {
  className?: string;
  copy: DashboardCopy;
  /** Only the product list is being refetched (a Top-N change). */
  dimmed: boolean;
  loading: boolean;
  onTopChange: (value: string) => void;
  products: ProductRow[];
  top: string;
  topOptions: SelectOption[];
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<ProductSort>("revenue");
  const sorted = useMemo(() => [...products].sort((left, right) => right[sort] - left[sort]), [products, sort]);
  const values = sorted.map((product) => product[sort]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const cumulative = cumulativeShares(values);
  const eightyPercentCount = paretoCount(values);
  const format = sort === "revenue" ? formatKip : formatNumber;

  return (
    <SectionCard
      className={cn(className, dimmed && "pointer-events-none opacity-60 transition-opacity")}
      icon={Trophy}
      title={copy.topProducts}
      description={`${formatNumber(products.length)} ${copy.products}`}
      action={
        <>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            aria-label={copy.topProducts}
            value={sort}
            onValueChange={(value) => {
              if (value) setSort(value as ProductSort);
            }}
          >
            <ToggleGroupItem value="revenue" className="pointer-coarse:h-10">
              {copy.byRevenue}
            </ToggleGroupItem>
            <ToggleGroupItem value="qty" className="pointer-coarse:h-10">
              {copy.byQty}
            </ToggleGroupItem>
          </ToggleGroup>
          <Select disabled={loading} value={top} onValueChange={onTopChange}>
            <SelectTrigger aria-label={copy.top} className="pointer-coarse:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectGroup>
                {topOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </>
      }
    >
      {sorted.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{copy.products}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{copy.qty}</TableHead>
                <TableHead className="text-right">{copy.revenue}</TableHead>
                <TableHead className="hidden w-36 md:table-cell">{sort === "revenue" ? copy.revenueShare : copy.shareOfQty}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{copy.cumulativePercent}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((product, index) => {
                const productShare = share(product[sort], total);
                // The divider goes after the item that reaches 80%, unless that is the last row.
                const showCut = index + 1 === eightyPercentCount && index < sorted.length - 1;
                return (
                  <Fragment key={`${product.key}-${index}`}>
                    <TableRow>
                      <TableCell>
                        <RankMark rank={index + 1} />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-9 rounded-lg">
                            {product.hasImage ? <AvatarImage alt={product.name} src={product.image} loading="lazy" decoding="async" /> : null}
                            <AvatarFallback className="rounded-lg">{product.name.slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                            {product.size ? <span className="text-xs text-muted-foreground">{product.size}</span> : null}
                            <span className="flex items-center gap-2 text-2xs text-muted-foreground tabular-nums md:hidden">
                              {formatNumber(product.qty)} {copy.qty}
                              <Progress aria-hidden="true" value={productShare} className="h-1 w-12" />
                              {formatPercent(productShare)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right font-medium text-info-text tabular-nums md:table-cell">{formatNumber(product.qty)}</TableCell>
                      <TableCell className="text-right font-heading font-semibold text-primary-text tabular-nums">{formatKip(product.revenue)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Progress
                            aria-hidden="true"
                            value={productShare}
                            className="h-1.5 *:data-[slot=progress-indicator]:bg-primary"
                          />
                          <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">{formatPercent(productShare)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                        {formatPercent(cumulative[index])}
                      </TableCell>
                    </TableRow>
                    {showCut ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="py-1.5">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border" />
                            <span className="whitespace-normal text-center text-primary-text">{t("dashboard.paretoCut", { count: eightyPercentCount })}</span>
                            <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-border" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span>
              <span className="font-semibold text-primary-text">{copy.driveRevenue}:</span> {formatNumber(eightyPercentCount)} {copy.products}
            </span>
            <span>
              <span className="font-semibold text-primary-text">{copy.trackedTotal}:</span> {format(total)}
            </span>
          </div>
        </>
      ) : (
        <EmptyPanel label={copy.noData} />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tables right now: one cell per table, filled / hatched / outlined so the three states differ
// without colour. Borders, not rings, because rings do not paint on WebView 101.

const seatClassNames: Record<SeatState, string> = {
  available: "border-2 border-success",
  occupied: "bg-info",
  unknown: "bg-muted",
  waiting: "border border-warning bg-hatch text-warning",
};

const seatTextClassNames: Record<SeatState, string> = {
  available: "text-success-text",
  occupied: "text-info-text",
  unknown: "text-muted-foreground",
  waiting: "text-warning-text",
};

function TableStatusCard({ copy, summary }: { copy: DashboardCopy; summary: Row }) {
  const seats = seatSummary(summary);
  const legend: { count: number; label: string; state: SeatState }[] = [
    { count: seats.occupied, label: copy.occupied, state: "occupied" },
    { count: seats.waiting, label: copy.waiting, state: "waiting" },
    { count: seats.available, label: copy.available, state: "available" },
  ];

  return (
    <SectionCard
      icon={Armchair}
      title={copy.tableStatus}
      description={copy.tableLoad}
      action={
        <Badge variant="outline" className="h-auto py-0.5 text-2xs">
          {copy.now}
        </Badge>
      }
    >
      {seats.total > 0 ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-heading text-4xl leading-none font-bold font-stretch-semi-condensed text-info-text tabular-nums xl:text-5xl">
              {formatNumber(seats.occupied)}
              <span className="text-2xl text-muted-foreground xl:text-3xl">/{formatNumber(seats.total)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{formatPercent(seats.occupancy)}</span> {copy.occupancy}
            </span>
          </div>
          {seats.cells ? (
            <div aria-hidden="true" className="grid grid-cols-10 gap-1 forced-color-adjust-none">
              {seats.cells.map((state, index) => (
                <span key={index} className={cn("aspect-square rounded-xs", seatClassNames[state])} />
              ))}
            </div>
          ) : (
            <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted forced-color-adjust-none">
              {legend
                .filter((item) => item.count > 0)
                .map((item) => (
                  <span key={item.state} className={seatClassNames[item.state]} style={{ flexBasis: 0, flexGrow: item.count }} />
                ))}
            </div>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {legend.map((item) => (
              <li key={item.state} className="flex items-center gap-2">
                <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-xs", seatClassNames[item.state])} />
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className={cn("font-heading text-base font-semibold tabular-nums", seatTextClassNames[item.state])}>{formatNumber(item.count)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyPanel label={copy.noData} />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Insights as ticket stubs: the left edge carries the tone, the chip repeats it with an icon.

type Highlight = {
  description: string;
  icon: LucideIcon;
  label: string;
  title: string;
  tone: "success" | "warning";
};

const highlightToneClassNames = {
  success: { chip: "bg-success text-success-foreground", edge: "border-l-success", text: "text-success-text" },
  warning: { chip: "bg-warning text-warning-foreground", edge: "border-l-warning", text: "text-warning-text" },
} as const;

function HighlightsCard({
  copy,
  highestRevenueProduct,
  insights,
  productSummary,
}: {
  copy: DashboardCopy;
  highestRevenueProduct: ProductRow | null;
  insights: Row;
  productSummary: Row;
}) {
  const best = asRow(insights.best_selling_product);
  const watch = asRow(insights.watch_product);
  const lowest = asRow(productSummary.lowest_selling_product);
  const items: Highlight[] = [
    {
      description: `${formatNumber(numberFrom(best, "qty_total"))} ${copy.productsSold} · ${formatKip(numberFrom(best, "revenue_total"))}`,
      icon: Trophy,
      label: copy.bestProduct,
      title: text(best.prod_name),
      tone: "success",
    },
    // Often the same item as the best seller; listing it twice adds nothing.
    ...(highestRevenueProduct && highestRevenueProduct.name !== text(best.prod_name)
      ? [
          {
            description: `${formatNumber(highestRevenueProduct.qty)} ${copy.productsSold} · ${formatKip(highestRevenueProduct.revenue)}`,
            icon: Trophy,
            label: copy.highestRevenueProduct,
            title: highestRevenueProduct.name,
            tone: "success" as const,
          },
        ]
      : []),
    {
      description: `${formatNumber(numberFrom(watch, "qty_total") || numberFrom(lowest, "qty_total"))} ${copy.productsSold} · ${formatKip(numberFrom(watch, "revenue_total") || numberFrom(lowest, "revenue_total"))}`,
      icon: TrendingDown,
      label: copy.watchProduct,
      title: text(watch.prod_name, text(lowest.prod_name)),
      tone: "warning",
    },
  ];

  return (
    <SectionCard icon={Lightbulb} title={copy.insights}>
      <ItemGroup className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] xl:grid-cols-1">
        {items.map((item) => (
          <Item key={item.label} variant="outline" className={cn("border-l-4", highlightToneClassNames[item.tone].edge)}>
            <ItemMedia variant="icon" className={cn("size-9 rounded-lg", highlightToneClassNames[item.tone].chip)}>
              <item.icon />
            </ItemMedia>
            <ItemContent>
              <ItemDescription className="text-xs">{item.label}</ItemDescription>
              <ItemTitle className={cn("line-clamp-2 text-sm font-semibold", highlightToneClassNames[item.tone].text)}>{item.title}</ItemTitle>
              <ItemDescription className="tabular-nums">{item.description}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </SectionCard>
  );
}

export const DashboardProductsRow = memo(function DashboardProductsRow({
  copy,
  highestRevenueProduct,
  insights,
  loading,
  onTopChange,
  productSummary,
  products,
  productsDimmed,
  tableSummary,
  tier,
  top,
  topOptions,
}: {
  copy: DashboardCopy;
  highestRevenueProduct: ProductRow | null;
  insights: Row;
  loading: boolean;
  onTopChange: (value: string) => void;
  productSummary: Row;
  products: ProductRow[];
  productsDimmed: boolean;
  tableSummary: Row;
  tier: VisualEffectsTier;
  top: string;
  topOptions: SelectOption[];
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5", entranceClassName(tier))}>
      <TopProductsCard
        className="xl:col-span-8"
        copy={copy}
        dimmed={productsDimmed}
        loading={loading}
        onTopChange={onTopChange}
        products={products}
        top={top}
        topOptions={topOptions}
      />
      <div className="grid min-w-0 content-start gap-4 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1 xl:gap-5">
        <TableStatusCard copy={copy} summary={tableSummary} />
        <HighlightsCard
          copy={copy}
          highestRevenueProduct={highestRevenueProduct}
          insights={insights}
          productSummary={productSummary}
        />
      </div>
    </div>
  );
});
