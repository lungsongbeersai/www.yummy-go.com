import { describe, expect, it } from "vitest";
import type { OfflineCartLine } from "@/services/offline-order";
import {
  browserPrintRetryDelayMs,
  mobileReceiptItemsForPrint,
} from "./mobile-offline-queue";

function cartLine(
  overrides: Partial<OfflineCartLine> = {},
): OfflineCartLine {
  return {
    order_item_uuid: "item-1",
    order_it_uuid: "item-1",
    prod_uuid: "product-1",
    cate_uuid_fk: "category-1",
    pro_detail_uuid: "detail-1",
    prod_name: "Burger",
    title: "Burger",
    prod_status_imge: 0,
    prod_image: "",
    qty: 3,
    total: 180_000,
    detail: {
      size_name: "",
      order_it_qty: 3,
      unit_price: 60_000,
      base_line_total: 180_000,
      topping_unit_total: 0,
      topping_line_total: 0,
      gross_total: 180_000,
      order_it_discount_type: "",
      order_it_discount_value: 0,
      order_it_discount_amount: 0,
      net_total: 180_000,
      order_it_status: 1,
      order_it_note: "",
      affects_total: true,
    },
    toppings: [],
    ...overrides,
  };
}

describe("browserPrintRetryDelayMs", () => {
  it("backs off failed not-sent jobs but never abandons them", () => {
    expect(browserPrintRetryDelayMs(1)).toBe(30_000);
    expect(browserPrintRetryDelayMs(2)).toBe(60_000);
    expect(browserPrintRetryDelayMs(3)).toBe(120_000);
    expect(browserPrintRetryDelayMs(5)).toBe(480_000);
    expect(browserPrintRetryDelayMs(50)).toBe(480_000);
  });
});

describe("mobileReceiptItemsForPrint", () => {
  it("merges equivalent payment lines while leaving order rounds untouched", () => {
    const rows = [
      cartLine(),
      cartLine({
        order_item_uuid: "item-2",
        order_it_uuid: "item-2",
        qty: 2,
        total: 120_000,
        detail: {
          ...cartLine().detail,
          order_it_qty: 2,
          base_line_total: 120_000,
          gross_total: 120_000,
          net_total: 120_000,
        },
      }),
    ];
    const snapshot = structuredClone(rows);

    expect(mobileReceiptItemsForPrint(rows)).toEqual([
      { name: "Burger", qty: 5, total: 300_000 },
    ]);
    expect(rows).toEqual(snapshot);
  });

  it("does not merge different sizes, notes, prices, discounts, or toppings", () => {
    const base = cartLine();
    expect(
      mobileReceiptItemsForPrint([
        base,
        cartLine({ detail: { ...base.detail, size_name: "Large" } }),
        cartLine({ detail: { ...base.detail, order_it_note: "no onion" } }),
        cartLine({ detail: { ...base.detail, unit_price: 65_000 } }),
        cartLine({
          detail: {
            ...base.detail,
            order_it_discount_type: "PCT",
            order_it_discount_value: 10,
            order_it_discount_amount: 18_000,
            net_total: 162_000,
          },
          total: 162_000,
        }),
        cartLine({
          toppings: [{
            prod_topping_uuid_fk: "topping-1",
            topping_name: "Cheese",
            topping_qty: 1,
            topping_price: 5_000,
          }],
        }),
      ]),
    ).toHaveLength(6);
  });
});
