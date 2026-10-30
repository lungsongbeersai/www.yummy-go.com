import { describe, expect, it } from "vitest";
import type { CartItem } from "@/services/pos";
import { depositableOrderItems } from "./deposit-order-items";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return { pro_detail_uuid: "variant-a", prod_code: "DR-001", title: "Tea",
    pro_detail_stock: 1, detail: { order_it_status: 2, order_it_qty: 1, size_name: "Bottle" }, ...overrides };
}

describe("depositableOrderItems", () => {
  it("uses the real product code while keeping variants as separate mutation identities", () => {
    const rows = depositableOrderItems([item(), item({ pro_detail_uuid: "variant-b" })], new Map());
    expect(rows.map((row) => [row.proDetailUuid, row.productCode])).toEqual([
      ["variant-a", "DR-001"], ["variant-b", "DR-001"]
    ]);
    expect(depositableOrderItems([item({ prod_code: "" })], new Map())[0].productCode).toBe("");
  });

  it("excludes drafts, cancelled, non-stock items and previous withdrawals", () => {
    expect(depositableOrderItems([
      item({ detail: { order_it_status: 0, order_it_qty: 1 } }),
      item({ detail: { order_it_status: 9, order_it_qty: 1 } }),
      item({ pro_detail_stock: 0 }), item({ pro_detail_stock: undefined }),
      item({ is_deposit_redemption: true })
    ], new Map())).toEqual([]);
  });

  it("subtracts all earlier deposits once from the summed bill quantity", () => {
    const rows = depositableOrderItems([
      item({ detail: { order_it_status: 1, order_it_qty: 0.1 } }),
      item({ detail: { order_it_status: 4, order_it_qty: 0.2 } })
    ], new Map([["variant-a", 0.125]]));
    expect(rows[0].orderedQty).toBe(0.3);
    expect(rows[0].availableQty).toBe(0.175);
    expect(depositableOrderItems([item()], new Map([["variant-a", 1]]))).toEqual([]);
  });
});
