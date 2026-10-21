import { describe, expect, it } from "vitest";
import { TableStatus } from "@/config/pos-constants";
import type { PosTable, PosZone } from "@/services/pos";
import { filterZones } from "./table-zones";

const freeTable: PosTable = {
  table_uuid: "table-free",
  table_name: "T01",
  table_status: TableStatus.AVAILABLE,
};
const busyTable: PosTable = {
  table_uuid: "table-busy",
  table_name: "T02",
  table_status: TableStatus.AWAITING_PAYMENT,
  customer_order_state: true,
};

function zone(zoneUuid: string, tables: PosTable[]): PosZone {
  return { zone_uuid: zoneUuid, zone_name: zoneUuid, tables };
}

describe("filterZones", () => {
  it("reuses the full grid when no table is excluded", () => {
    const zones = [zone("zone-1", [freeTable, busyTable])];

    expect(filterZones(zones, "", "all")).toBe(zones);
    expect(filterZones(zones, "   ", "all")).toBe(zones);
    expect(filterZones(zones, "t0", "all")).toBe(zones);
  });

  it("only replaces zones whose visible table list changes", () => {
    const unchangedZone = zone("zone-free", [freeTable]);
    const mixedZone = zone("zone-mixed", [freeTable, busyTable]);
    const zones = [unchangedZone, mixedZone];

    const result = filterZones(zones, "", "free");

    expect(result).not.toBe(zones);
    expect(result[0]).toBe(unchangedZone);
    expect(result[1]).not.toBe(mixedZone);
    expect(result[1].tables).toEqual([freeTable]);
    expect(result[1].tables[0]).toBe(freeTable);
    expect(mixedZone.tables).toEqual([freeTable, busyTable]);
  });

  it("removes empty zones while retaining populated zone references", () => {
    const populatedZone = zone("zone-populated", [freeTable]);
    const zones = [zone("zone-empty", []), populatedZone];

    const result = filterZones(zones, "", "all");

    expect(result).toEqual([populatedZone]);
    expect(result[0]).toBe(populatedZone);
  });

  it("keeps every occupied status in the busy filter", () => {
    const occupiedTables = [
      TableStatus.OCCUPIED,
      TableStatus.CASHIER_CREATING_ORDER,
      TableStatus.AWAITING_CONFIRM,
      TableStatus.CALL_STAFF,
      TableStatus.AWAITING_PAYMENT,
    ].map((tableStatus, index) => ({
      ...busyTable,
      table_uuid: `busy-${index}`,
      table_status: tableStatus,
    }));
    const zones = [zone("zone-1", [freeTable, ...occupiedTables])];

    expect(filterZones(zones, "", "busy")[0].tables).toEqual(occupiedTables);
  });

  it("combines case-insensitive trimmed search with the current status", () => {
    const zones = [zone("zone-1", [freeTable, busyTable])];

    expect(filterZones(zones, "  t02  ", "busy")[0].tables).toEqual([busyTable]);
    expect(filterZones(zones, "T02", "free")).toEqual([]);
    expect(filterZones(zones, "missing", "all")).toEqual([]);
  });

  it("filters order alerts independently from occupancy", () => {
    const freeWithAlert = { ...freeTable, customer_order_state: true };
    const busyWithoutAlert = { ...busyTable, customer_order_state: false };
    const zones = [zone("zone-1", [freeWithAlert, busyWithoutAlert])];

    expect(filterZones(zones, "", "update")[0].tables).toEqual([freeWithAlert]);
  });

  it("reflects a subsequent realtime status update without mutating earlier data", () => {
    const original = [zone("zone-1", [freeTable])];
    const updatedTable = { ...freeTable, table_status: TableStatus.OCCUPIED };
    const updated = [zone("zone-1", [updatedTable])];

    expect(filterZones(original, "", "busy")).toEqual([]);
    expect(filterZones(updated, "", "busy")).toBe(updated);
    expect(filterZones(original, "", "free")).toBe(original);
  });

  it("preserves an empty grid reference", () => {
    const zones: PosZone[] = [];

    expect(filterZones(zones, "", "all")).toBe(zones);
  });
});
