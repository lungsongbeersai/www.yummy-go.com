import { optionalBoolean, optionalNumber, optionalString } from "@/lib/values";
import { TableStatus } from "@/config/pos-constants";
import type {
  MoveTableItem,
  MoveTableZone,
  PosTable,
  PosZone,
} from "@/services/pos";
import type {
  NormalizedTableActionZone,
  TableActionMode,
  TableActionTable,
  TableStatusFilter,
} from "./types";

export function tableStatus(table: PosTable) {
  return Number(table.table_status) === TableStatus.AVAILABLE ? "free" : "busy";
}

export type TableVisualStatus =
  | "awaitingConfirm"
  | "newOrder"
  | "available"
  | "occupied"
  | "awaitingPayment";

// customer_order_state คือออเดอร์ใหม่ที่ลูกค้ายิงเข้ามาแบบสด ๆ จึงต้องเด่นกว่า
// table_status เสมอ (มีทั้งออเดอร์ใหม่เข้ามา "และ" โต๊ะไม่ว่างพร้อมกันได้)
export function tableVisualStatus(table: PosTable): TableVisualStatus {
  if (table.customer_order_state) return "newOrder";

  switch (Number(table.table_status)) {
    case TableStatus.AWAITING_CONFIRM:
      return "awaitingConfirm";
    case TableStatus.OCCUPIED:
      return "occupied";
    case TableStatus.AWAITING_PAYMENT:
      return "awaitingPayment";
    default:
      return "available";
  }
}

// datetime_in จาก backend เป็น "YYYY-MM-DD HH:mm:ss" เสมอ — ตัดด้วย regex แทนการ
// parse ผ่าน Date() เพื่อเลี่ยงปัญหา timezone/รูปแบบที่ไม่ใช่ ISO ในบาง engine
export function tableCheckInTime(table: PosTable) {
  const match = /(\d{2}):(\d{2})(?::\d{2})?\s*$/.exec(table.datetime_in ?? "");
  return match ? `${match[1]}:${match[2]}` : null;
}

export function tableSeatCount(table: PosTable) {
  const value =
    table.number_of_seats ??
    table.table_qty ??
    table.qty ??
    table.seat_qty ??
    table.seats ??
    0;
  return Number(value || 0);
}

export function tableAvailableState(table: PosTable): PosTable {
  if (
    Number(table.table_status) === TableStatus.AVAILABLE &&
    table.customer_order_state === false
  )
    return table;

  return {
    ...table,
    customer_order_state: false,
    table_status: TableStatus.AVAILABLE,
  };
}

export function markTableAvailableInZones(zones: PosZone[], tableUuid: string) {
  let changed = false;

  const nextZones = zones.map((zone) => {
    let zoneChanged = false;
    const nextTables = (zone.tables ?? []).map((table) => {
      if (table.table_uuid !== tableUuid) return table;

      const nextTable = tableAvailableState(table);
      if (nextTable === table) return table;

      changed = true;
      zoneChanged = true;
      return nextTable;
    });

    return zoneChanged ? { ...zone, tables: nextTables } : zone;
  });

  return changed ? nextZones : zones;
}

export function tableActionTableUuid(table: MoveTableItem | PosTable) {
  return optionalString(
    table.table_uuid,
    table.table_uuid_fk,
    table.uuid,
    table.id,
  );
}

export function tableActionTableName(table: MoveTableItem | PosTable) {
  return (
    optionalString(
      table.table_name,
      table.table_name_la,
      table.table_name_eng,
      table.name,
      table.title,
    ) ?? "-"
  );
}

