import { describe, expect, it } from "vitest";
import { shouldRefreshCartForEvent, type CartRealtimeScope } from "./cart-realtime";

const tableScope: CartRealtimeScope = {
  branchUuid: "branch-1",
  tableUuid: "table-7",
  orderUuids: ["order-7"],
};

describe("cart realtime relevance", () => {
  it("refreshes the current table once when all 20 tables emit status changes", () => {
    const events = Array.from({ length: 20 }, (_, index) => ({
      branch_uuid_fk: "branch-1",
      table_uuid: `table-${index + 1}`,
    }));

    expect(events.filter((event) => shouldRefreshCartForEvent(event, tableScope)))
      .toEqual([{ branch_uuid_fk: "branch-1", table_uuid: "table-7" }]);
  });

  it("ignores 19 unrelated order events and accepts the current table's order", () => {
    const events = Array.from({ length: 20 }, (_, index) => ({
      branch_uuid_fk: "branch-1",
      order_uuids: [`order-${index + 1}`],
    }));

    expect(events.filter((event) => shouldRefreshCartForEvent(event, tableScope)))
      .toEqual([{ branch_uuid_fk: "branch-1", order_uuids: ["order-7"] }]);
  });

  it("accepts a batch containing any current order, including a bill split", () => {
    expect(shouldRefreshCartForEvent({
      branch_uuid_fk: "branch-1",
      order_uuids: ["split-order", "order-7"],
    }, tableScope)).toBe(true);
  });

  it("targets counter orders without a table and ignores table status events", () => {
    const scope = { branchUuid: "branch-1", orderUuids: ["counter-order"] };
    expect(shouldRefreshCartForEvent({ order_uuids: ["counter-order"] }, scope)).toBe(true);
    expect(shouldRefreshCartForEvent({ order_uuids: ["another-counter-order"] }, scope)).toBe(false);
    expect(shouldRefreshCartForEvent({ table_uuid: "table-7" }, scope)).toBe(false);
  });

  it("refreshes an empty cart because a first order is not known yet", () => {
    expect(shouldRefreshCartForEvent({ order_uuids: ["new-order"] }, {
      ...tableScope,
      orderUuids: [],
    })).toBe(true);
  });

  it.each([
    {},
    { order_uuids: [] },
    { order_uuids: [""] },
    { order_uuids: "order-elsewhere" },
    { order_uuids: ["order-elsewhere", null] },
  ])("keeps the reconciliation fallback for incomplete event %j", (event) => {
    expect(shouldRefreshCartForEvent(event, tableScope)).toBe(true);
  });

  it("rejects another branch even when the order matches", () => {
    expect(shouldRefreshCartForEvent({
      branch_uuid_fk: "branch-2",
      order_uuids: ["order-7"],
    }, tableScope)).toBe(false);
    expect(shouldRefreshCartForEvent({}, { ...tableScope, branchUuid: "" })).toBe(false);
  });

  it("uses the table identity when a new bill replaces the previous bill", () => {
    expect(shouldRefreshCartForEvent({
      table_uuid: "table-7",
      order_uuids: ["replacement-order"],
    }, tableScope)).toBe(true);
  });
});
