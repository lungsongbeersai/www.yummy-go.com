import { describe, expect, it } from "vitest";
import type { SimulatorLiveSnapshot, SimulatorLiveTable } from "@/services/simulator";
import { createLiveCharacters, limitLiveSceneTables, LIVE_SCENE_TABLE_LIMIT, liveItemStatusLabel, liveTableSceneStatus } from "./live-helpers";

function table(id: number, status = 2): SimulatorLiveTable {
  return { table_uuid: `table-${id}`, name: `A${id}`, status, zone_uuid: "zone-1", zone_name: "Dining", seats: 4,
    charge_status: 2, order_uuid: null, guests: null, customer_order_state: false };
}

function snapshot(tables: SimulatorLiveTable[]): SimulatorLiveSnapshot {
  return { mode: "live", read_only: true, fetched_at: "2026-10-29T10:00:00Z",
    branch: { branch_uuid: "branch-1", store_uuid: "store-1", branch_name: "Branch" }, tables, orders: [],
    summary: { open_bills: 0, guests: null, pending_items: 0, preparing_items: 0, served_items: 0 },
    limits: { tables: 400, orders: 400, items: 4000 }, truncated: false };
}

describe("bounded live scene projection", () => {
  it("keeps the table list intact and includes an off-screen selected table within the scene budget", () => {
    const tables = Array.from({ length: 400 }, (_, i) => table(i));
    const visible = limitLiveSceneTables(tables, "table-399");
    expect(visible).toHaveLength(LIVE_SCENE_TABLE_LIMIT);
    expect(visible.at(-1)?.table_uuid).toBe("table-399");
    expect(visible.slice(0, -1)).toEqual(tables.slice(0, LIVE_SCENE_TABLE_LIMIT - 1));
    expect(new Set(visible.map((entry) => entry.table_uuid)).size).toBe(LIVE_SCENE_TABLE_LIMIT);
    expect(tables).toHaveLength(400);
    expect(tables[LIVE_SCENE_TABLE_LIMIT - 1].table_uuid).toBe(`table-${LIVE_SCENE_TABLE_LIMIT - 1}`);
  });

  it("preserves source order for an existing visible selection, missing selection and short branch", () => {
    const tables = Array.from({ length: 100 }, (_, i) => table(i));
    expect(limitLiveSceneTables(tables, "table-2")).toEqual(tables.slice(0, LIVE_SCENE_TABLE_LIMIT));
    expect(limitLiveSceneTables(tables, "removed-table")).toEqual(tables.slice(0, LIVE_SCENE_TABLE_LIMIT));
    expect(limitLiveSceneTables(tables.slice(0, 3), "table-2")).toEqual(tables.slice(0, 3));
    expect(limitLiveSceneTables([], null)).toEqual([]);
  });

  it("renders one representative marker per occupied table without inventing staff or a headcount", () => {
    const value = snapshot([table(1, 1), table(2, 2), table(3, 6)]);
    const characters = createLiveCharacters(value);
    expect(characters.map((character) => character.tableId)).toEqual(["table-2", "table-3"]);
    expect(characters.every((character) => character.role === "customer")).toBe(true);
    expect(characters[1].state).toBe("requesting_bill");
    expect(value.tables.every((entry) => entry.guests === null)).toBe(true);
    expect(createLiveCharacters(snapshot(Array.from({ length: 50 }, (_, i) => table(i))))).toHaveLength(16);
  });

  it("uses persisted item states for visual activity without claiming kitchen-ready or served for status3", () => {
    const value = snapshot([table(1)]);
    value.orders = [{ order_uuid: "order-1", table_uuid: "table-1", status: "open", guests: null,
      created_at: value.fetched_at, items: [{ item_uuid: "item-1", detail_uuid: "detail-1", name: "Noodles", quantity: 1, status: 3, customer_order: false }],
      totals: { subtotal: 10000, item_discount: 0, bill_discount: 0, service: 0, vat: 0, total: 10000 } }];
    expect(createLiveCharacters(value)[0].state).toBe("waiting_food");
    expect(liveItemStatusLabel(3)).toBe("inKitchen");
    value.orders[0].items[0].status = 4;
    expect(createLiveCharacters(value)[0].state).toBe("eating");
    expect(liveItemStatusLabel(999)).toBe("unknownStatus");
    expect(liveTableSceneStatus(999)).toBe("occupied");
  });

  it("keeps representative customers attached to tables included in the bounded scene", () => {
    const value = snapshot(Array.from({ length: 100 }, (_, i) => table(i, i === 99 ? 2 : 1)));
    expect(createLiveCharacters(value, limitLiveSceneTables(value.tables, null))).toEqual([]);
    expect(createLiveCharacters(value, limitLiveSceneTables(value.tables, "table-99")).map((actor) => actor.tableId)).toEqual(["table-99"]);
  });
});