export function tableActionHasOrder(table: MoveTableItem | PosTable) {
  if (
    optionalBoolean(
      table.customer_order_state,
      table.has_order,
      table.hasOrder,
      table.in_use,
      table.is_occupied,
    )
  )
    return true;
  if (
    optionalString(
      table.order_uuid,
      table.order_uuid_fk,
      table.order_invoice,
      table.invoice,
      table.invoice_no,
      table.bill_uuid,
    )
  )
    return true;

  const orderCount = optionalNumber(
    table.order_count,
    table.orders_count,
    table.order_qty,
    table.item_count,
    table.items_count,
    table.total_order,
    table.total_orders,
  );
  if (orderCount !== null && orderCount > 0) return true;

  const orders = table.orders;
  const items = table.items;
  return (
    (Array.isArray(orders) && orders.length > 0) ||
    (Array.isArray(items) && items.length > 0)
  );
}

export function tableActionTableStatus(
  table: MoveTableItem | PosTable,
): "free" | "busy" {
  if (tableActionHasOrder(table)) return "busy";

  const status = optionalNumber(
    table.table_status,
    table.status,
    table.table_status_fk,
  );
  if (status !== null) return status === TableStatus.AVAILABLE ? "free" : "busy";

  const statusText = optionalString(
    table.table_status_text,
    table.status_text,
    table.status_name,
    table.status,
  )?.toLowerCase();
  if (
    statusText &&
    ["busy", "occupied", "reserved", "unavailable"].some((text) =>
      statusText.includes(text),
    )
  )
    return "busy";

  return "free";
}

export function normalizeTableActionZones(
  zones: Array<MoveTableZone | PosZone>,
) {
  return zones
    .map((zone, zoneIndex) => {
      const zoneName =
        optionalString(zone.zone_name, zone.name, zone.title) ?? "-";
      const tables = ((zone.tables ?? []) as Array<MoveTableItem | PosTable>)
        .map((table) => {
          const uuid = tableActionTableUuid(table);
          if (!uuid) return null;

          return {
            customerOrderState: tableActionHasOrder(table),
            name: tableActionTableName(table),
            seats: optionalNumber(
              table.number_of_seats,
              table.table_qty,
              table.qty,
              table.seat_qty,
              table.seats,
            ),
            status: tableActionTableStatus(table),
            uuid,
            zoneName,
          } satisfies TableActionTable;
        })
        .filter((table): table is TableActionTable => Boolean(table));

      return {
        name: zoneName,
        tables,
        uuid:
          optionalString(zone.zone_uuid, zone.uuid, zone.id) ??
          `zone-${zoneIndex}`,
      } satisfies NormalizedTableActionZone;
    })
    .filter((zone) => zone.tables.length > 0);
}

export function filterTableActionZones(
  zones: NormalizedTableActionZone[],
  currentTableUuid: string,
  mode: TableActionMode,
  search: string,
) {
  const query = search.trim().toLowerCase();

  return zones
    .map((zone) => ({
      ...zone,
      tables: zone.tables.filter((table) => {
        if (table.uuid === currentTableUuid) return false;
        if (mode === "move" && table.status !== "free") return false;
        if (mode === "join" && table.status !== "busy") return false;
        return (
          !query ||
          table.name.toLowerCase().includes(query) ||
          zone.name.toLowerCase().includes(query)
        );
      }),
    }))
    .filter((zone) => zone.tables.length > 0);
}

export function tableActionFlatTables(zones: NormalizedTableActionZone[]) {
  return zones.flatMap((zone) => zone.tables);
}

export function filterZones(
  zones: PosZone[],
  search: string,
  statusFilter: TableStatusFilter,
) {
  const query = search.trim().toLowerCase();

  return zones
    .map((zone) => ({
      ...zone,
      tables: (zone.tables ?? []).filter((table) => {
        const matchesSearch =
          !query || table.table_name.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "free" && tableStatus(table) === "free") ||
          (statusFilter === "busy" && tableStatus(table) === "busy") ||
          (statusFilter === "update" && Boolean(table.customer_order_state));
        return matchesSearch && matchesStatus;
      }),
    }))
    .filter((zone) => (zone.tables ?? []).length > 0);
}

export function tableCount(zones: PosZone[]) {
  return zones.reduce((total, zone) => total + (zone.tables ?? []).length, 0);
}

export function formatClock(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
  });
}
