"use client";

import { memo, useMemo, useState } from "react";
import {
  AlertTriangle,
  Armchair,
  ChartColumn,
  CreditCard,
  Info,
  Landmark,
  Lightbulb,
  Store,
  Trophy,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { DashboardCopy } from "./dashboard-widgets";
import type {
  AccountingRow,
  BreakdownRow,
  PaymentSummary,
  PaymentSummaryCard,
  ProductRow,
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

// Dataviz notes: the trend chart is single-series in the theme primary. Parts-of-a-whole
// (payment methods, channels) are ranked bar lists coloured from --chart-cat-*, a
// validated categorical palette; every bar also carries its text label and value, which
// the palette needs because slots 3-5 are under 3:1 on a light card.

// Full class names (not built strings) so Tailwind emits them. Slot = the entity's
// position in the API order, never its rank, so re-sorting never repaints a category.
const categoricalSlots = [
  { bar: "*:data-[slot=progress-indicator]:bg-chart-cat-1", color: "var(--chart-cat-1)", dot: "bg-chart-cat-1" },
  { bar: "*:data-[slot=progress-indicator]:bg-chart-cat-2", color: "var(--chart-cat-2)", dot: "bg-chart-cat-2" },
  { bar: "*:data-[slot=progress-indicator]:bg-chart-cat-3", color: "var(--chart-cat-3)", dot: "bg-chart-cat-3" },
  { bar: "*:data-[slot=progress-indicator]:bg-chart-cat-4", color: "var(--chart-cat-4)", dot: "bg-chart-cat-4" },
  { bar: "*:data-[slot=progress-indicator]:bg-chart-cat-5", color: "var(--chart-cat-5)", dot: "bg-chart-cat-5" },
] as const;
// Past five categories fold to neutral rather than inventing hues.
const neutralSlot = {
  bar: "*:data-[slot=progress-indicator]:bg-muted-foreground",
  color: "var(--muted-foreground)",
  dot: "bg-muted-foreground",
};

function categoricalSlot(index: number) {
  return categoricalSlots[index] ?? neutralSlot;
}

const compactNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" });

function share(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

// Every card title carries a small muted icon so sections can be told apart at a glance.
function IconTitle({ children, icon: Icon }: { children: React.ReactNode; icon: LucideIcon }) {
  return (
    <CardTitle className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      {children}
    </CardTitle>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Info />
        </EmptyMedia>
        <EmptyTitle>{label}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

function ShareRow({
  detail,
  label,
  percent,
  slot,
  value,
}: {
  detail?: string;
  label: string;
  percent: number;
  slot?: { bar: string; dot: string };
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          {slot ? <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", slot.dot)} /> : null}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 tabular-nums">{value}</span>
      </div>
      {/* Decorative: the percentage is always printed next to the bar. */}
      <Progress
        value={Math.min(100, Math.max(0, percent))}
        aria-hidden="true"
        className={cn("h-2", slot?.bar)}
      />
      <div className="flex justify-between gap-3 text-muted-foreground tabular-nums">
        <span className="truncate">{detail}</span>
        <span className="shrink-0">{formatPercent(percent)}</span>
      </div>
    </div>
  );
}

type TrendMetric = "orders" | "revenue";

function SalesTrendCard({
  copy,
  peakRevenueDay,
  trendRows,
}: {
  copy: DashboardCopy;
  peakRevenueDay: TrendPoint | null;
  trendRows: TrendPoint[];
}) {
  const [metric, setMetric] = useState<TrendMetric>("revenue");
  const isRevenue = metric === "revenue";
  const config = {
    [metric]: { label: isRevenue ? copy.revenue : copy.orders, color: "var(--primary)" },
  } satisfies ChartConfig;
  const data = trendRows.map((row) => ({ ...row, label: row.day || row.date }));
  const format = (value: unknown) => (isRevenue ? formatKip(value) : `${formatNumber(value)} ${copy.orders}`);
  const average = data.length ? data.reduce((sum, row) => sum + row[metric], 0) / data.length : 0;
  // The best day is drawn solid, the rest faded: the peak reads without hunting for it.
  const peakIndex = data.reduce((best, row, index) => (row[metric] > data[best][metric] ? index : best), 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <IconTitle icon={ChartColumn}>{copy.dailySales}</IconTitle>
        <CardDescription>{copy.dailySalesSubtitle}</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={metric}
            onValueChange={(value) => {
              if (value) setMetric(value as TrendMetric);
            }}
          >
            <ToggleGroupItem value="revenue">{copy.revenue}</ToggleGroupItem>
            <ToggleGroupItem value="orders">{copy.orders}</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {data.length ? (
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
              <defs>
                {/* var() only resolves in CSS, not in SVG presentation attributes. */}
                <linearGradient id="dashboard-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: `var(--color-${metric})`, stopOpacity: 0.45 }} />
                  <stop offset="100%" style={{ stopColor: `var(--color-${metric})`, stopOpacity: 0.15 }} />
                </linearGradient>
                <linearGradient id="dashboard-trend-peak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: `var(--color-${metric})`, stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: `var(--color-${metric})`, stopOpacity: 0.7 }} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} minTickGap={16} />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(value: number) => compactNumber.format(value)}
              />
              <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent formatter={format} />} />
              <Bar dataKey={metric} radius={[6, 6, 0, 0]} maxBarSize={36}>
                {data.map((row, index) => (
                  <Cell
                    key={row.date || index}
                    fill={index === peakIndex && row[metric] > 0 ? "url(#dashboard-trend-peak)" : "url(#dashboard-trend-fill)"}
                  />
                ))}
              </Bar>
              {data.length > 1 && average > 0 ? (
                <ReferenceLine y={average} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              ) : null}
            </BarChart>
          </ChartContainer>
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
      {data.length ? (
        <CardFooter className="flex-wrap gap-x-6 gap-y-2 text-muted-foreground tabular-nums">
          {peakRevenueDay ? (
            <span className="flex items-center gap-2">
              <Badge>
                <Trophy data-icon="inline-start" />
                {copy.peakDay}
              </Badge>
              {peakRevenueDay.date} · {formatKip(peakRevenueDay.revenue)} · {formatNumber(peakRevenueDay.orders)} {copy.orders}
            </span>
          ) : null}
          {data.length > 1 ? (
            <span className="flex items-center gap-2">
              {/* Legend for the dashed line drawn across the chart. */}
              <span aria-hidden="true" className="w-4 border-t border-dashed border-muted-foreground" />
              {copy.dailyAverage}: {format(average)}
            </span>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function PaymentMethodsCard({
  cards,
  copy,
  paymentSummary,
}: {
  cards: PaymentSummaryCard[];
  copy: DashboardCopy;
  paymentSummary: PaymentSummary;
}) {
  const totalCard = cards.find((card) => card.important);
  const methods = cards
    .filter((card) => !card.important)
    .map((card, index) => ({ card, slot: categoricalSlot(index) }));
  const total = totalCard?.value || methods.reduce((sum, { card }) => sum + card.value, 0);
  const ranked = [...methods].sort((left, right) => right.card.value - left.card.value);
  const chartData = methods
    .filter(({ card }) => card.value > 0)
    .map(({ card, slot }) => ({ fill: slot.color, key: card.key, value: card.value }));
  const config = Object.fromEntries(
    methods.map(({ card, slot }) => [card.key, { color: slot.color, label: card.label }]),
  ) satisfies ChartConfig;
  const splitWarning =
    !paymentSummary.hasMixedSplitColumns &&
    (paymentSummary.mixedTotal > 0 || paymentSummary.unallocatedMixedTotal > 0);

  return (
    <Card>
      <CardHeader>
        <IconTitle icon={CreditCard}>{copy.paymentSplit}</IconTitle>
        <CardDescription>{totalCard?.label ?? copy.paidTotal}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {chartData.length ? (
          <ChartContainer config={config} className="mx-auto aspect-square h-52">
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent hideLabel nameKey="key" formatter={(value) => formatKip(value)} />}
              />
              {/* The box is sized in rem, so it resizes with the app's font-size setting. Radii are
                  in % of the box, and the animation is off: an animated Pie keeps the sectors from
                  its first render and never re-fits them, so a box that shrinks later clips the ring. */}
              <Pie data={chartData} dataKey="value" nameKey="key" innerRadius="68%" outerRadius="94%" strokeWidth={3} stroke="var(--card)" isAnimationActive={false}>
                {/* The total sits in the hole, so the ring reads as "parts of this number". */}
                <Label
                  content={({ viewBox }) =>
                    viewBox && "cx" in viewBox && "cy" in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-lg font-semibold">
                          {compactNumber.format(total)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground">
                          ₭
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : null}
        {ranked.length ? (
          <div className="flex flex-col gap-2.5">
            {ranked.map(({ card, slot }) => (
              <div key={card.key} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", slot.dot)} />
                  <span className="truncate font-medium">{card.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums">
                  {formatKip(card.value)}
                  <span className="w-12 text-right text-muted-foreground">{formatPercent(share(card.value, total))}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
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
      </CardContent>
    </Card>
  );
}

export const DashboardSalesGrid = memo(function DashboardSalesGrid({
  copy,
  paymentSummary,
  paymentSummaryCards,
  peakRevenueDay,
  trendRows,
}: {
  copy: DashboardCopy;
  paymentSummary: PaymentSummary;
  paymentSummaryCards: PaymentSummaryCard[];
  peakRevenueDay: TrendPoint | null;
  trendRows: TrendPoint[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SalesTrendCard copy={copy} peakRevenueDay={peakRevenueDay} trendRows={trendRows} />
      <PaymentMethodsCard cards={paymentSummaryCards} copy={copy} paymentSummary={paymentSummary} />
    </div>
  );
});

type ProductSort = "qty" | "revenue";

function TopProductsCard({
  copy,
  loading,
  onTopChange,
  products,
  top,
  topOptions,
}: {
  copy: DashboardCopy;
  loading: boolean;
  onTopChange: (value: string) => void;
  products: ProductRow[];
  top: string;
  topOptions: SelectOption[];
}) {
  const [sort, setSort] = useState<ProductSort>("revenue");
  const sorted = useMemo(
    () => [...products].sort((left, right) => right[sort] - left[sort]),
    [products, sort],
  );
  const total = sorted.reduce((sum, product) => sum + product[sort], 0);
  // How many items carry 80% of the metric — a one-number read of menu concentration.
  const runningShares = sorted.reduce<number[]>(
    (acc, product) => [...acc, (acc[acc.length - 1] ?? 0) + share(product[sort], total)],
    [],
  );
  const eightyPercentCount = runningShares.findIndex((value) => value >= 80) + 1 || sorted.length;
  const format = sort === "revenue" ? formatKip : formatNumber;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <IconTitle icon={Trophy}>{copy.topProducts}</IconTitle>
        <CardDescription>
          {formatNumber(products.length)} {copy.products}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={sort}
            onValueChange={(value) => {
              if (value) setSort(value as ProductSort);
            }}
          >
            <ToggleGroupItem value="revenue">{copy.byRevenue}</ToggleGroupItem>
            <ToggleGroupItem value="qty">{copy.byQty}</ToggleGroupItem>
          </ToggleGroup>
          <Select disabled={loading} value={top} onValueChange={onTopChange}>
            <SelectTrigger size="sm" aria-label={copy.top}>
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
        </CardAction>
      </CardHeader>
      <CardContent>
        {sorted.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{copy.products}</TableHead>
                <TableHead className="text-right">{copy.qty}</TableHead>
                <TableHead className="text-right">{copy.revenue}</TableHead>
                <TableHead className="hidden w-40 md:table-cell">
                  {sort === "revenue" ? copy.revenueShare : copy.shareOfQty}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((product, index) => {
                const productShare = share(product[sort], total);
                return (
                  <TableRow key={`${product.key}-${index}`}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {index < 3 ? <Badge className="tabular-nums">{index + 1}</Badge> : index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="rounded-md">
                          {product.hasImage ? <AvatarImage alt={product.name} src={product.image} /> : null}
                          <AvatarFallback className="rounded-md">{product.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">{product.name}</span>
                          {product.size ? <span className="text-muted-foreground">{product.size}</span> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(product.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatKip(product.revenue)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Progress value={productShare} aria-hidden="true" />
                        <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">
                          {formatPercent(productShare)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
      {sorted.length ? (
        <CardFooter className="flex-wrap gap-x-6 gap-y-1 text-muted-foreground tabular-nums">
          <span>
            <span className="font-medium text-foreground">{copy.driveRevenue}:</span>{" "}
            {formatNumber(eightyPercentCount)} {copy.products} = 80%
          </span>
          <span>
            <span className="font-medium text-foreground">{copy.trackedTotal}:</span> {format(total)}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function TableStatusCard({ copy, summary }: { copy: DashboardCopy; summary: Row }) {
  const total = Math.max(0, numberFrom(summary, "total_tables"));
  const occupancy = Math.min(100, Math.max(0, numberFrom(summary, "occupancy_rate")));
  const config = { occupancy: { color: "var(--info)", label: copy.occupancy } } satisfies ChartConfig;
  // Table states are status, so they use the reserved status tokens (always with a label).
  const stats = [
    { dot: "bg-success", label: copy.available, value: Math.max(0, numberFrom(summary, "available_tables")) },
    { dot: "bg-info", label: copy.occupied, value: Math.max(0, numberFrom(summary, "occupied_tables")) },
    { dot: "bg-warning", label: copy.waiting, value: Math.max(0, numberFrom(summary, "waiting_tables")) },
  ];

  return (
    <Card>
      <CardHeader>
        <IconTitle icon={Armchair}>{copy.tableStatus}</IconTitle>
        <CardDescription>
          {formatNumber(total)} {copy.tables}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <ChartContainer config={config} className="aspect-square h-28 shrink-0">
          <RadialBarChart
            data={[{ key: "occupancy", value: occupancy, fill: "var(--color-occupancy)" }]}
            startAngle={90}
            endAngle={-270}
            innerRadius="76%"
            outerRadius="98%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar dataKey="value" background cornerRadius={8} />
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              <tspan x="50%" y="46%" className="fill-foreground text-lg font-semibold">
                {formatPercent(occupancy)}
              </tspan>
              <tspan x="50%" y="62%" className="fill-muted-foreground">
                {copy.occupancy}
              </tspan>
            </text>
          </RadialBarChart>
        </ChartContainer>
        <div className="flex flex-1 flex-col gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", stat.dot)} />
                <span className="truncate">{stat.label}</span>
              </span>
              <span className="text-base font-semibold tabular-nums">{formatNumber(stat.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelsCard({ copy, rows }: { copy: DashboardCopy; rows: BreakdownRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card>
      <CardHeader>
        <IconTitle icon={Store}>{copy.orderChannels}</IconTitle>
        <CardDescription className="tabular-nums">
          {formatNumber(rows.length)} {copy.channels} · {formatKip(total)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length ? (
          rows
            .map((row, index) => ({ row, slot: categoricalSlot(index) }))
            .sort((left, right) => right.row.value - left.row.value)
            .map(({ row, slot }) => (
              <ShareRow
                key={row.key}
                label={row.label}
                slot={slot}
                value={formatKip(row.value)}
                percent={row.revenuePercent || row.percent || share(row.value, total)}
                detail={`${formatNumber(row.count ?? 0)} ${copy.orders} · ${copy.orderShare} ${formatPercent(row.orderPercent)}`}
              />
            ))
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
    </Card>
  );
}

export const DashboardProductsGrid = memo(function DashboardProductsGrid({
  channelRows,
  copy,
  loading,
  onTopChange,
  products,
  tableSummary,
  top,
  topOptions,
}: {
  channelRows: BreakdownRow[];
  copy: DashboardCopy;
  loading: boolean;
  onTopChange: (value: string) => void;
  products: ProductRow[];
  tableSummary: Row;
  top: string;
  topOptions: SelectOption[];
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <TopProductsCard
        copy={copy}
        loading={loading}
        products={products}
        top={top}
        topOptions={topOptions}
        onTopChange={onTopChange}
      />
      <div className="flex flex-col gap-4">
        <TableStatusCard copy={copy} summary={tableSummary} />
        <ChannelsCard copy={copy} rows={channelRows} />
      </div>
    </div>
  );
});

function AccountingCard({ copy, rows }: { copy: DashboardCopy; rows: AccountingRow[] }) {
  const last = rows.length - 1;

  return (
    <Card>
      <CardHeader>
        <IconTitle icon={Landmark}>{copy.accounting}</IconTitle>
        <CardDescription>{copy.ledger}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {rows.length ? (
          rows.map((row, index) =>
            // The bottom line is what the period actually came to, so it is boxed in the theme colour.
            index === last && row.important ? (
              <div
                key={row.key}
                className="mt-2 flex items-baseline justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-base font-semibold text-primary-text"
              >
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 tabular-nums">{formatKip(row.value)}</span>
              </div>
            ) : (
              <div
                key={row.key}
                className={cn(
                  "flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-b-0",
                  row.important && "font-semibold",
                )}
              >
                <span className={cn("min-w-0 truncate", !row.important && "text-muted-foreground")}>{row.label}</span>
                <span className={cn("shrink-0 tabular-nums", row.negative && "text-destructive")}>
                  {row.negative ? "− " : ""}
                  {formatKip(row.value)}
                </span>
              </div>
            ),
          )
        ) : (
          <EmptyPanel label={copy.noData} />
        )}
      </CardContent>
    </Card>
  );
}

// Status tones: good (success), needs attention (warning), loss (destructive), neutral info.
const highlightTones = {
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/15 text-info",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
} as const;

type Highlight = {
  description: string;
  icon: LucideIcon;
  label: string;
  title: string;
  tone: keyof typeof highlightTones;
};

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
      icon: Trophy,
      tone: "success",
      label: copy.bestProduct,
      title: text(best.prod_name),
      description: `${formatNumber(numberFrom(best, "qty_total"))} ${copy.productsSold} · ${formatKip(numberFrom(best, "revenue_total"))}`,
    },
    // Often the same item as the best seller; listing it twice adds nothing.
    ...(highestRevenueProduct && highestRevenueProduct.name !== text(best.prod_name)
      ? [
          {
            icon: Trophy,
            tone: "success" as const,
            label: copy.highestRevenueProduct,
            title: highestRevenueProduct.name,
            description: `${formatNumber(highestRevenueProduct.qty)} ${copy.productsSold} · ${formatKip(highestRevenueProduct.revenue)}`,
          },
        ]
      : []),
    {
      icon: TrendingDown,
      tone: "warning",
      label: copy.watchProduct,
      title: text(watch.prod_name, text(lowest.prod_name)),
      description: `${formatNumber(numberFrom(watch, "qty_total") || numberFrom(lowest, "qty_total"))} ${copy.productsSold} · ${formatKip(numberFrom(watch, "revenue_total") || numberFrom(lowest, "revenue_total"))}`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <IconTitle icon={Lightbulb}>{copy.insights}</IconTitle>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {items.map((item) => (
            <Item key={item.label} variant="outline">
              <ItemMedia variant="icon" className={cn("size-10 rounded-lg", highlightTones[item.tone])}>
                <item.icon />
              </ItemMedia>
              <ItemContent>
                <ItemDescription>{item.label}</ItemDescription>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemDescription className="tabular-nums">{item.description}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

export const DashboardHealthGrid = memo(function DashboardHealthGrid({
  accountingRows,
  copy,
  highestRevenueProduct,
  insights,
  productSummary,
}: {
  accountingRows: AccountingRow[];
  copy: DashboardCopy;
  highestRevenueProduct: ProductRow | null;
  insights: Row;
  productSummary: Row;
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <AccountingCard copy={copy} rows={accountingRows} />
      <HighlightsCard
        copy={copy}
        highestRevenueProduct={highestRevenueProduct}
        insights={insights}
        productSummary={productSummary}
      />
    </div>
  );
});
