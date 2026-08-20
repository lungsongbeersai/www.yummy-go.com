"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Search, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zoneOrderAlertCount } from "@/lib/pos/order-alerts";
import type { PosTable, PosZone } from "@/services/pos";
import type { TableStatusFilter } from "./types";
import { filterZones, tableCount, tableSeatCount, tableStatus } from "./utils";

interface TableListSectionProps {
  loading: boolean;
  search: string;
  selectedTable: PosTable | null;
  statusFilter: TableStatusFilter;
  zoneOptions: PosZone[];
  zones: PosZone[];
  onSearchChange: (value: string) => void;
  onSelectTable: (table: PosTable) => void;
  onStatusFilterChange: (value: TableStatusFilter) => void;
}

export function TableListSection({
  loading,
  onSearchChange,
  onSelectTable,
  onStatusFilterChange,
  search,
  selectedTable,
  statusFilter,
  zoneOptions,
  zones
}: TableListSectionProps) {
  const { t } = useTranslation();
  // ทุกโซนแสดงพร้อมกันเสมอ (ไม่ยิง fetch ซ้ำตอนเปลี่ยนโซน) — คลิกชิปแค่เลื่อน
  // จอไปยัง section ของโซนนั้น ค่านี้จึงเป็นแค่ state ไว้ไฮไลต์ชิปที่กดล่าสุด
  const [selectedZoneUuid, setSelectedZoneUuid] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const zoneSectionRefs = useRef(new Map<string, HTMLElement>());
  const visibleZones = useMemo(() => filterZones(zones, search, statusFilter), [search, statusFilter, zones]);
  const allTables = useMemo(() => zones.flatMap((zone) => zone.tables ?? []), [zones]);
  const filterOptions = zoneOptions.length ? zoneOptions : zones;
  const hasVisibleTables = tableCount(visibleZones) > 0;
  const totalOrderAlertCount = useMemo(
    () => filterOptions.reduce((sum, zone) => sum + zoneOrderAlertCount(zone), 0),
    [filterOptions]
  );
  const statusCounts = useMemo(() => {
    const busy = allTables.filter((table) => tableStatus(table) === "busy").length;
    const updates = allTables.filter((table) => Boolean(table.customer_order_state)).length;
    return { all: allTables.length, busy, free: allTables.length - busy, update: updates };
  }, [allTables]);

  const scrollToZone = useCallback((zoneUuid: string) => {
    setSelectedZoneUuid(zoneUuid);
    if (!zoneUuid) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    zoneSectionRefs.current.get(zoneUuid)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-4 py-3 shadow-sm xl:px-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <ZoneChip
            active={!selectedZoneUuid}
            alertCount={totalOrderAlertCount}
            alertAriaLabel={t("pos.zoneNewOrderAria", { zone: t("common.all"), count: totalOrderAlertCount })}
            label={t("common.all")}
            onClick={() => scrollToZone("")}
          />
          {filterOptions.map((zone) => {
            const alertCount = zoneOrderAlertCount(zone);
            return (
              <ZoneChip
                key={zone.zone_uuid}
                active={selectedZoneUuid === zone.zone_uuid}
                alertCount={alertCount}
                alertAriaLabel={t("pos.zoneNewOrderAria", { zone: zone.zone_name, count: alertCount })}
                label={zone.zone_name}
                onClick={() => scrollToZone(zone.zone_uuid)}
              />
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <StatusChip active={statusFilter === "all"} label={t("common.all")} value={statusCounts.all} onClick={() => onStatusFilterChange("all")} />
            <StatusChip active={statusFilter === "free"} dot="free" label={t("common.free")} value={statusCounts.free} onClick={() => onStatusFilterChange("free")} />
            <StatusChip active={statusFilter === "busy"} dot="busy" label={t("common.busy")} value={statusCounts.busy} onClick={() => onStatusFilterChange("busy")} />
            <StatusChip active={statusFilter === "update"} dot="update" label={t("pos.tableSelectionNewOrder")} value={statusCounts.update} onClick={() => onStatusFilterChange("update")} />
          </div>
          <div className="relative min-w-0 w-full xl:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10.5 rounded-full border-border bg-muted/35 pl-9 shadow-none" value={search} placeholder={t("actions.search")} onChange={(event) => onSearchChange(event.target.value)} />
          </div>
        </div>
      </div>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 xl:p-5">
        {loading ? (
          <LoadingState label={t("pos.loadingTables")} variant="posGrid" />
        ) : hasVisibleTables ? (
          <div className="flex min-w-0 flex-col gap-4 pb-4">
            {visibleZones.map((zone) => (
              <section
                key={zone.zone_uuid}
                ref={(el) => {
                  if (el) zoneSectionRefs.current.set(zone.zone_uuid, el);
                  else zoneSectionRefs.current.delete(zone.zone_uuid);
                }}
                className="flex flex-col gap-3"
              >
                {filterOptions.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black text-muted-foreground">{zone.zone_name}</h2>
                    <Badge>{(zone.tables ?? []).length}</Badge>
                  </div>
                ) : null}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(min(164px,100%),1fr))] lg:grid-cols-[repeat(auto-fill,minmax(min(180px,100%),1fr))] xl:grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))]">
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

function ZoneChip({
  active,
  alertAriaLabel,
  alertCount = 0,
  label,
  onClick
}: {
  active: boolean;
  alertAriaLabel?: string;
  alertCount?: number;
  label: string;
  onClick: () => void;
}) {
  const hasAlert = alertCount > 0;

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={cn(
        "h-10 shrink-0 rounded-full px-3.5 font-black shadow-sm transition",
        active ? "shadow-primary/20" : "border-border bg-card hover:border-primary/30 hover:bg-primary/5",
        // ใช้ ring กะพริบแทนพื้นหลังกะพริบ — พื้นหลังกะพริบชนสี text-destructive จนคอนทราสต์ไม่ผ่าน WCAG AA
        hasAlert && "pos-chip-alert-ring"
      )}
      onClick={onClick}
    >
      {active ? <Check data-icon="inline-start" /> : null}
      <span className="max-w-40 truncate">{label}</span>
      {hasAlert ? (
        <Badge
          aria-label={alertAriaLabel}
          className="ml-1 min-w-4.5 justify-center border-transparent bg-destructive px-1 text-[10px] text-destructive-foreground"
        >
          {alertCount}
        </Badge>
      ) : null}
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
        "h-10 shrink-0 rounded-full px-3.5 font-black shadow-sm transition",
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
  // hasUpdate ใช้โทนแดง (destructive) แทนเขียว (primary) ที่ busy ใช้ เพื่อให้แยกกันได้ชัดจากระยะไกล
  // แต่ต้องเป็นพื้นทึบนิ่ง ไม่ใช่ text สีแดง — กันปัญหาคอนทราสต์แบบเดียวกับ ZoneChip
  const cardToneClass = hasUpdate
    ? "pos-table-card-alert border-destructive/70"
    : busy
      ? "border-primary/75 bg-primary/10"
      : "border-border";
  const bodyToneClass = hasUpdate ? "bg-destructive/18" : busy ? "bg-primary/35" : "bg-card";
  const footerToneClass = hasUpdate
    ? "border-destructive/30 bg-destructive/12"
    : busy
      ? "border-primary/35 bg-primary/15"
      : "border-border bg-muted/50";
  const statusDotClass = busy ? "bg-destructive" : "bg-primary";
  const statusTextClass = hasUpdate ? "text-foreground" : busy ? "text-destructive" : "text-primary";

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={cn(
        "cursor-pointer overflow-hidden rounded-xl bg-card p-0 shadow-sm outline-none transition hover:border-primary/70 hover:shadow-md focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        cardToneClass,
        selected && "border-primary/90 bg-primary/10 shadow-lg shadow-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      onClick={() => onOpen(table)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen(table);
      }}
    >
      <CardContent className="flex min-h-36 w-full flex-col p-0 sm:min-h-38 lg:min-h-40 xl:min-h-44">
        <div
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center px-2 py-3 sm:px-3 sm:py-4",
            bodyToneClass
          )}
        >
          {selected ? (
            <Badge
              className={cn(
                "absolute left-2 z-10 max-w-[calc(100%-4rem)] gap-1 rounded-full border-primary/30 bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground shadow-sm [&_svg]:size-3 [&_svg]:shrink-0 sm:left-3",
                hasUpdate ? "top-5" : "top-2 sm:top-3"
              )}
            >
              <Check aria-hidden="true" />
              <span className="truncate">{t("pos.selectedTable")}</span>
            </Badge>
          ) : null}
          {hasUpdate ? (
            <Badge className="absolute left-1/2 top-0 h-4 -translate-x-1/2 rounded-b-[10px] rounded-t-none border-transparent bg-destructive px-3 py-0 text-[9px] font-bold leading-4 tracking-wide text-destructive-foreground shadow-none">
              NEW
            </Badge>
          ) : null}
          <span
            className={cn(
              "absolute right-2.5 top-2.5 size-3 rounded-full border-[3px] border-background shadow-sm sm:right-3 sm:top-3",
              statusDotClass
            )}
          />
          <span className="text-xs font-medium text-muted-foreground">
            {t("nav.table")}
          </span>
          <span className="mt-1 text-[19px] font-bold leading-none tracking-normal text-foreground sm:text-[22px]">
            {table.table_name}
          </span>
          <span className={cn("mt-1.5 text-xs font-semibold sm:mt-2", statusTextClass)}>
            {busy ? t("common.busy") : t("common.free")}
          </span>
        </div>
        <div
          className={cn(
            "flex h-8 items-center gap-1.5 border-t px-3 text-xs text-muted-foreground sm:h-8.5",
            footerToneClass
          )}
        >
          <UserRound />
          <span>{seats || "-"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
