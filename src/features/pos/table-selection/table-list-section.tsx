"use client";

import { useMemo } from "react";
import { Check, Search, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PosTable, PosZone } from "@/services/pos";
import type { TableStatusFilter } from "./types";
import { filterZones, tableCount, tableSeatCount, tableStatus } from "./utils";

interface TableListSectionProps {
  loading: boolean;
  search: string;
  selectedTable: PosTable | null;
  selectedZoneUuid: string;
  statusFilter: TableStatusFilter;
  zoneOptions: PosZone[];
  zones: PosZone[];
  onSearchChange: (value: string) => void;
  onSelectTable: (table: PosTable) => void;
  onStatusFilterChange: (value: TableStatusFilter) => void;
  onZoneChange: (value: string) => void;
}

export function TableListSection({
  loading,
  onSearchChange,
  onSelectTable,
  onStatusFilterChange,
  onZoneChange,
  search,
  selectedTable,
  selectedZoneUuid,
  statusFilter,
  zoneOptions,
  zones
}: TableListSectionProps) {
  const { t } = useTranslation();
  const visibleZones = useMemo(() => filterZones(zones, search, statusFilter), [search, statusFilter, zones]);
  const allTables = useMemo(() => zones.flatMap((zone) => zone.tables ?? []), [zones]);
  const filterOptions = zoneOptions.length ? zoneOptions : zones;
  const hasVisibleTables = tableCount(visibleZones) > 0;
  const statusCounts = useMemo(() => {
    const busy = allTables.filter((table) => tableStatus(table) === "busy").length;
    const updates = allTables.filter((table) => Boolean(table.customer_order_state)).length;
    return { all: allTables.length, busy, free: allTables.length - busy, update: updates };
  }, [allTables]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-4 py-3 shadow-sm xl:px-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <ZoneChip active={!selectedZoneUuid} label={t("common.all")} onClick={() => onZoneChange("")} />
          {filterOptions.map((zone) => (
            <ZoneChip key={zone.zone_uuid} active={selectedZoneUuid === zone.zone_uuid} label={zone.zone_name} onClick={() => onZoneChange(zone.zone_uuid)} />
          ))}
        </div>
        <div className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <StatusChip active={statusFilter === "all"} label={t("common.all")} value={statusCounts.all} onClick={() => onStatusFilterChange("all")} />
            <StatusChip active={statusFilter === "free"} dot="free" label={t("common.free")} value={statusCounts.free} onClick={() => onStatusFilterChange("free")} />
            <StatusChip active={statusFilter === "busy"} dot="busy" label={t("common.busy")} value={statusCounts.busy} onClick={() => onStatusFilterChange("busy")} />
            <StatusChip active={statusFilter === "update"} dot="update" label={t("pos.tableSelectionNewOrder")} value={statusCounts.update} onClick={() => onStatusFilterChange("update")} />
          </div>
          <div className="relative min-w-0 w-full min-[900px]:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-[42px] rounded-full border-border bg-muted/35 pl-9 shadow-none" value={search} placeholder={t("actions.search")} onChange={(event) => onSearchChange(event.target.value)} />
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 xl:p-5">
        {loading ? (
          <LoadingState label={t("pos.loadingTables")} variant="grid" />
        ) : hasVisibleTables ? (
          <div className="flex min-w-0 flex-col gap-4 pb-4">
            {visibleZones.map((zone) => (
              <section key={zone.zone_uuid} className="flex flex-col gap-3">
                {filterOptions.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black text-muted-foreground">{zone.zone_name}</h2>
                    <Badge>{(zone.tables ?? []).length}</Badge>
                  </div>
                ) : null}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(140px,100%),1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(min(210px,100%),1fr))] sm:gap-3 xl:grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))]">
                  {(zone.tables ?? []).map((table) => (
                    <TableCard key={table.table_uuid} selected={selectedTable?.table_uuid === table.table_uuid} table={table} onOpen={onSelectTable} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title={t("common.noData")} description={t("empty.adjustSearch")} />
        )}
      </div>
    </div>
  );
}

function ZoneChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn(
        "h-[40px] shrink-0 rounded-full px-3.5 font-black shadow-sm transition",
        active ? "shadow-primary/20" : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
      )}
      onClick={onClick}
    >
      {active ? <Check data-icon="inline-start" /> : null}
      <span className="max-w-40 truncate">{label}</span>
    </Button>
  );
}

function StatusChip({
  active,
  dot,
  label,
  onClick,
  value
}: {
  active: boolean;
  dot?: "free" | "busy" | "update";
  label: string;
  onClick: () => void;
  value: number;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn(
        "h-[40px] shrink-0 rounded-full px-3.5 font-black shadow-sm transition",
        active ? "shadow-primary/20" : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
      )}
      onClick={onClick}
    >
      {dot ? <span className={cn("size-2.5 rounded-full", active ? "bg-primary-foreground" : dotClass(dot))} /> : null}
      <span>{label}</span>
      <Badge className={cn("ml-1 border-transparent px-1.5", active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted")}>
        {value}
      </Badge>
    </Button>
  );
}

function dotClass(status: "free" | "busy" | "update") {
  if (status === "busy") return "bg-destructive";
  if (status === "update") return "bg-primary";
  return "bg-primary";
}

function TableCard({
  selected,
  table,
  onOpen
}: {
  selected: boolean;
  table: PosTable;
  onOpen: (table: PosTable) => void;
}) {
  const { t } = useTranslation();
  const busy = tableStatus(table) === "busy";
  const hasUpdate = Boolean(table.customer_order_state);
  const seats = tableSeatCount(table);
  const cardToneClass = hasUpdate
    ? "pos-table-card-alert border-destructive/70 bg-primary/15"
    : busy
      ? "border-primary/75 bg-primary/10"
      : "border-border";
  const bodyToneClass = hasUpdate ? "bg-primary/45" : busy ? "bg-primary/35" : "bg-card";
  const footerToneClass = hasUpdate
    ? "border-primary/50 bg-primary/20"
    : busy
      ? "border-primary/35 bg-primary/15"
      : "border-border bg-muted/50";
  const statusDotClass = busy ? "bg-destructive" : "bg-primary";
  const statusTextClass = busy ? "text-destructive" : "text-primary";

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-xl bg-card shadow-sm transition hover:border-primary/70 hover:shadow-md",
        cardToneClass,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        aria-pressed={selected}
        className="h-auto w-full items-stretch justify-start rounded-none p-0 text-left hover:bg-transparent"
        onClick={() => onOpen(table)}
      >
        <CardContent className="flex min-h-[128px] w-full flex-col p-0 sm:min-h-[168px] xl:min-h-[178px]">
          <div
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center px-2 py-4 sm:px-4 sm:py-6",
              bodyToneClass
            )}
          >
            {hasUpdate ? (
              <Badge className="absolute left-1/2 top-0 h-4 -translate-x-1/2 rounded-b-[10px] rounded-t-none border-transparent bg-destructive px-3 py-0 text-[9px] font-bold leading-4 tracking-wide text-destructive-foreground shadow-none">
                NEW
              </Badge>
            ) : null}
            <span
              className={cn(
                "absolute right-3 top-3 size-3 rounded-full border-[3px] border-background shadow-sm sm:right-4 sm:top-4 sm:size-4 sm:border-4",
                statusDotClass
              )}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {t("nav.table")}
            </span>
            <span className="mt-1 text-[22px] font-bold leading-none tracking-normal text-foreground sm:mt-1.5 sm:text-[28px]">
              {table.table_name}
            </span>
            <span className={cn("mt-2 text-xs font-semibold sm:mt-2.5", statusTextClass)}>
              {busy ? t("common.busy") : t("common.free")}
            </span>
          </div>
          <div
            className={cn(
              "flex h-[34px] items-center gap-1.5 border-t px-3 text-xs text-muted-foreground sm:h-[40px] sm:px-4",
              footerToneClass
            )}
          >
            <UserRound />
            <span>{seats || "-"}</span>
          </div>
        </CardContent>
      </Button>
    </Card>
  );
}
