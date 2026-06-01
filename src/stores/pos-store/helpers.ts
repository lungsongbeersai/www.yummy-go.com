import type { PosZone } from "@/services/pos";

export function updateZonesTableOrderState(zones: PosZone[], tableUuid: string, customerOrderState: boolean) {
  let changed = false;

  const nextZones = zones.map((zone) => {
    let zoneChanged = false;
    const nextTables = (zone.tables ?? []).map((table) => {
      if (table.table_uuid !== tableUuid) return table;
      if (table.customer_order_state === customerOrderState) return table;

      changed = true;
      zoneChanged = true;
      return { ...table, customer_order_state: customerOrderState };
    });

    return zoneChanged ? { ...zone, tables: nextTables } : zone;
  });

  return changed ? nextZones : zones;
}
