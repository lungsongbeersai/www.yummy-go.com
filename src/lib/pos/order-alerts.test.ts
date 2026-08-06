import { describe, expect, it } from "vitest";
import type { PosZone } from "@/services/pos";
import { collectOrderAlerts, zoneOrderAlertCount } from "./order-alerts";

function zone(overrides: Partial<PosZone> = {}): PosZone {
  return {
    zone_uuid: "zone-1",
    zone_name: "Zone 1",
    tables: [],
    ...overrides
  };
}

describe("zoneOrderAlertCount", () => {
  it("counts only tables with a pending customer order", () => {
    const target = zone({
      tables: [
        { table_uuid: "t1", table_name: "T1", table_status: 2, customer_order_state: true },
        { table_uuid: "t2", table_name: "T2", table_status: 2, customer_order_state: false },
        { table_uuid: "t3", table_name: "T3", table_status: 1 }
      ]
    });

    expect(zoneOrderAlertCount(target)).toBe(1);
  });

  it("treats a zone with no tables as zero alerts", () => {
    expect(zoneOrderAlertCount(zone({ tables: undefined }))).toBe(0);
  });
});

describe("collectOrderAlerts", () => {
  it("flattens tables with a pending order across zones, sorted by zone then table name", () => {
    const zones: PosZone[] = [
      zone({
        zone_uuid: "zone-b",
        zone_name: "Zone B",
        tables: [
          { table_uuid: "b2", table_name: "B2", table_status: 2, customer_order_state: true },
          { table_uuid: "b1", table_name: "B1", table_status: 2, customer_order_state: true }
        ]
      }),
      zone({
        zone_uuid: "zone-a",
        zone_name: "Zone A",
        tables: [
          { table_uuid: "a1", table_name: "A1", table_status: 2, customer_order_state: false }
        ]
      })
    ];

    expect(collectOrderAlerts(zones)).toEqual([
      { tableUuid: "b1", tableName: "B1", zoneUuid: "zone-b", zoneName: "Zone B" },
      { tableUuid: "b2", tableName: "B2", zoneUuid: "zone-b", zoneName: "Zone B" }
    ]);
  });

  it("returns an empty list when no table has a pending order", () => {
    expect(collectOrderAlerts([zone()])).toEqual([]);
  });
});
