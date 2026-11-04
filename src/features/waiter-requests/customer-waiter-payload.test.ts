import { describe, expect, it, vi } from "vitest";
import { buildCustomerWaiterPayload, resolveCustomerWaiterAttempt } from "./customer-waiter-payload";

describe("customer waiter payload", () => {
  it("keeps a full 500-character note when items are selected afterwards", () => {
    const note = "ກ".repeat(500);
    const original = buildCustomerWaiterPayload({}, note, "Come to the table");
    const selected = buildCustomerWaiterPayload({ bowl: 2, spoon: 1 }, note, "Come to the table");
    expect(original.message).toBe(note);
    expect(selected).toEqual({
      items: [{ kind: "bowl", qty: 2 }, { kind: "spoon", qty: 1 }],
      message: note,
    });
  });

  it("does not duplicate selected item names in the freeform message", () => {
    expect(buildCustomerWaiterPayload({ chopsticks: 3 }, "  Extra ice, please  ", "Come")).toEqual({
      items: [{ kind: "chopsticks", qty: 3 }], message: "Extra ice, please",
    });
    expect(buildCustomerWaiterPayload({ spoon: 1 }, "", "Come")).toEqual({
      items: [{ kind: "spoon", qty: 1 }], message: "",
    });
  });

  it("creates a plain staff call only when neither items nor a note were supplied", () => {
    expect(buildCustomerWaiterPayload({}, "   ", "Please come to the table")).toEqual({
      items: [], message: "Please come to the table",
    });
    expect(buildCustomerWaiterPayload({}, "Help with the bill", "Come")).toEqual({
      items: [], message: "Help with the bill",
    });
  });

  it("bounds quantities and messages to the existing backend contract", () => {
    expect(buildCustomerWaiterPayload({ bowl: 21, spoon: -1, chopsticks: 2.9 }, "x".repeat(510), "Come")).toEqual({
      items: [{ kind: "bowl", qty: 20 }, { kind: "chopsticks", qty: 2 }], message: "x".repeat(500),
    });
    expect(buildCustomerWaiterPayload({ bowl: Number.NaN, spoon: Infinity }, "", "Come").items).toEqual([]);
  });

  it("reuses the same id after an ambiguous failure but changes it for a different payload", () => {
    const createId = vi.fn().mockReturnValueOnce("first").mockReturnValueOnce("second");
    const payload = buildCustomerWaiterPayload({ bowl: 1 }, "Ice", "Come");
    const attempt = resolveCustomerWaiterAttempt(payload, null, createId);
    expect(resolveCustomerWaiterAttempt({ ...payload }, attempt, createId)).toBe(attempt);
    expect(resolveCustomerWaiterAttempt(buildCustomerWaiterPayload({ bowl: 2 }, "Ice", "Come"), attempt, createId).id).toBe("second");
    expect(createId).toHaveBeenCalledTimes(2);
  });

  it("assigns a new id when a retry's localized default call message changes", () => {
    const original = resolveCustomerWaiterAttempt(buildCustomerWaiterPayload({}, "", "Come"), null, () => "first");
    expect(resolveCustomerWaiterAttempt(buildCustomerWaiterPayload({}, "", "ໃຫ້ມາທີ່ໂຕະ"), original, () => "second").id).toBe("second");
  });
});
