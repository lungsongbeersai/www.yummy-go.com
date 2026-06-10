import { stripNumberFormat } from "@/lib/number-format";
import type { ApiEntity } from "@/services/shared/types";
import type { SaveTableInput, Table as DiningTable, TableListRow, ZoneGroup } from "@/services/table";
import type { Zone } from "@/services/zone";

export interface TableGroup {
  zoneId: string;
  zoneName: string;
  totalTables?: number;
  tables: DiningTable[];
}

export type ZoneGroupWithTables = ZoneGroup & { tables: DiningTable[] };

export function tableValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function tableId(row: DiningTable | null | undefined) {
  return tableValue(row, "table_uuid");
}

export function tableName(row: DiningTable | null | undefined) {
  return tableValue(row, "table_name", tableValue(row, "table_name_la", tableValue(row, "table_name_eng", "-")));
}

export function tableSeats(row: DiningTable | null | undefined) {
  return tableValue(row, "table_qty", tableValue(row, "number_of_seats", "-"));
}

export function numberValue(row: ApiEntity | null | undefined, key: string, fallback = 0) {
  const raw = row?.[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw !== "" && raw !== undefined && raw !== null ? parsed : fallback;
}

export function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function branchServiceCharge(row: ApiEntity | null | undefined) {
  const active = numberValue(row, "charge_status", 2) === 1;
  const percent = active ? Math.max(0, numberValue(row, "charge_name", 0)) : 0;

  return {
    active,
    percent,
    percentLabel: `${formatPercent(percent)}%`
  };
}

export function zoneLabel(row: ApiEntity | null | undefined) {
  return tableValue(row, "zone_name", tableValue(row, "zone_name_la", tableValue(row, "zone_name_eng", "-")));
}

export function isZoneGroup(row: TableListRow): row is ZoneGroupWithTables {
  return Array.isArray((row as ZoneGroup).tables);
}

export function flattenTableRows(rows: TableListRow[]): DiningTable[] {
  return rows.flatMap((row) => {
    if (!isZoneGroup(row)) return [row];
    return row.tables.map((table) => ({
      ...table,
      zone_uuid_fk: tableValue(table, "zone_uuid_fk", tableValue(row, "zone_uuid")),
      zone_name: tableValue(table, "zone_name", zoneLabel(row))
    }));
  });
}

export function groupTableRows(rows: TableListRow[], zoneById: Map<string, Zone>): TableGroup[] {
  const groups = new Map<string, TableGroup>();
  rows.forEach((row) => {
    if (isZoneGroup(row)) {
      const zoneId = tableValue(row, "zone_uuid") || "__unknown__";
      const zoneName = zoneLabel(row);
      groups.set(zoneId, {
        zoneId,
        zoneName,
        totalTables: Number(row.total_tables ?? row.tables.length),
        tables: row.tables.map((table) => ({
          ...table,
          zone_uuid_fk: tableValue(table, "zone_uuid_fk", zoneId),
          zone_name: tableValue(table, "zone_name", zoneName)
        }))
      });
      return;
    }

    const zoneId = tableValue(row, "zone_uuid_fk") || "__unknown__";
    const zone = zoneById.get(zoneId);
    const group = groups.get(zoneId) ?? { zoneId, zoneName: zone ? zoneLabel(zone) : zoneLabel(row), tables: [] };
    group.tables.push(row);
    group.totalTables = group.tables.length;
    groups.set(zoneId, group);
  });
  return Array.from(groups.values());
}

export function buildGroupedTableRows(groups: TableGroup[], pageStart: number) {
  let rowNumber = pageStart;
  return groups.map((group) => ({
    ...group,
    rows: group.tables.map((row) => ({ row, rowNumber: rowNumber++ }))
  }));
}

export function tableStatus(row: DiningTable | null | undefined) {
  return numberValue(row, "table_status", 0);
}

export function tableChargeActive(row: DiningTable | null | undefined) {
  return numberValue(row, "charge_status", 2) === 1;
}

export function serviceChargeSummary({
  activeLabel,
  inactiveLabel,
  loading,
  loadingLabel,
  serviceCharge
}: {
  activeLabel: string;
  inactiveLabel: string;
  loading: boolean;
  loadingLabel: string;
  serviceCharge: ReturnType<typeof branchServiceCharge>;
}) {
  if (loading) return loadingLabel;
  if (serviceCharge.active) return `${activeLabel} / ${serviceCharge.percentLabel}`;
  return `${inactiveLabel} / ${serviceCharge.percentLabel}`;
}

export type TableMissingField = "branch" | "zone" | "name" | null;

export function missingTableField({
  branchUuid,
  nameLa,
  zoneUuid
}: {
  branchUuid: string;
  nameLa: string;
  zoneUuid: string;
}): TableMissingField {
  if (!branchUuid.trim()) return "branch";
  if (!zoneUuid.trim()) return "zone";
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildTablePayload({
  branchUuid,
  chargeStatus,
  editing,
  nameEng,
  nameLa,
  seats,
  zoneUuid
}: {
  branchUuid: string;
  chargeStatus: string;
  editing: DiningTable | null;
  nameEng: string;
  nameLa: string;
  seats: string;
  zoneUuid: string;
}): SaveTableInput {
  const payload: SaveTableInput = {
    branch_uuid_fk: branchUuid,
    zone_uuid_fk: zoneUuid,
    table_uuid: tableId(editing),
    table_name_la: nameLa.trim(),
    table_name_eng: nameEng.trim(),
    charge_status: Number(chargeStatus || 2)
  };
  const trimmedSeats = stripNumberFormat(seats);
  if (trimmedSeats) payload.table_qty = Number(trimmedSeats);
  return payload;
}
