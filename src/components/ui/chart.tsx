"use client";

import * as React from "react";
import { ResponsiveContainer, type TooltipContentProps } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
    icon?: React.ComponentType;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

function chartVars(config: ChartConfig) {
  return Object.entries(config).reduce<Record<string, string>>((vars, [key, item]) => {
    if (item.color) vars[`--color-${key}`] = item.color;
    return vars;
  }, {});
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactElement;
}) {
  const generatedId = React.useId();
  const chartId = `chart-${id ?? generatedId.replace(/:/g, "")}`;
  const contextValue = React.useMemo(() => ({ config }), [config]);
  const chartStyle = React.useMemo(
    () => ({ ...chartVars(config), ...style }) as React.CSSProperties,
    [config, style]
  );

  return (
    <ChartContext.Provider value={contextValue}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line]:stroke-border/70",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        style={chartStyle}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
  valueFormatter
}: Partial<TooltipContentProps<number | string, string>> & {
  className?: string;
  hideLabel?: boolean;
  valueFormatter?: (value: number | string, name: string) => React.ReactNode;
}) {
  const { config } = useChart();
  const rows = payload?.filter((item) => item.value !== undefined && item.value !== null) ?? [];

  if (!active || !rows.length) return null;

  return (
    <div
      className={cn(
        "grid min-w-36 gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur",
        className
      )}
    >
      {!hideLabel ? <div className="font-bold text-foreground">{label}</div> : null}
      <div className="grid gap-1.5">
        {rows.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const itemConfig = config[key];
          const name = String(item.name ?? itemConfig?.label ?? key);
          const color = item.color ?? itemConfig?.color ?? `var(--color-${key})`;

          return (
            <div key={`${key}-${name}`} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{name}</span>
              <span className="font-mono font-bold text-foreground">
                {valueFormatter ? valueFormatter(item.value as number | string, name) : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
