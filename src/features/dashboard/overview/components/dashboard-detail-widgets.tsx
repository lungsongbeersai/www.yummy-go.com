"use client";

import dynamic from "next/dynamic";
import { Fragment, memo, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Armchair,
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
import { Card } from "@/components/ui/card";
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
  type TrendPoint,
} from "@/features/dashboard/overview/dashboard-view-model";

// recharts is fetched only once a period has at least two days to draw; "today" never loads it.
const DailySalesChart = dynamic(
  () => import("./dashboard-chart-widgets").then((module) => module.DailySalesChart),
  { loading: () => <Skeleton className="h-64 w-full lg:h-80" />, ssr: false },
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
    <Card role="region" aria-labelledby={titleId} className={cn("min-w-0 shadow-dash-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="text-sm font-semibold text-foreground lg:text-base">
              {title}
            </h2>
            {description ? <p className="text-xs text-muted-foreground tabular-nums">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 px-4">{children}</div>
    </Card>
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
// Sales: payment split for the whole period, then the daily bars when there is more than a day.

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
  className,
  copy,
  isSingleDay,
  onThisMonth,
  paymentSummary,
  paymentSummaryCards,
  paymentTrendRows,
  tier,
  trendRows,
}: {
  className?: string;
  copy: DashboardCopy;
  /** The applied range is one business day, which has no trend to draw. */
  isSingleDay: boolean;
  onThisMonth: () => void;
  paymentSummary: PaymentSummary;
  paymentSummaryCards: PaymentSummaryCard[];
  paymentTrendRows: TrendPoint[];
  tier: VisualEffectsTier;
  trendRows: TrendPoint[];
}) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<TrendMetric>("revenue");
  const split = useMemo(() => paymentSplit(paymentSummaryCards), [paymentSummaryCards]);
  // Revenue bars come from the payment rows (they carry the cash/transfer/debt split), bills from
  // the sales rows; each falls back to the other when the API sends only one of them.
  const revenueSource = paymentTrendRows.length ? paymentTrendRows : trendRows;
  const ordersSource = trendRows.length ? trendRows : paymentTrendRows;
  const source = metric === "revenue" ? revenueSource : ordersSource;
  const bucketed = useMemo(() => bucketTrendRows(source), [source]);
  const rowCount = Math.max(revenueSource.length, ordersSource.length);
  // A single day has no trend to draw (the hint offers the month instead); a longer range draws
  // even one active day, and a longer range with no rows at all is plainly empty.
  const showChart = rowCount >= 2 || (!isSingleDay && rowCount === 1);
  const isBucketed = bucketed.kind !== "day";
  // Average, peak dot and the footer all measure what the bars plot (see plottedRevenue), over
  // the raw days, so the dashed line and the dot always sit on the bars they describe.
  const averageRevenue = revenueSource.length
    ? revenueSource.reduce((sum, row) => sum + plottedRevenue(row), 0) / revenueSource.length
    : 0;
  const averageOrders = ordersSource.length
    ? ordersSource.reduce((sum, row) => sum + row.orders, 0) / ordersSource.length
    : 0;
  const peakDay = revenueSource.reduce<TrendPoint | null>(
    (best, row) => (plottedRevenue(row) > (best ? plottedRevenue(best) : 0) ? row : best),
    null,
  );
  const peakDayOrders = peakDay
    ? (ordersSource.find((row) => row.date === peakDay.date)?.orders ?? peakDay.orders)
    : 0;
  const peakKey =
    metric === "revenue"
      ? (bucketed.rows.find((row) => peakDay && row.dates.includes(peakDay.date))?.key ?? null)
      : bucketed.rows.reduce<{ key: string | null; value: number }>(
          (best, row) => (row.orders > best.value ? { key: row.key, value: row.orders } : best),
          { key: null, value: 0 },
        ).key;
  const splitWarning =
    !paymentSummary.hasMixedSplitColumns &&
    (paymentSummary.mixedTotal > 0 || paymentSummary.unallocatedMixedTotal > 0);
  const legendLabels = {
    cash: splitLabel(copy, "cash", split.segments[0]?.label ?? ""),
    debt: splitLabel(copy, "debt", split.segments[2]?.label ?? ""),
    other: copy.unallocatedMixedPayment,
    transfer: splitLabel(copy, "transfer", split.segments[1]?.label ?? ""),
  };
  const subtitle = isBucketed
    ? `${copy.dailySalesSubtitle} · ${bucketed.kind === "week" ? copy.weeklyTotals : copy.monthlyTotals}`
    : copy.dailySalesSubtitle;

  return (
    <SectionCard
      className={className}
      icon={ChartColumn}
      title={copy.dailySales}
      description={subtitle}
      action={
        showChart ? (
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            aria-label={copy.dailySales}
            value={metric}
            onValueChange={(value) => {
              if (value) setMetric(value as TrendMetric);
            }}
          >
            <ToggleGroupItem value="revenue" className="pointer-coarse:h-10">
              {copy.revenue}
            </ToggleGroupItem>
            <ToggleGroupItem value="orders" className="pointer-coarse:h-10">
              {copy.orders}
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null
      }
    >
      {/* The bar and its legend: every segment carries its label and amount, never colour alone. */}
      <div aria-hidden="true" className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted forced-color-adjust-none">
        {split.total > 0
          ? split.segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <span
                  key={segment.key}
                  className={splitSegmentClassNames[segment.key]}
                  style={{ flexBasis: 0, flexGrow: segment.value }}
                />
              ))
          : null}
      </div>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {split.segments.map((segment) => (
          <li key={segment.key} className="flex min-w-0 items-baseline gap-2">
            <span aria-hidden="true" className={cn("size-3 shrink-0 self-center rounded-xs", splitSegmentClassNames[segment.key])} />
            <span className="min-w-0 text-sm font-medium">{splitLabel(copy, segment.key, segment.label)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{formatPercent(segment.share)}</span>
            <span className="ml-auto font-heading text-base font-semibold tabular-nums">{formatKip(segment.value)}</span>
          </li>
        ))}
      </ul>
      {splitWarning ? (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            <p>{copy.paymentSplitWarning}</p>
            {paymentSummary.mixedTotal ? (
              <p className="tabular-nums">{copy.mixedPayment}: {formatKip(paymentSummary.mixedTotal)}</p>
            ) : null}
            {paymentSummary.unallocatedMixedTotal ? (
              <p className="tabular-nums">
                {copy.unallocatedMixedPayment}: {formatKip(paymentSummary.unallocatedMixedTotal)}
              </p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {showChart ? (
        <>
          <DailySalesChart
            average={metric === "revenue" ? averageRevenue : averageOrders}
            bucketed={isBucketed}
            copy={copy}
            labels={legendLabels}
            metric={metric}
            peakKey={peakKey}
            rows={bucketed.rows}
            tier={tier}
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground tabular-nums">
            {peakDay && plottedRevenue(peakDay) > 0 ? (
              <span className="flex flex-wrap items-center gap-2">
                <Badge className="h-auto py-0.5 text-2xs">
                  <Trophy data-icon="inline-start" />
                  {copy.peakDay}
                </Badge>
                <span>
                  {peakDay.date} · {formatKip(plottedRevenue(peakDay))} · {formatNumber(peakDayOrders)} {copy.orders}
                </span>
              </span>
            ) : null}
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-foreground" />
              {copy.dailyAverage}: {metric === "revenue" ? formatKip(averageRevenue) : `${formatNumber(averageOrders, 1)} ${copy.orders}`}
            </span>
          </div>
          {/* sr-only on a wrapper, not the table: a table never shrinks below its content width,
              so a clipped 1px table would still widen the page. */}
          <div className="sr-only">
            <table>
              <caption>{copy.dailyTable}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy.startDate}</th>
                  <th scope="col">{legendLabels.cash}</th>
                  <th scope="col">{legendLabels.transfer}</th>
                  <th scope="col">{legendLabels.debt}</th>
                  <th scope="col">{copy.revenue}</th>
                  <th scope="col">{copy.orders}</th>
                </tr>
              </thead>
              <tbody>
                {bucketed.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{isBucketed ? `${row.label} · ${formatNumber(row.days)} ${copy.days}` : row.date}</th>
                    <td>{formatKip(row.cash)}</td>
                    <td>{formatKip(row.transfer)}</td>
                    <td>{formatKip(row.debt)}</td>
                    <td>{formatKip(plottedRevenue(row))}</td>
                    <td>{formatNumber(row.orders)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : isSingleDay ? (
        // One day has no trend to draw: a one-bar chart says nothing, so offer the month instead.
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <span className="text-sm text-foreground">{copy.singleDayHint}</span>
          <Button type="button" variant="outline" className="pointer-coarse:h-10" onClick={onThisMonth}>
            <CalendarRange data-icon="inline-start" />
            {t("dashboard.viewMonthTrend")}
          </Button>
        </div>
      ) : (
        <EmptyPanel label={copy.noData} />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Accounting as a till receipt: dotted leaders, a gross-to-net bar under each line when the
// rows add up, a perforation, and the net amount stamped in the theme colour.

function AccountingCard({ copy, rows }: { copy: DashboardCopy; rows: AccountingRow[] }) {
  const { t } = useTranslation();
  const ledger = useMemo(() => buildLedgerSteps(rows), [rows]);
  const last = rows.length - 1;
  const stamped = rows.length > 1 && rows[last].important;
  const listed = stamped ? rows.slice(0, last) : rows;

  return (
    <SectionCard icon={ReceiptText} title={copy.accounting} description={copy.ledger}>
      {rows.length ? (
        <>
          {/* dt/dd stay direct children of each group div (the only wrapper a dl allows); the
              dotted leader and the gross-to-net bar live inside the dd. */}
          <dl className="flex flex-col">
            {listed.map((row, index) => {
              const step = ledger.steps[index];
              return (
                <div key={row.key} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 py-1.5">
                  <dt className={cn("text-sm", row.important ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {row.label}
                  </dt>
                  <dd className="flex min-w-0 items-baseline gap-2">
                    <span aria-hidden="true" className="mb-1 min-w-4 flex-1 border-b border-dotted border-border" />
                    <span className={cn("font-heading text-sm font-semibold tabular-nums", row.negative && "text-destructive")}>
                      {row.negative ? "− " : ""}
                      {formatKip(row.value)}
                    </span>
                  </dd>
                  {step ? (
                    <dd aria-hidden="true" className="relative col-span-2 mt-1 h-1.5 rounded-full bg-muted forced-color-adjust-none">
                      <span
                        className={cn("absolute inset-y-0 rounded-full", step.kind === "total" ? "bg-primary" : row.negative ? "bg-destructive" : "bg-muted-foreground")}
                        style={{ left: `${step.from}%`, width: `${Math.max(step.to - step.from, 0.5)}%` }}
                      />
                    </dd>
                  ) : null}
                </div>
              );
            })}
          </dl>
          {stamped ? (
            <>
              <div aria-hidden="true" className="h-2 bg-perforation" />
              <div className="flex items-baseline justify-between gap-3 rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                <span className="min-w-0 text-sm font-semibold">{rows[last].label}</span>
                <span className="font-heading text-xl font-bold font-stretch-semi-condensed tabular-nums">
                  {formatKip(rows[last].value)}
                </span>
              </div>
            </>
          ) : null}
          {ledger.reconciles && ledger.gap > 1 ? (
            <p className="text-2xs text-muted-foreground">{t("dashboard.ledgerGap", { amount: formatKip(ledger.gap) })}</p>
          ) : null}
        </>
      ) : (
        <EmptyPanel label={copy.noData} />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Channels as lanes: revenue share against order share, so a channel that brings bigger or
// smaller bills than the rest stands out. No categorical colour: icon and name identify it.

function channelIcon(key: string): LucideIcon {
  const channel = key.toUpperCase();
  if (channel === "DINE_IN") return Utensils;
  if (channel === "TAKEAWAY") return ShoppingBag;
  if (channel === "DELIVERY") return Truck;
  return Store;
}

function OrderChannelsCard({
  copy,
  mainChannelKey,
  rows,
}: {
  copy: DashboardCopy;
  mainChannelKey: string | null;
  rows: BreakdownRow[];
}) {
  const revenueTotal = rows.reduce((sum, row) => sum + row.value, 0);
  const orderTotal = rows.reduce((sum, row) => sum + (row.count ?? 0), 0);

  return (
    <SectionCard
      icon={Store}
      title={copy.orderChannels}
      description={`${formatNumber(rows.length)} ${copy.channels} · ${formatKip(revenueTotal)}`}
    >
      {rows.length ? (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const Icon = channelIcon(row.key);
            const count = row.count ?? 0;
            const active = count > 0 || row.value > 0;
            const revenueShare = share(row.value, revenueTotal);
            const orderShare = share(count, orderTotal);
            const isMain = mainChannelKey !== null && row.key.toUpperCase() === mainChannelKey.toUpperCase();

            return (
              <li key={row.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg",
                    active ? "bg-muted text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className={cn("text-sm font-medium", !active && "text-muted-foreground")}>{row.label}</span>
                  {isMain && active ? (
                    <Badge variant="secondary" className="h-auto py-0.5 text-2xs">
                      {copy.mainChannel}
                    </Badge>
                  ) : null}
                </span>
                <span className={cn("font-heading text-base font-semibold tabular-nums", !active && "text-muted-foreground")}>
                  {formatKip(row.value)}
                </span>
                {active ? (
                  <div className="col-span-2 col-start-2 flex flex-col gap-1.5">
                    <ShareMeter label={copy.revenueShare} meterClassName="*:data-[slot=progress-indicator]:bg-primary" value={revenueShare} />
                    <ShareMeter label={copy.orderShare} meterClassName="*:data-[slot=progress-indicator]:bg-muted-foreground" value={orderShare} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(count)} {copy.orders}
                      {count > 0 ? ` · ${copy.avgBill} ${formatKip(row.value / count)}` : ""}
                    </span>
                  </div>
                ) : (
                  <span className="col-span-2 col-start-2 text-xs text-muted-foreground">{copy.noData}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyPanel label={copy.noData} />
      )}
    </SectionCard>
  );
}

function ShareMeter({ label, meterClassName, value }: { label: string; meterClassName: string; value: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <Progress aria-hidden="true" value={value} className={cn("h-1.5", meterClassName)} />
      <span className="text-right font-medium tabular-nums">{formatPercent(value)}</span>
    </div>
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
      <SalesCard
        className="xl:col-span-8"
        copy={copy}
        onThisMonth={onThisMonth}
        paymentSummary={paymentSummary}
        paymentSummaryCards={paymentSummaryCards}
        paymentTrendRows={paymentTrendRows}
        isSingleDay={isSingleDay}
        tier={tier}
        trendRows={trendRows}
      />
      <div className="grid min-w-0 content-start gap-4 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1 xl:gap-5">
        <AccountingCard copy={copy} rows={accountingRows} />
        <OrderChannelsCard copy={copy} mainChannelKey={mainOrderChannel?.key ?? null} rows={channelRows} />
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
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(product.qty)}</TableCell>
                      <TableCell className="text-right font-heading font-semibold tabular-nums">{formatKip(product.revenue)}</TableCell>
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
                            <span className="whitespace-normal text-center">{t("dashboard.paretoCut", { count: eightyPercentCount })}</span>
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
              <span className="font-medium text-foreground">{copy.driveRevenue}:</span> {formatNumber(eightyPercentCount)} {copy.products}
            </span>
            <span>
              <span className="font-medium text-foreground">{copy.trackedTotal}:</span> {format(total)}
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
            <span className="font-heading text-4xl leading-none font-bold font-stretch-semi-condensed tabular-nums xl:text-5xl">
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
                <span className="font-heading text-base font-semibold tabular-nums">{formatNumber(item.count)}</span>
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
  success: { chip: "bg-success text-success-foreground", edge: "border-l-success" },
  warning: { chip: "bg-warning text-warning-foreground", edge: "border-l-warning" },
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
              <ItemTitle className="line-clamp-2 text-sm font-semibold">{item.title}</ItemTitle>
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
