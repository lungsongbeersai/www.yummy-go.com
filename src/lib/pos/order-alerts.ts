import type { PosZone } from "@/services/pos";

export interface OrderAlertEntry {
  tableUuid: string;
  tableName: string;
  zoneUuid: string;
  zoneName: string;
}

export function zoneOrderAlertCount(zone: PosZone) {
  return (zone.tables ?? []).filter((table) => Boolean(table.customer_order_state)).length;
}

export function collectOrderAlerts(zones: PosZone[]): OrderAlertEntry[] {
  return zones
    .flatMap((zone) =>
      (zone.tables ?? [])
        .filter((table) => Boolean(table.customer_order_state))
        .map((table) => ({
          tableUuid: table.table_uuid,
          tableName: table.table_name,
          zoneUuid: zone.zone_uuid,
          zoneName: zone.zone_name
        }))
    )
    .sort(
      (a, b) => a.zoneName.localeCompare(b.zoneName) || a.tableName.localeCompare(b.tableName)
    );
}
