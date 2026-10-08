import { describe, expect, it } from "vitest";
import type { CartItem } from "@/services/pos";
import { currentCartItemAction, isMissingCartItemError } from "./cart-item-action-state";

const item = (uuid: string, status: number, qty = 1): CartItem => ({ order_it_uuid: uuid, detail: { order_it_status: status, order_it_qty: qty } });

describe("current cart item actions", () => {
  it("uses the latest quantity of the exact persisted item", () => {
    const current = item("first", 2, 2);
    expect(currentCartItemAction([current, item("second", 9)], "first", "cancel")).toBe(current);
  });
  it("does not substitute another row when the original item is gone", () => {
    expect(currentCartItemAction([item("second", 2)], "first", "cancel")).toBeNull();
  });
  it.each([0, 1, 4, 9])("rejects cancellation when the current status is %s", (status) => {
    expect(currentCartItemAction([item("first", status)], "first", "cancel")).toBeNull();
  });
  it("allows deleting drafts but never kitchen-confirmed items", () => {
    expect(currentCartItemAction([item("first", 1)], "first", "delete")).not.toBeNull();
    expect(currentCartItemAction([item("first", 2)], "first", "delete")).toBeNull();
  });
  it("recognizes the API missing-item errors without hiding other failures", () => {
    expect(isMissingCartItemError(new Error("ບໍ່ພົບ order item"))).toBe(true);
    expect(isMissingCartItemError(new Error("ບໍ່ພົບ order item ຂອງໂຕະນີ້"))).toBe(true);
    expect(isMissingCartItemError(new Error("stock unavailable"))).toBe(false);
  });
});
