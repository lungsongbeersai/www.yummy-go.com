import type { Table, TableListRow, ZoneGroup } from "@/services/table";
import type { Zone } from "@/services/zone";

export const REPORT_LOCATION_ALL = "all";

export interface ReportLocationFilters {
  zoneUuid: string;
  tableUuid: string;
}

export interface ReportLocationQueryParams {
  zone_uuid_fk?: string;
  table_uuid_fk?: string;
}

export interface ReportLocationOption {
  label: string;
  value: string;
}

export interface ReportLocationOptions {
  tableOptions: ReportLocationOption[];
  zoneOptions: ReportLocationOption[];
}

export function reportLocationParams(
  filters: ReportLocationFilters,
): ReportLocationQueryParams {
  return {
    zone_uuid_fk:
      filters.zoneUuid && filters.zoneUuid !== REPORT_LOCATION_ALL
        ? filters.zoneUuid
        : undefined,
    table_uuid_fk:
      filters.tableUuid && filters.tableUuid !== REPORT_LOCATION_ALL
        ? filters.tableUuid
        : undefined,
  };
}

export function buildReportLocationOptions({
  allTablesLabel,
  allZonesLabel,
  branchUuid,
  language,
  rows,
  selectedZoneUuid,
  zones,
}: {
  allTablesLabel: string;
  allZonesLabel: string;
  branchUuid: string;
  language: string;
  rows: TableListRow[];
  selectedZoneUuid: string;
  zones: Zone[];
}): ReportLocationOptions {
  const branchZones = branchUuid
    ? zones.filter((zone) => zone.branch_uuid_fk === branchUuid)
    : [];
  const branchZoneIds = new Set(branchZones.map((zone) => zone.zone_uuid));
  const zoneOptions = [
    { label: allZonesLabel, value: REPORT_LOCATION_ALL },
    ...branchZones.map((zone) => ({
      label: localizedZoneName(zone, language),
      value: zone.zone_uuid,
    })),
  ];
  const zoneNames = new Map(
    branchZones.map((zone) => [zone.zone_uuid, localizedZoneName(zone, language)]),
  );
  // Validate the zone relationship as well as explicit branch metadata. Grouped
  // responses from older backends identify child tables only by their parent zone.
  const tables = flattenTableRows(rows).filter(({ table, zoneUuid, branchUuid: rowBranchUuid }) =>
    branchZoneIds.has(zoneUuid) &&
    (!rowBranchUuid || rowBranchUuid === branchUuid) &&
    (!table.branch_uuid_fk || table.branch_uuid_fk === branchUuid) &&
    (!table.zone_uuid_fk || table.zone_uuid_fk === zoneUuid),
  );
  const visibleTables =
    selectedZoneUuid && selectedZoneUuid !== REPORT_LOCATION_ALL
      ? tables.filter((entry) => entry.zoneUuid === selectedZoneUuid)
      : tables;
  const tableOptions = [
    { label: allTablesLabel, value: REPORT_LOCATION_ALL },
    ...visibleTables.map(({ table, zoneUuid }) => {
      const tableName = localizedTableName(table, language);
      const zoneName = zoneNames.get(zoneUuid) ?? "";
      return {
        label:
          selectedZoneUuid === REPORT_LOCATION_ALL && zoneName
            ? `${zoneName} — ${tableName}`
            : tableName,
        value: table.table_uuid,
      };
    }),
  ];

  return { tableOptions, zoneOptions };
}

function flattenTableRows(rows: TableListRow[]) {
  return rows.flatMap((row) => {
    if (isZoneGroup(row)) {
      return row.tables.map((table) => ({ table, zoneUuid: row.zone_uuid, branchUuid: row.branch_uuid_fk }));
    }

    return [{ table: row, zoneUuid: row.zone_uuid_fk ?? "", branchUuid: row.branch_uuid_fk }];
  });
}

function isZoneGroup(row: TableListRow): row is ZoneGroup {
  return "tables" in row && Array.isArray(row.tables);
}

function localizedZoneName(zone: Zone, language: string) {
  const english = language.toLowerCase().startsWith("en");
  return (
    (english ? zone.zone_name_eng : zone.zone_name_la) ||
    zone.zone_name ||
    zone.zone_name_la ||
    zone.zone_name_eng ||
    zone.zone_uuid
  );
}

function localizedTableName(table: Table, language: string) {
  const english = language.toLowerCase().startsWith("en");
  return (
    (english ? table.table_name_eng : table.table_name_la) ||
    table.table_name ||
    table.table_name_la ||
    table.table_name_eng ||
    table.table_uuid
  );
}
