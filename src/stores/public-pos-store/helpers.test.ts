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
      { prod_uuid: "p1", prod_name: "Promo", prod_image: "", prod_status_imge: 1, status_sort_fk: 3, can_add: true, has_options: false, options_msg: "", count_option_all: 0, count_option_enabled: 0, count_topping_enabled: 0 },
      { prod_uuid: "p2", prod_name: "Set", prod_image: "", prod_status_imge: 1, status_sort_fk: 2, can_add: true, has_options: false, options_msg: "", count_option_all: 0, count_option_enabled: 0, count_topping_enabled: 0 }
    ]);

    expect(groups.promotion).toHaveLength(1);
    expect(groups.set).toHaveLength(1);
    expect(publicMenuKindToStatusSortFk(PUBLIC_MENU_KIND.NORMAL)).toBe(1);
  });
});
