"use client";

import { memo, useMemo, useState } from "react";
import { Info } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DashboardCopy } from "./dashboard-widgets";
import type {
  AccountingRow,
  BreakdownRow,
  ProductRow,
  Row,
  SelectOption,
  Tone,
  TrendPoint
} from "@/features/dashboard/overview/dashboard-view-model";
import {
  asRow,
  formatKip,
  formatNumber,
  formatPercent,
  numberFrom,
  text
} from "@/features/dashboard/overview/dashboard-view-model";

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
    <ChartContainer config={config} className="dashboard-main-chart  w-full">
      <ComposedChart data={chartRows} margin={{ bottom: 0, left: 0, right: 0, top: 14 }}>
        <CartesianGrid vertical={false} strokeDasharray="2 4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis axisLine={false} tickLine={false} tickFormatter={isOrders ? (value) => formatNumber(value) : formatKip} width={isOrders ? 42 : 96} />
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
  peakRevenueDay,
  trendRows
}: {
  accountingRows: AccountingRow[];
  copy: DashboardCopy;
  paymentRows: BreakdownRow[];
  paymentTrendRows: TrendPoint[];
  peakRevenueDay: TrendPoint | null;
  trendRows: TrendPoint[];
}) {
  const [chartMode, setChartMode] = useState<RevenueChartMode>("revenue");
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
          {peakRevenueDay ? (
            <div className="mt-3 border-t border-dashed pt-3">
              <MiniFact
                label={copy.peakDay}
                title={peakRevenueDay.date}
                value={`${formatKip(peakRevenueDay.revenue)} / ${formatNumber(peakRevenueDay.orders)} ${copy.orders}`}
              />
            </div>
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
      <CardContent className="dashboard-channel-content  grid gap-4 p-4 md:grid-cols-[10.5rem_1fr] xl:grid-cols-1">
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
                <p className="font-mono text-xl font-semibold">{formatPercent(main?.revenuePercent || main?.percent || 0)}</p>
                <p className="max-w-28 truncate text-xs text-muted-foreground">{main?.label ?? copy.channels}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {rows.map((row, index) => (
                <div key={row.key} className="dashboard-channel-row grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatNumber(row.count ?? 0)} {copy.orders} / {formatKip(row.value)}
                    </p>
                  </div>
                  <div className="dashboard-channel-share">
                    <span>{copy.orderShare}: {formatPercent(row.orderPercent)}</span>
                    <span>{copy.revenueShare}: {formatPercent(row.revenuePercent || row.percent)}</span>
                  </div>
                </div>
              ))}
              <p className="border-t pt-3 text-xs text-muted-foreground">
                {main ? `${copy.mainChannel}: ${main.label} / ${copy.revenueShare} ${formatPercent(main.revenuePercent || main.percent)}` : copy.noData}
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

function InsightCardsPanel({
  copy,
  highestRevenueProduct,
  insights,
  mainOrderChannel,
  productSummary
}: {
  copy: DashboardCopy;
  highestRevenueProduct: ProductRow | null;
  insights: Row;
  mainOrderChannel: BreakdownRow | null;
  productSummary: Row;
}) {
  const bestProduct = asRow(insights.best_selling_product);
  const watchProduct = asRow(insights.watch_product);
  const cancelledBill = asRow(insights.cancelled_bill);
  const lowestProduct = asRow(productSummary.lowest_selling_product);
  const watchQty = numberFrom(watchProduct, "qty_total") || numberFrom(lowestProduct, "qty_total");
  const watchRevenue = numberFrom(watchProduct, "revenue_total") || numberFrom(lowestProduct, "revenue_total");
  const cards = [
    {
      className: "border-primary/20 bg-primary/10 text-primary",
      label: copy.bestProduct,
      name: text(bestProduct.prod_name),
      value: `${formatNumber(numberFrom(bestProduct, "qty_total"))} ${copy.productsSold} / ${formatKip(numberFrom(bestProduct, "revenue_total"))}`
    },
    mainOrderChannel ? {
      className: "border-primary/20 bg-card text-primary",
      label: copy.mainChannel,
      name: mainOrderChannel.label,
      value: `${formatNumber(mainOrderChannel.count ?? 0)} ${copy.orders} / ${formatKip(mainOrderChannel.value)} / ${copy.orderShare} ${formatPercent(mainOrderChannel.orderPercent)} / ${copy.revenueShare} ${formatPercent(mainOrderChannel.revenuePercent)}`
    } : null,
    highestRevenueProduct ? {
      className: "border-primary/20 bg-muted text-primary",
      label: copy.highestRevenueProduct,
      name: highestRevenueProduct.name,
      value: `${formatNumber(highestRevenueProduct.qty)} ${copy.productsSold} / ${formatKip(highestRevenueProduct.revenue)}`
    } : null,
    {
      className: "border-primary/20 bg-muted text-muted-foreground",
      label: copy.watchProduct,
      name: text(watchProduct.prod_name, text(lowestProduct.prod_name)),
      value: `${formatNumber(watchQty)} ${copy.productsSold} / ${formatKip(watchRevenue)}`
    },
    {
      className: "border-destructive/25 bg-destructive/10 text-destructive",
      label: copy.cancellations,
      name: `${formatNumber(numberFrom(cancelledBill, "count"))} ${copy.orders}`,
      value: formatKip(numberFrom(cancelledBill, "total"))
    }
  ].filter((card): card is { className: string; label: string; name: string; value: string } => Boolean(card));

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
  highestRevenueProduct,
  insights,
  mainOrderChannel,
  productSummary,
  tableSummary
}: {
  channelRows: BreakdownRow[];
  copy: DashboardCopy;
  highestRevenueProduct: ProductRow | null;
  insights: Row;
  mainOrderChannel: BreakdownRow | null;
  productSummary: Row;
  tableSummary: Row;
}) {
  return (
    <div className="dashboard-operations-grid grid gap-4 xl:grid-cols-3">
      <ChannelDonutPanel copy={copy} rows={channelRows} />
      <TableStatusPanel copy={copy} summary={tableSummary} />
      <InsightCardsPanel
        copy={copy}
        highestRevenueProduct={highestRevenueProduct}
        insights={insights}
        mainOrderChannel={mainOrderChannel}
        productSummary={productSummary}
      />
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
            <Table className="dashboard-products-table ">
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
                      <div className="dashboard-product-cell flex min-w-0 items-center gap-3">
                        <Avatar className="dashboard-product-avatar rounded-md" size="lg">
                          {product.hasImage ? <AvatarImage alt={product.name} src={product.image} /> : null}
                          <AvatarFallback>{product.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{product.name}</p>
                          {product.size ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <Badge>{product.size}</Badge>
                            </div>
                          ) : null}
                        </div>
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
            <ChartContainer config={config} className="dashboard-pareto-chart h-72 w-full">
              <ComposedChart data={data} margin={{ bottom: 48, left: 0, right: 0, top: 16 }}>
                <CartesianGrid vertical={false} strokeDasharray="2 4" />
                <XAxis dataKey="label" angle={-30} textAnchor="end" height={62} interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="money" axisLine={false} tickLine={false} tickFormatter={metric === "revenue" ? formatKip : formatNumber} width={metric === "revenue" ? 96 : 42} />
                <YAxis yAxisId="percent" orientation="right" axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} width={36} />
                <Tooltip content={<ChartTooltipContent valueFormatter={(value, name) => name === copy.cumulativePercent ? `${formatNumber(value, 1)}%` : metricFormatter(value)} />} />
                <Bar yAxisId="money" dataKey={metric === "revenue" ? "revenue" : "qty"} fill="var(--color-value)" radius={[2, 2, 0, 0]} />
                <Line yAxisId="percent" dataKey="cumulativePercent" type="monotone" stroke="var(--color-cumulativePercent)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ChartContainer>
            <div className="mt-6 grid gap-3 border-t pt-12 sm:grid-cols-3">
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
