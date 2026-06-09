"use client";

import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Map as MapIcon, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table as DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SettingsMobileCard,
  SettingsMobileList,
  SettingsMobileMeta,
  SettingsMobileMetaGrid,
  SettingsRowActions,
  SettingsTableScroll
} from "@/features/settings/shared/settings-shell";
import type { Table as DiningTable } from "@/services/table";
import type { Zone } from "@/services/zone";
import { TableChargeBadge, TableIcon, TableIdentity, TableStatusBadge } from "./table-display";
import type { TableGroupedRows } from "./table-types";
import {
  tableChargeActive,
  tableId,
  tableName,
  tableSeats,
  tableStatus,
  tableValue,
  zoneLabel
} from "./table-utils";

export function TableListSurface({
  allCollapsed,
  allSelected,
  backgroundLoading,
  collapsedZones,
  displayTotal,
  groupedRows,
  page,
  pageEnd,
  pageStart,
  serviceChargeRateLabel,
  selectedRows,
  title,
  toolbar,
  totalPages,
  zoneById,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleAllZones,
  onToggleSelected,
  onToggleZoneCollapse
}: {
  allCollapsed: boolean;
  allSelected: boolean;
  backgroundLoading: boolean;
  collapsedZones: Set<string>;
  displayTotal: number;
  groupedRows: TableGroupedRows;
  page: number;
  pageEnd: number;
  pageStart: number;
  serviceChargeRateLabel: string;
  selectedRows: Set<string>;
  title: string;
  toolbar: ReactNode;
  totalPages: number;
  zoneById: Map<string, Zone>;
  onDelete: (row: DiningTable) => void;
  onEdit: (row: DiningTable) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleAllZones: (collapsed: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleZoneCollapse: (zoneId: string) => void;
}) {
  const { t } = useTranslation();
  const hasGroups = groupedRows.length > 0;
  const groupToggleAction = hasGroups ? (
    <Button
      size="xs"
      type="button"
      variant="outline"
      onClick={() => onToggleAllZones(!allCollapsed)}
    >
      {allCollapsed ? <ChevronsUpDown data-icon="inline-start" /> : <ChevronsDownUp data-icon="inline-start" />}
      {allCollapsed ? t("actions.expandAll") : t("actions.collapseAll")}
    </Button>
  ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-5">
        <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-sm font-black">{t("settings.tableList")}</p>
              {groupToggleAction}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("common.showingRange", { start: pageStart, end: pageEnd, total: displayTotal })} - {t("common.page", { current: page, total: totalPages })}
            </p>
          </div>
          <div className="min-w-0 xl:max-w-[48rem]">{toolbar}</div>
        </div>
        {backgroundLoading ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner aria-hidden />
            {t("settings.refreshingTableList")}
          </div>
        ) : null}
      </div>
      {hasGroups ? (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <TableDesktopList
              allSelected={allSelected}
              collapsedZones={collapsedZones}
              groupedRows={groupedRows}
              selectedRows={selectedRows}
              serviceChargeRateLabel={serviceChargeRateLabel}
              zoneById={zoneById}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleAll={onToggleAll}
              onToggleSelected={onToggleSelected}
              onToggleZoneCollapse={onToggleZoneCollapse}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
            <TableMobileList
              collapsedZones={collapsedZones}
              groupedRows={groupedRows}
              selectedRows={selectedRows}
              serviceChargeRateLabel={serviceChargeRateLabel}
              zoneById={zoneById}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggleSelected={onToggleSelected}
              onToggleZoneCollapse={onToggleZoneCollapse}
            />
          </div>
        </>
      ) : (
        <div className="flex min-h-72 flex-1 items-center justify-center p-4">
          <Empty className="max-w-md border border-dashed bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Table2 aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{t("settings.noRecords", { title: title.toLowerCase() })}</EmptyTitle>
              <EmptyDescription>{t("empty.adjustSearch")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );
}

function TableDesktopList({
  allSelected,
  collapsedZones,
  groupedRows,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected,
  onToggleZoneCollapse,
  selectedRows,
  serviceChargeRateLabel,
  zoneById
}: {
  allSelected: boolean;
  collapsedZones: Set<string>;
  groupedRows: TableGroupedRows;
  onDelete: (row: DiningTable) => void;
  onEdit: (row: DiningTable) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleZoneCollapse: (zoneId: string) => void;
  selectedRows: Set<string>;
  serviceChargeRateLabel: string;
  zoneById: Map<string, Zone>;
}) {
  const { t } = useTranslation();

  return (
    <SettingsTableScroll>
      <DataTable className="min-w-[960px]">
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            <TableHead className="w-10 px-2">
              <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)} />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap px-2 text-center">{t("fields.no")}</TableHead>
            <TableHead>{t("nav.table")}</TableHead>
            <TableHead>{t("fields.table_qty")}</TableHead>
            <TableHead>{t("fields.table_status")}</TableHead>
            <TableHead>{t("fields.charge_status")}</TableHead>
            <TableHead className="w-16 text-right">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedRows.map((group) => {
            const collapsed = collapsedZones.has(group.zoneId);
            return (
              <Fragment key={group.zoneId}>
                <TableRow className="bg-muted/35 hover:bg-muted/50">
                  <TableCell colSpan={7} className="px-2 py-0">
                    <ZoneToggleButton
                      collapsed={collapsed}
                      count={group.totalTables ?? group.tables.length}
                      zoneId={group.zoneId}
                      zoneName={group.zoneName}
                      variant="ghost"
                      onToggle={onToggleZoneCollapse}
                    />
                  </TableCell>
                </TableRow>
                {collapsed ? null : group.rows.length ? (
                  group.rows.map(({ row, rowNumber }) => (
                    <TableDataRow
                      key={tableId(row) || rowNumber}
                      row={row}
                      rowNumber={rowNumber}
                      selectedRows={selectedRows}
                      serviceChargeRateLabel={serviceChargeRateLabel}
                      zoneById={zoneById}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onToggleSelected={onToggleSelected}
                    />
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">
                      {t("settings.emptyZoneTables")}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </DataTable>
    </SettingsTableScroll>
  );
}

function TableDataRow({
  onDelete,
  onEdit,
  onToggleSelected,
  row,
  rowNumber,
  selectedRows,
  serviceChargeRateLabel,
  zoneById
}: {
  onDelete: (row: DiningTable) => void;
  onEdit: (row: DiningTable) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  row: DiningTable;
  rowNumber: number;
  selectedRows: Set<string>;
  serviceChargeRateLabel: string;
  zoneById: Map<string, Zone>;
}) {
  const { t } = useTranslation();
  const id = tableId(row);
  const selected = selectedRows.has(id);
  const status = tableStatus(row);
  const chargeActive = tableChargeActive(row);
  const chargeLabel = chargeActive ? `${t("common.active")} / ${serviceChargeRateLabel}` : t("common.inactive");

  return (
    <TableRow className="h-14" data-state={selected ? "selected" : undefined}>
      <TableCell className="w-10 px-2">
        <Checkbox aria-label={t("common.selectRow", { name: tableName(row) })} checked={selected} onChange={(event) => onToggleSelected(id, event.target.checked)} />
      </TableCell>
      <TableCell className="w-px whitespace-nowrap px-2 text-center text-sm font-black tabular-nums text-muted-foreground">{rowNumber}</TableCell>
      <TableCell className="max-w-[28rem]">
        <TableIdentity row={row} zoneName={tableZoneName(row, zoneById)} />
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums" translate="no">{tableSeats(row)}</TableCell>
      <TableCell>
        <TableStatusBadge status={status} />
      </TableCell>
      <TableCell>
        <TableChargeBadge active={chargeActive} label={chargeLabel} />
      </TableCell>
      <TableCell className="text-right">
        <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
      </TableCell>
    </TableRow>
  );
}

function TableMobileList({
  collapsedZones,
  groupedRows,
  onDelete,
  onEdit,
  onToggleSelected,
  onToggleZoneCollapse,
  selectedRows,
  serviceChargeRateLabel,
  zoneById
}: {
  collapsedZones: Set<string>;
  groupedRows: TableGroupedRows;
  onDelete: (row: DiningTable) => void;
  onEdit: (row: DiningTable) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleZoneCollapse: (zoneId: string) => void;
  selectedRows: Set<string>;
  serviceChargeRateLabel: string;
  zoneById: Map<string, Zone>;
}) {
  const { t } = useTranslation();

  return (
    <SettingsMobileList>
      {groupedRows.map((group) => {
        const collapsed = collapsedZones.has(group.zoneId);
        return (
          <div key={group.zoneId} className="flex flex-col gap-2">
            <ZoneToggleButton
              collapsed={collapsed}
              count={group.totalTables ?? group.tables.length}
              zoneId={group.zoneId}
              zoneName={group.zoneName}
              variant="outline"
              onToggle={onToggleZoneCollapse}
            />
            {collapsed ? null : group.rows.length ? (
              group.rows.map(({ row, rowNumber }) => (
                <TableMobileCard
                  key={tableId(row) || rowNumber}
                  row={row}
                  rowNumber={rowNumber}
                  selectedRows={selectedRows}
                  serviceChargeRateLabel={serviceChargeRateLabel}
                  zoneById={zoneById}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onToggleSelected={onToggleSelected}
                />
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t("settings.emptyZoneTables")}
              </div>
            )}
          </div>
        );
      })}
    </SettingsMobileList>
  );
}

function TableMobileCard({
  onDelete,
  onEdit,
  onToggleSelected,
  row,
  rowNumber,
  selectedRows,
  serviceChargeRateLabel,
  zoneById
}: {
  onDelete: (row: DiningTable) => void;
  onEdit: (row: DiningTable) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  row: DiningTable;
  rowNumber: number;
  selectedRows: Set<string>;
  serviceChargeRateLabel: string;
  zoneById: Map<string, Zone>;
}) {
  const { t } = useTranslation();
  const id = tableId(row);
  const selected = selectedRows.has(id);
  const status = tableStatus(row);
  const chargeActive = tableChargeActive(row);
  const chargeLabel = chargeActive ? `${t("common.active")} / ${serviceChargeRateLabel}` : t("common.inactive");

  return (
    <SettingsMobileCard
      actions={<SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />}
      badges={<Badge className="shrink-0 tabular-nums">{rowNumber}</Badge>}
      checked={selected}
      leading={<TableIcon />}
      selectLabel={t("common.selectRow", { name: tableName(row) })}
      selected={selected}
      subtitle={<span className="block truncate">{tableZoneName(row, zoneById)}</span>}
      title={tableName(row)}
      onCheckedChange={(checked) => onToggleSelected(id, checked)}
    >
      <SettingsMobileMetaGrid>
        <SettingsMobileMeta label={t("fields.table_qty")} value={<span className="tabular-nums" translate="no">{tableSeats(row)}</span>} />
        <SettingsMobileMeta label={t("fields.table_status")} value={<TableStatusBadge status={status} />} />
        <SettingsMobileMeta label={t("fields.charge_status")} value={<TableChargeBadge active={chargeActive} label={chargeLabel} />} />
      </SettingsMobileMetaGrid>
    </SettingsMobileCard>
  );
}

function ZoneToggleButton({
  collapsed,
  count,
  onToggle,
  variant,
  zoneId,
  zoneName
}: {
  collapsed: boolean;
  count: number;
  onToggle: (zoneId: string) => void;
  variant: "ghost" | "outline";
  zoneId: string;
  zoneName: string;
}) {
  const { t } = useTranslation();

  return (
    <Button
      aria-expanded={!collapsed}
      aria-label={collapsed ? t("settings.expandZone", { zone: zoneName }) : t("settings.collapseZone", { zone: zoneName })}
      className={variant === "ghost" ? "h-auto w-full justify-start px-2 py-2 text-left font-bold" : "min-h-11 justify-start px-3 text-left"}
      type="button"
      variant={variant}
      onClick={() => onToggle(zoneId)}
    >
      {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      <MapIcon data-icon="inline-start" />
      <span className="min-w-0 flex-1 truncate">{zoneName}</span>
      <Badge className="bg-primary/10 text-primary tabular-nums">{count}</Badge>
    </Button>
  );
}

function tableZoneName(row: DiningTable, zoneById: Map<string, Zone>) {
  const relatedZone = zoneById.get(tableValue(row, "zone_uuid_fk"));
  return relatedZone ? zoneLabel(relatedZone) : zoneLabel(row);
}
