import { describe, expect, it } from "vitest";
import type { StuckSyncEvent } from "@/services/offline-sync";
import {
  cancelClosure,
  closureCarriesMoney,
  countFinancialGroups,
  countStuckEvents,
  groupStuckEvents,
} from "./stuck-order-groups";

function event(overrides: Partial<StuckSyncEvent> & { event_uuid: string }): StuckSyncEvent {
  return {
    operation: "ORDER_CREATE",
    entity_type: "ORDER",
    entity_uuid: null,
    sync_status: "BLOCKED",
    retry_count: 0,
    sequence_no: 1,
    dependencies: [],
    last_error: null,
    created_at: 1000,
    updated_at: 1000,
    next_attempt_at: 1000,
    stuck_for_ms: 0,
    waiting_on_print: false,
    waiting_on_dependency: false,
    is_financial: false,
    order: null,
    ...overrides,
  };
}

const order = {
  order_uuid: "order-1",
  order_invoice: "270826-0010",
  table_uuid: "table-1",
  table_name: "T01",
};

describe("groupStuckEvents", () => {
  it("collects every row of one bill under that bill", () => {
    const groups = groupStuckEvents([
      event({ event_uuid: "a", sequence_no: 2, operation: "KITCHEN_CONFIRM", order }),
      event({ event_uuid: "b", sequence_no: 1, order }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("order-1");
    expect(groups[0].order?.table_name).toBe("T01");
    // Sequence order is the order the till did the work in, which is the order
    // it has to be read back in.
    expect(groups[0].events.map((entry) => entry.event_uuid)).toEqual(["b", "a"]);
    expect(countStuckEvents(groups)).toBe(2);
  });

  it("keeps a row with no bill behind it as its own group", () => {
    const groups = groupStuckEvents([event({ event_uuid: "orphan" })]);
    expect(groups.map((group) => group.key)).toEqual(["orphan"]);
    expect(groups[0].order).toBeNull();
  });

  it("shows the real rejection, not the cascade it caused", () => {
    const groups = groupStuckEvents([
      event({ event_uuid: "a", sequence_no: 1, last_error: "dependency blocked or missing", order }),
      event({
        event_uuid: "b",
        sequence_no: 2,
        last_error: 'duplicate key value violates unique constraint "uq_tb_orders_order_uuid"',
        order,
      }),
    ]);
    expect(groups[0].reason).toMatch(/duplicate key/);
  });

  it("falls back to the cascade message when it is the only thing recorded", () => {
    const groups = groupStuckEvents([
      event({ event_uuid: "a", last_error: "dependency blocked or missing", order }),
    ]);
    expect(groups[0].reason).toBe("dependency blocked or missing");
  });

  it("flags a bill that carries money or is held at the printer", () => {
    const groups = groupStuckEvents([
      event({ event_uuid: "a", sequence_no: 1, waiting_on_print: true, order }),
      event({ event_uuid: "b", sequence_no: 2, operation: "PAYMENT", is_financial: true, order }),
    ]);
    expect(groups[0].hasFinancial).toBe(true);
    expect(groups[0].waitingOnPrint).toBe(true);
    expect(countFinancialGroups(groups)).toBe(1);
  });

  it("puts the bill that has been stuck longest first", () => {
    const older = { ...order, order_uuid: "order-0" };
    const groups = groupStuckEvents([
      event({ event_uuid: "a", created_at: 5000, order }),
      event({ event_uuid: "b", created_at: 1000, order: older }),
    ]);
    expect(groups.map((group) => group.key)).toEqual(["order-0", "order-1"]);
    expect(groups[0].oldestAt).toBe(1000);
  });
});

describe("cancelClosure", () => {
  const create = event({ event_uuid: "create", sequence_no: 1, order });
  const kitchen = event({
    event_uuid: "kitchen",
    sequence_no: 2,
    operation: "KITCHEN_CONFIRM",
    dependencies: ["create"],
    order,
  });
  const payment = event({
    event_uuid: "payment",
    sequence_no: 3,
    operation: "PAYMENT",
    is_financial: true,
    dependencies: ["kitchen"],
    order,
  });
  const events = [create, kitchen, payment];

  it("walks past a direct child to everything downstream of it", () => {
    expect(cancelClosure(events, "create").map((entry) => entry.event_uuid))
      .toEqual(["create", "kitchen", "payment"]);
  });

  it("takes only what actually depends on the row being cancelled", () => {
    expect(cancelClosure(events, "payment").map((entry) => entry.event_uuid)).toEqual(["payment"]);
  });

  it("warns about money that sits downstream, not only on the row itself", () => {
    // Cancelling the kitchen confirm drags the payment along, so the dialog has
    // to ask about money even though KITCHEN_CONFIRM carries none.
    expect(kitchen.is_financial).toBe(false);
    expect(closureCarriesMoney(events, "kitchen")).toBe(true);
    expect(closureCarriesMoney(events, "payment")).toBe(true);
  });

  it("does not warn when nothing downstream carries money", () => {
    expect(closureCarriesMoney([create, kitchen], "create")).toBe(false);
  });

  it("terminates on a dependency cycle", () => {
    const left = event({ event_uuid: "left", dependencies: ["right"] });
    const right = event({ event_uuid: "right", dependencies: ["left"] });
    expect(cancelClosure([left, right], "left").map((entry) => entry.event_uuid).sort())
      .toEqual(["left", "right"]);
  });
});
