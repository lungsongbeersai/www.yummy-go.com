"use client";

import { type ReactNode } from "react";
import { Power, PowerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function BadgeList({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: Array<{ label: string; value: string }>;
}) {
  if (!items.length) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge
          key={item.value}
          variant="outline"
          className="max-w-full truncate bg-muted/40 font-medium"
        >
          {item.label}
        </Badge>
      ))}
    </div>
  );
}

export function PrinterStatusBadge({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  const Icon = active ? Power : PowerOff;

  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full px-2.5 py-1 font-black whitespace-nowrap",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </Badge>
  );
}

export function PrinterDetailMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/15 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-semibold">{value}</div>
    </div>
  );
}
