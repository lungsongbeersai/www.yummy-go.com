"use client";

import { useId } from "react";
import {
  Bar,
  BarChart,
  BarStack,
  CartesianGrid,
  Cell,
  Label,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { VisualEffectsTier } from "@/lib/visual-effects-tier";
import {
  formatKip,
  formatNumber,
  plottedRevenue,
  unsplitRevenue,
  type DashboardCopy,
  type TrendBucket,
  type TrendMetric,
} from "@/features/dashboard/overview/dashboard-view-model";

// The only module on the dashboard that imports recharts (see dashboard-chart-boundary.test.ts):
// it is fetched only when the period has at least two days to compare.
//
// Dataviz notes: revenue stacks one segment per payment method on a single money axis, so the
// bar height reads as the day's total and the segments as the split. Debt is hatched as well
// as coloured (the same "owed" pattern as the plate). The bill view is one neutral series with
// the busiest day in the theme primary. Nothing here relies on opacity: Android compat mode
// forces SVG opacity to 1.

const compactNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" });

const animationByTier = {
  full: { duration: 600, stagger: 80 },
  lite: { duration: 400, stagger: 0 },
} as const;

// "other" is revenue the cash/transfer/debt split does not cover, so every bar is as tall as the
// day's revenue — the same total the average line, the peak dot and the payment-split bar use.
const segmentKeys = ["cash", "transfer", "debt", "other"] as const;
type SegmentKey = (typeof segmentKeys)[number];

const swatchClassNames: Record<SegmentKey, string> = {
  cash: "bg-chart-cat-1",
  debt: "bg-hatch text-chart-cat-3",
  other: "bg-muted-foreground",
  transfer: "bg-chart-cat-2",
};

function TooltipRow({ label, swatch, value }: { label: string; swatch: string; value: string }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-xs", swatch)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

export function DailySalesChart({
  average,
  bucketed,
  copy,
  labels,
  metric,
  peakKey,
  rows,
  tier,
}: {
  /** Daily average of the shown metric over the raw days (plotted revenue, or bills). */
  average: number;
  /** Rows are weekly/monthly sums: the daily average line and peak dot would not match them. */
  bucketed: boolean;
  copy: DashboardCopy;
  labels: Record<SegmentKey, string>;
  metric: TrendMetric;
  peakKey: string | null;
  rows: TrendBucket[];
  tier: VisualEffectsTier;
}) {
  // useId's format has changed across React versions; keep only characters valid in url(#…).
  const hatchId = `dashboard-debt-hatch-${useId().replace(/[^\w-]/g, "")}`;
  const animate = tier !== "static";
  const timing = tier === "static" ? null : animationByTier[tier];
  const isRevenue = metric === "revenue";
  const data = rows.map((row) => ({ ...row, other: unsplitRevenue(row) }));
  const hasOther = data.some((row) => row.other > 0);
  const stackKeys = hasOther ? segmentKeys : segmentKeys.filter((key) => key !== "other");
  const bucketByKey = new Map(rows.map((row) => [row.key, row]));
  const peak = peakKey ? bucketByKey.get(peakKey) : undefined;
  const config = {
    cash: { color: "var(--chart-cat-1)", label: labels.cash },
    debt: { color: "var(--chart-cat-3)", label: labels.debt },
    orders: { color: "var(--muted-foreground)", label: copy.orders },
    other: { color: "var(--muted-foreground)", label: labels.other },
    transfer: { color: "var(--chart-cat-2)", label: labels.transfer },
  } satisfies ChartConfig;
  const peakValue = peak ? (isRevenue ? plottedRevenue(peak) : peak.orders) : 0;
  const formatValue = (value: unknown) => (isRevenue ? formatKip(value) : `${formatNumber(value)} ${copy.orders}`);
  // The axis runs on the unique bucket key: day labels repeat across a month boundary ("1" in
  // January and February), and a repeated category would lose the peak dot and merge tooltips.
  const bucketLabel = (key: unknown) => bucketByKey.get(String(key))?.label ?? String(key);

  return (
    // On xl the card is as tall as the ledger + channels rail beside it; the chart takes that room.
    <ChartContainer config={config} className="aspect-auto h-64 w-full lg:h-80 xl:h-auto xl:min-h-80 xl:flex-1">
      <BarChart accessibilityLayer data={data} barCategoryGap="20%" margin={{ left: 0, right: 8, top: 24 }}>
        <defs>
          {/* var() only resolves in CSS, not in SVG presentation attributes, hence style. */}
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" style={{ fill: "var(--card)" }} />
            <line x1="0" y1="0" x2="0" y2="6" strokeWidth="3" style={{ stroke: "var(--color-debt)" }} />
          </pattern>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="key"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          minTickGap={12}
          interval="preserveStartEnd"
          tickFormatter={bucketLabel}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          width={44}
          tickFormatter={(value: number) => compactNumber.format(value)}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const bucket = bucketByKey.get(String(payload[0]?.payload?.key ?? ""));
                if (!bucket) return null;
                // An edge week/month of the range holds fewer days; say so, so it is not read as a dip.
                return bucketed ? `${bucket.label} · ${formatNumber(bucket.days)} ${copy.days}` : bucket.date;
              }}
              formatter={(value, name) => {
                const key = String(name) as SegmentKey | "orders";
                return key === "orders" ? (
                  <TooltipRow label={copy.orders} swatch="bg-muted-foreground" value={formatValue(value)} />
                ) : (
                  <TooltipRow label={labels[key]} swatch={swatchClassNames[key]} value={formatKip(value)} />
                );
              }}
            />
          }
        />
        {isRevenue ? (
          // The stack-level radius rounds the top of the whole bar, whichever segment is on top.
          <BarStack radius={[4, 4, 0, 0]}>
            {stackKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={key === "debt" ? `url(#${hatchId})` : `var(--color-${key})`}
                maxBarSize={28}
                stroke="var(--card)"
                strokeWidth={1}
                isAnimationActive={animate}
                animationBegin={(timing?.stagger ?? 0) * index}
                animationDuration={timing?.duration}
                animationEasing="ease-out"
              />
            ))}
          </BarStack>
        ) : (
          <Bar
            dataKey="orders"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={animate}
            animationDuration={timing?.duration}
            animationEasing="ease-out"
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={row.key === peakKey ? "var(--primary)" : "var(--color-orders)"} />
            ))}
          </Bar>
        )}
        {!bucketed && rows.length > 1 && average > 0 ? (
          <ReferenceLine y={average} stroke="var(--foreground)" strokeDasharray="4 4" ifOverflow="extendDomain">
            <Label
              value={`${copy.dailyAverage} ${compactNumber.format(average)}`}
              position="insideTopLeft"
              className="fill-muted-foreground text-2xs font-semibold"
            />
          </ReferenceLine>
        ) : null}
        {!bucketed && peak && peakValue > 0 ? (
          <ReferenceDot x={peak.key} y={peakValue} r={4} fill="var(--foreground)" stroke="var(--card)" strokeWidth={2}>
            <Label value={compactNumber.format(peakValue)} position="top" offset={8} className="fill-foreground text-2xs font-semibold" />
          </ReferenceDot>
        ) : null}
      </BarChart>
    </ChartContainer>
  );
}
