"use client";

import type { ReactNode } from "react";
import { ArrowRightLeft, Check, Merge, Plus, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { TableActionMode, TableActionTable } from "./types";

export function TableActionTab({
  description,
  icon,
  label,
  value
}: {
  description: string;
  icon: ReactNode;
  label: string;
  value: TableActionMode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="group min-h-12 justify-start gap-2.5 whitespace-normal border border-transparent px-3 py-2 text-left data-[state=active]:border-primary/20 data-[state=active]:text-primary"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background/70 text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{label}</span>
        <span className="hidden truncate text-xs font-medium text-muted-foreground sm:block">
          {description}
        </span>
      </span>
    </TabsTrigger>
  );
}

export function TableActionSelectionSummary({
  joinSources,
  mode,
  modeDescription,
  moveTarget,
  sourceTableName
}: {
  joinSources: TableActionTable[];
  mode: TableActionMode;
  modeDescription: string;
  moveTarget: TableActionTable | null;
  sourceTableName: string;
}) {
  if (mode === "move" && moveTarget) {
    return (
      <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-bold text-muted-foreground">
        <span className="truncate text-foreground">{sourceTableName}</span>
        <ArrowRightLeft aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
        <span className="truncate text-primary">{moveTarget.name}</span>
      </p>
    );
  }

  if (mode === "join" && joinSources.length) {
    const visibleNames = joinSources.slice(0, 3).map((source) => source.name).join(", ");
    const remainingCount = joinSources.length - 3;

    return (
      <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-bold text-muted-foreground">
        <span className="min-w-0 truncate text-foreground">
          {visibleNames}{remainingCount > 0 ? ` +${remainingCount}` : ""}
        </span>
        <Merge aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
        <span className="shrink-0 text-primary">{sourceTableName}</span>
      </p>
    );
  }

  return <p className="mt-1 truncate text-sm text-muted-foreground">{modeDescription}</p>;
}

export function TableActionOptionCard({
  mode,
  onClick,
  selected,
  table
}: {
  mode: TableActionMode;
  onClick: () => void;
  selected: boolean;
  table: TableActionTable;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={selected}
      className={cn(
        "h-auto min-h-20 min-w-0 touch-manipulation justify-between rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:border-primary/40 hover:bg-primary/5",
        selected && "border-primary bg-primary/10 ring-2 ring-primary/20 hover:bg-primary/10"
      )}
      onClick={onClick}
    >
      <span className="min-w-0">
        <span title={table.name} className="block truncate text-base font-black text-foreground">
          {table.name}
        </span>
        <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            className={cn(
              "rounded-full text-xs",
              table.status === "busy"
                ? "border-transparent bg-destructive/10 text-destructive"
                : "border-transparent bg-primary/10 text-primary"
            )}
          >
            {table.status === "busy" ? t("common.busy") : t("common.free")}
          </Badge>
          {table.seats !== null ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <UsersRound aria-hidden="true" className="size-3.5" />
              {table.seats} {t("pos.seats")}
            </span>
          ) : null}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "ml-3 grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground [&_svg]:size-4",
          selected && "border-primary bg-primary text-primary-foreground"
        )}
      >
        {selected ? <Check /> : mode === "join" ? <Plus /> : null}
      </span>
    </Button>
  );
}

export function TableActionsLoading() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-20.5 rounded-lg" />
      ))}
    </div>
  );
}
