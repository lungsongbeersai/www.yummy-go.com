import { describe, expect, it } from "vitest";
import type { CartItem, CartOrder } from "@/services/pos";
import { canRequestBillFromCart } from "./cart-bill-request";

function item(status: unknown, overrides: Partial<CartItem> = {}): CartItem {
  return {
    order_it_uuid: "item",
    order_it_status: status,
    detail: { order_it_qty: 1 },
    ...overrides,
  };
}

function cart(...items: CartItem[]): CartOrder[] {
  return [{ order_uuid: "order", items }];
}

describe("cart bill request eligibility", () => {
  it.each([1, 2, 3, 4])("allows confirmed customer items in status %s", (status) => {
    expect(canRequestBillFromCart(cart(item(status)), null)).toBe(true);
  });

  it("counts waiting-for-staff items as submitted even when a nonzero status rule refers to staff confirmation", () => {
    expect(canRequestBillFromCart(cart(item(1)), { not_confirmed_status: 1 })).toBe(true);
  });

  it("requires every live item across every order to be submitted", () => {
    const orders: CartOrder[] = [
      ...cart(item(4)),
      { order_uuid: "second-order", items: [item(1), item(0)] },
    ];
    expect(canRequestBillFromCart(orders, { not_confirmed_status: 0 })).toBe(false);
    orders[1].items?.pop();
    expect(canRequestBillFromCart(orders, { not_confirmed_status: 0 })).toBe(true);
  });

  it("does not offer bill requests for empty or entirely canceled carts", () => {
    expect(canRequestBillFromCart([], null)).toBe(false);
    expect(canRequestBillFromCart([{ order_uuid: "order" }], null)).toBe(false);
    expect(canRequestBillFromCart(cart(), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(9)), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(0, { detail: { order_it_status_text: "ຍົກເລີກ" } })), null)).toBe(false);
  });

  it("ignores canceled lines while evaluating the remaining real items", () => {
    expect(canRequestBillFromCart(cart(
      item(2), item(9), item(0, { detail: { order_it_status_text: "Cancelled" } }),
    ), null)).toBe(true);
  });

  it.each([0, 5, -1, null, undefined, "", " ", "unknown", true, Number.NaN, Infinity, 1.5])(
    "blocks unsubmitted or unproven item status %j",
    (status) => {
      expect(canRequestBillFromCart(cart(item(2), item(status)), null)).toBe(false);
    }
  );

  it("does not infer confirmation from a translated label or a dynamic visibility status list", () => {
    expect(canRequestBillFromCart(cart(item(5, { detail: { order_it_qty: 1, order_it_status_text: "Served" } })), {
      total_counts_statuses: [0, 1, 2, 3, 4, 5],
    })).toBe(false);
  });

  it.each([0, -1, null, undefined, "", " ", "unknown", true, Number.NaN, Infinity])(
    "blocks live items with unproven or nonpositive quantity %j",
    (quantity) => {
      const line: CartItem = { order_it_uuid: "item", order_it_status: 2, quantity };
      expect(canRequestBillFromCart(cart(line), null)).toBe(false);
    }
  );

  it("supports explicit numeric strings from legacy cart fields", () => {
    expect(canRequestBillFromCart(cart({ order_item_uuid: "item", order_it_status: "1", quantity: "2" }), null)).toBe(true);
  });

  it("prioritizes the detail status and quantity over legacy top-level fields", () => {
    expect(canRequestBillFromCart(cart(item(2, { qty: 1, detail: { order_it_status: 0, order_it_qty: 1 } })), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(2, { qty: 1, detail: { order_it_status: 2, order_it_qty: 0 } })), null)).toBe(false);
  });

  it("requires a real order and order item rather than display-only placeholders", () => {
    expect(canRequestBillFromCart([{ order_uuid: "", items: [item(2)] }], null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(2, { order_it_uuid: undefined })), null)).toBe(false);
  });

  it("ignores deposit redemption history without letting it count as a submitted item", () => {
    const redemption: CartItem = { is_deposit_redemption: true, withdrawal_uuid: "withdrawal", qty: 1, chargeable: false };
    expect(canRequestBillFromCart(cart(redemption), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(4), redemption), null)).toBe(true);
  });

  it("checks underlying group statuses without counting canceled children as drafts", () => {
    expect(canRequestBillFromCart(cart(item(2, { order_it_statuses: [2, 4, 9] })), null)).toBe(true);
    expect(canRequestBillFromCart(cart(item(2, { order_it_statuses: [0, 2] })), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(2, { order_it_statuses: [2, 5] })), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(2, { order_it_statuses: [] })), null)).toBe(false);
    expect(canRequestBillFromCart(cart(item(2, { order_it_statuses: [9] })), null)).toBe(false);
  });

  it("does not mutate the fetched cart while checking eligibility", () => {
    const line = Object.freeze(item(1));
    const items = Object.freeze([line]);
    const order = Object.freeze({ order_uuid: "order", items: items as unknown as CartItem[] });
    expect(canRequestBillFromCart(Object.freeze([order]), null)).toBe(true);
    expect(items).toHaveLength(1);
  });
});
