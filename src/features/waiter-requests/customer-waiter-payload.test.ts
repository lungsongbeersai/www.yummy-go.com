import { describe, expect, it, vi } from "vitest";
import type { WaiterRequest } from "@/services/waiter-requests";
import { buildCustomerWaiterPayload, findPendingBillRequest, resolveCustomerWaiterAttempt } from "./customer-waiter-payload";

function request(overrides: Partial<WaiterRequest> = {}): WaiterRequest {
  return {
    request_uuid: "request",
    table_uuid: "table",
    branch_uuid: "branch",
    items: [],
    message: "",
    status: 0,
    created_at: "2026-11-05T12:00:00Z",
    ...overrides,
  };
}

describe("customer waiter payload", () => {
  it("keeps a full 500-character note when items are selected afterwards", () => {
    const note = "ກ".repeat(500);
    const original = buildCustomerWaiterPayload({}, note, "Come to the table");
    const selected = buildCustomerWaiterPayload({ bowl: 2, spoon: 1 }, note, "Come to the table");
    expect(original.message).toBe(note);
    expect(selected).toEqual({
      request_type: "staff",
      items: [{ kind: "bowl", qty: 2 }, { kind: "spoon", qty: 1 }],
      message: note,
    });
  });

  it("does not duplicate selected item names in the freeform message", () => {
    expect(buildCustomerWaiterPayload({ chopsticks: 3 }, "  Extra ice, please  ", "Come")).toEqual({
      request_type: "staff",
      items: [{ kind: "chopsticks", qty: 3 }], message: "Extra ice, please",
    });
    expect(buildCustomerWaiterPayload({ spoon: 1 }, "", "Come")).toEqual({
      request_type: "staff",
      items: [{ kind: "spoon", qty: 1 }], message: "",
    });
  });

  it("creates a plain staff call only when neither items nor a note were supplied", () => {
    expect(buildCustomerWaiterPayload({}, "   ", "Please come to the table")).toEqual({
      request_type: "staff",
      items: [], message: "Please come to the table",
    });
    expect(buildCustomerWaiterPayload({}, "Help with the bill", "Come")).toEqual({
      request_type: "staff",
      items: [], message: "Help with the bill",
    });
  });

  it("bounds quantities and messages to the existing backend contract", () => {
    expect(buildCustomerWaiterPayload({ bowl: 21, spoon: -1, chopsticks: 2.9 }, "x".repeat(510), "Come")).toEqual({
      request_type: "staff",
      items: [{ kind: "bowl", qty: 20 }, { kind: "chopsticks", qty: 2 }], message: "x".repeat(500),
    });
    expect(buildCustomerWaiterPayload({ bowl: Number.NaN, spoon: Infinity }, "", "Come").items).toEqual([]);
  });

  it("drops assistance items when requesting a bill and keeps an optional customer note", () => {
    expect(buildCustomerWaiterPayload({ bowl: 2, spoon: 1 }, "  Separate bills, please  ", "Bring the bill", "bill")).toEqual({
      request_type: "bill",
      items: [],
      message: "Separate bills, please",
    });
  });

  it("uses the localized bill message only when its note is empty and bounds both to 500 characters", () => {
    expect(buildCustomerWaiterPayload({}, "   ", "  ກະລຸນານຳບິນມາທີ່ໂຕະ  ", "bill")).toEqual({
      request_type: "bill",
      items: [],
      message: "ກະລຸນານຳບິນມາທີ່ໂຕະ",
    });
    expect(buildCustomerWaiterPayload({}, "ກ".repeat(510), "Bring the bill", "bill").message).toBe("ກ".repeat(500));
    expect(buildCustomerWaiterPayload({}, "", "x".repeat(510), "bill").message).toBe("x".repeat(500));
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

  it("keeps retries of a bill request stable but never reuses a staff request id for the same message", () => {
    const createId = vi.fn().mockReturnValueOnce("staff").mockReturnValueOnce("bill");
    const staff = buildCustomerWaiterPayload({}, "Please bring the bill", "Come");
    const staffAttempt = resolveCustomerWaiterAttempt(staff, null, createId);
    const bill = buildCustomerWaiterPayload({}, "Please bring the bill", "Bring the bill", "bill");
    const billAttempt = resolveCustomerWaiterAttempt(bill, staffAttempt, createId);
    expect(billAttempt.id).toBe("bill");
    expect(resolveCustomerWaiterAttempt({ ...bill }, billAttempt, createId)).toBe(billAttempt);
    expect(createId).toHaveBeenCalledTimes(2);
  });
});

describe("pending bill requests", () => {
  it.each([0, 1] as const)("finds a typed bill request in active status %s", (status) => {
    const pending = request({ request_type: "bill", status });
    expect(findPendingBillRequest([pending])).toBe(pending);
  });

  it("ignores delivered bills, staff requests and legacy calls even when their message mentions a bill", () => {
    expect(findPendingBillRequest([
      request({ request_type: "bill", status: 2 }),
      request({ request_type: "staff", status: 0, message: "Bring the bill" }),
      request({ status: 1, message: "Bring the bill" }),
    ])).toBeUndefined();
    expect(findPendingBillRequest([])).toBeUndefined();
  });

  it("finds the active bill after completed and unrelated requests without changing the list", () => {
    const pending = request({ request_uuid: "pending", request_type: "bill", status: 1 });
    const requests = Object.freeze([
      request({ request_type: "bill", status: 2 }),
      request({ request_type: "staff", status: 0 }),
      pending,
    ]);
    expect(findPendingBillRequest(requests)).toBe(pending);
    expect(requests).toHaveLength(3);
  });
});
