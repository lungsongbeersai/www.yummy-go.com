import { describe, expect, it } from "vitest";
import type { CartOrder, ProdItem } from "@/services/pos";
import type { PublicAddToCartPayload } from "./types";
import { findExistingCartItem } from "./cart-domain";

const product: ProdItem = {
  prodUuid: "product-1",
  prodName: "Noodle",
  prodStatusImge: 1,
  prodImage: "",
  details: [],
  toppings: [],
};

function payload(tasteUuid: string): PublicAddToCartPayload {
  return {
    detail: { proDetailUuid: "detail-1" },
    qty: 1,
    note: "",
    tastes: [{ tasteUuid, tasteName: tasteUuid }],
    toppings: [],
  };
}

describe("findExistingCartItem taste identity", () => {
  it("only merges a draft cart line with the same selected tastes", () => {
    const cart: CartOrder[] = [{
      order_uuid: "order-1",
      items: [{
        order_item_uuid: "item-1",
        prod_uuid: "product-1",
        pro_detail_uuid: "detail-1",
        tastes: [{ taste_uuid_fk: "taste-1", taste_name: "taste-1" }],
        toppings: [],
        detail: { order_it_status: 0, order_it_note: "" },
      }],
    }];

    expect(findExistingCartItem(cart, product, payload("taste-1"), null)?.order_item_uuid)
      .toBe("item-1");
    expect(findExistingCartItem(cart, product, payload("taste-2"), null)).toBeNull();
  });
});
