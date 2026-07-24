import { describe, expect, it } from "vitest";
import {
  PUBLIC_MENU_KIND,
  normalizeCartOrders,
  publicMenuKindToStatusSortFk,
  splitSpecialProducts
} from "@/stores/public-pos-store/helpers";

describe("public POS store helpers", () => {
  it("normalizes cart responses from data or orders", () => {
    expect(normalizeCartOrders({ data: { order_uuid: "one" } })).toEqual([{ order_uuid: "one" }]);
    expect(normalizeCartOrders({ orders: [{ order_uuid: "two" }] })).toEqual([{ order_uuid: "two" }]);
    expect(normalizeCartOrders(null)).toEqual([]);
  });

  it("splits promotion and set products from special products", () => {
    const groups = splitSpecialProducts([
      { prodUuid: "p1", prodName: "Promo", prodImage: "", prodStatusImge: 1, statusSortFk: 3, canAdd: true, hasOptions: false, optionsMsg: "", countOptionAll: 0, countOptionEnabled: 0, countToppingEnabled: 0 },
      { prodUuid: "p2", prodName: "Set", prodImage: "", prodStatusImge: 1, statusSortFk: 2, canAdd: true, hasOptions: false, optionsMsg: "", countOptionAll: 0, countOptionEnabled: 0, countToppingEnabled: 0 }
    ]);

    expect(groups.promotion).toHaveLength(1);
    expect(groups.set).toHaveLength(1);
    expect(publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.NORMAL)).toBe(1);
  });
});
