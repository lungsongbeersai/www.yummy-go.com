"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronRight, Map as MapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { Table as DataTable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsRowActions } from "@/features/settings/shared/settings-shell";
import type { Table as DiningTable } from "@/services/table";
import { TableChargeBadge, TableIcon, TableStatusBadge } from "./table-display";
import type { TableGroupedRows } from "./table-types";
import { tableChargeActive, tableId, tableName, tableSeats, tableStatus } from "./table-utils";

type TableListProps = {
  collapsedZones: Set<string>;
  groupedRows: TableGroupedRows;
  selectedRows: Set<string>;
  serviceChargeRateLabel: string;
  onDelete: (row: DiningTable) => void;
  onEdit: (row: DiningTable) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleZoneCollapse: (zoneId: string) => void;
};

function useChargeLabel(serviceChargeRateLabel: string) {
  const { t } = useTranslation();
  return (row: DiningTable) =>
    tableChargeActive(row) ? `${t("fields.charge_status")} · ${serviceChargeRateLabel}` : `${t("fields.charge_status")} · ${t("common.inactive")}`;
}

// Collapsible zone header shared by the table and the cards: chevron, zone, table count.
function ZoneGroupToggle({
  collapsed,
  count,
  name,
  onToggle
}: {
  collapsed: boolean;
  count: number;
  name: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      className="w-full justify-start"
      aria-expanded={!collapsed}
      aria-label={collapsed ? t("settings.expandZone", { zone: name }) : t("settings.collapseZone", { zone: name })}
      onClick={onToggle}
    >
      {collapsed ? <ChevronRight data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      <MapIcon data-icon="inline-start" />
      <span className="truncate">{name}</span>
      <Badge variant="secondary" className="tabular-nums">
        {count}
      </Badge>
    </Button>
  );
}

// Tables are grouped under their zone; the group header replaces the zone name the old rows
// repeated under every table.
export function TableSettingsTable({
  allSelected,
  collapsedZones,
  groupedRows,
  selectedRows,
  serviceChargeRateLabel,
  onDelete,
  onEdit,
  onToggleAll,
  onToggleSelected,
  onToggleZoneCollapse
}: TableListProps & { allSelected: boolean; onToggleAll: (checked: boolean) => void }) {
  const { t } = useTranslation();
  const chargeLabel = useChargeLabel(serviceChargeRateLabel);
  const columnCount = 7;

  return (
    <DataTable containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow>
          <TableHead className="w-px">
            <Checkbox aria-label={t("common.selectAll")} checked={allSelected} onCheckedChange={(checked) => onToggleAll(checked === true)} />
          </TableHead>
          {/* w-px: checkbox, number and actions shrink to their content. */}
          <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
          <TableHead className="min-w-48">{t("nav.table")}</TableHead>
          <TableHead className="text-right">{t("fields.table_qty")}</TableHead>
          <TableHead>{t("fields.table_status")}</TableHead>
          <TableHead>{t("fields.charge_status")}</TableHead>
          <TableHead className="w-px">
            <span className="sr-only">{t("common.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupedRows.map((group) => {
          const collapsed = collapsedZones.has(group.zoneId);
          return (
            <Fragment key={group.zoneId}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={columnCount}>
                  <ZoneGroupToggle
                    collapsed={collapsed}
                    count={group.totalTables ?? group.tables.length}
                    name={group.zoneName}
                    onToggle={() => onToggleZoneCollapse(group.zoneId)}
                  />
                </TableCell>
              </TableRow>
              {collapsed ? null : group.rows.length ? (
                group.rows.map(({ row, rowNumber }) => {
                  const id = tableId(row);
                  const selected = selectedRows.has(id);
                  return (
                    <TableRow key={id || rowNumber} data-state={selected ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox aria-label={t("common.selectRow", { name: tableName(row) })} checked={selected} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground tabular-nums">{rowNumber}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-3 font-medium">
                          <TableIcon />
                          {tableName(row)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums" translate="no">
                        {tableSeats(row)}
                      </TableCell>
                      <TableCell>
                        <TableStatusBadge status={tableStatus(row)} />
                      </TableCell>
                      <TableCell>
                        <TableChargeBadge active={tableChargeActive(row)} label={chargeLabel(row)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                    {t("settings.emptyZoneTables")}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </DataTable>
  );
}

// Narrow pages: zone headers that fold, each with its tables as Items (two columns when there
// is room).
export function TableSettingsMobileList({
  collapsedZones,
  groupedRows,
  selectedRows,
  serviceChargeRateLabel,
  onDelete,
  onEdit,
  onToggleSelected,
  onToggleZoneCollapse
}: TableListProps) {
  const { t } = useTranslation();
  const chargeLabel = useChargeLabel(serviceChargeRateLabel);

  return (
    <div className="flex flex-col gap-4">
      {groupedRows.map((group) => {
        const collapsed = collapsedZones.has(group.zoneId);
        return (
          <section key={group.zoneId} className="flex flex-col gap-2">
            <ZoneGroupToggle
              collapsed={collapsed}
              count={group.totalTables ?? group.tables.length}
              name={group.zoneName}
              onToggle={() => onToggleZoneCollapse(group.zoneId)}
            />
            {collapsed ? null : group.rows.length ? (
              <ItemGroup className="@xl:grid @xl:grid-cols-2">
                {group.rows.map(({ row, rowNumber }) => {
                  const id = tableId(row);
                  return (
                    <Item key={id || rowNumber} variant="outline">
                      <Checkbox aria-label={t("common.selectRow", { name: tableName(row) })} checked={selectedRows.has(id)} onCheckedChange={(checked) => onToggleSelected(id, checked === true)} />
                      <ItemMedia>
                        <TableIcon />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{tableName(row)}</ItemTitle>
                        <ItemDescription className="tabular-nums">
                          {t("fields.table_qty")}: {tableSeats(row)}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <SettingsRowActions row={row} onEdit={onEdit} onDelete={onDelete} />
                      </ItemActions>
                      <ItemFooter className="justify-start gap-1.5">
                        <TableStatusBadge status={tableStatus(row)} />
                        <TableChargeBadge active={tableChargeActive(row)} label={chargeLabel(row)} />
                      </ItemFooter>
                    </Item>
                  );
                })}
              </ItemGroup>
            ) : (
              <p className="text-center text-xs text-muted-foreground">{t("settings.emptyZoneTables")}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
