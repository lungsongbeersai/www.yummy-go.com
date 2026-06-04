import { describe, expect, it } from "vitest";
import type { CartOrder, PosTable } from "@/services/pos";
import {
  billDiscountButtonValue,
  buildCustomerDisplayPayload,
  cartDisplaySummary,
  cartSummary,
  discountDraftValue,
  newOrderConfirmGroups,
  splitPaymentSelection,
} from "./utils";

function cartOrder(overrides: Partial<CartOrder> = {}): CartOrder {
  return {
    order_uuid: "order-1",
    order_discount_type: "PCT",
    order_discount_value: 10,
    items: [
      {
        order_it_uuid: "item-1",
        prod_name: "Noodle",
        prod_image: "#10b981",
        prod_status_imge: 2,
        detail: {
          order_it_qty: 2,
          order_it_status: 2,
          order_it_status_text: "sent",
          gross_total: 24000,
          net_total: 20000,
          unit_price: 12000,
          size_name: "M",
          order_it_note: "less spicy",
          order_it_discount_amount: 4000,
        },
      },
      {
        order_it_uuid: "item-2",
        prod_name: "Tea",
        detail: {
          order_it_qty: 1,
          order_it_status: 1,
          gross_total: 8000,
          net_total: 8000,
        },
      },
    ],
    totals: {
      order_grand_total: 29500,
      order_service_amount: 700,
      order_subtotal: 32000,
      order_discount_amount: 4000,
      order_vat_amount: 800,
    },
    ...overrides,
  } as CartOrder;
}

const table: PosTable = {
  table_uuid: "table-1",
  table_name: "A1",
  table_status: 2,
};

describe("table selection utils", () => {
  it("formats bill discount and validates discount drafts", () => {
    expect(billDiscountButtonValue(cartOrder())).toBe("10%");
    expect(
      billDiscountButtonValue(
        cartOrder({ order_discount_type: "AMT", order_discount_value: 5000 }),
      ),
    ).toBe("5.000 ₭");
    expect(discountDraftValue({ type: "PCT", value: "101" }, 1000)).toBeNull();
    expect(discountDraftValue({ type: "AMT", value: "500" }, 1000)).toBe(500);
  });

  it("extracts confirmable new order groups", () => {
    expect(newOrderConfirmGroups([cartOrder()])).toEqual([
      { orderUuid: "order-1", itemUuids: ["item-2"] },
    ]);
  });

  it("builds split payment selection for one order", () => {
    const cart = cartOrder();
    const fullSummary = cartSummary(cart);
    const selection = splitPaymentSelection([cart], new Set(["item-1"]));
    expect(selection?.orderUuid).toBe("order-1");
    expect(selection?.itemUuids).toEqual(["item-1"]);
    expect(selection?.summary).toMatchObject({
      subtotal: 24000,
      itemDiscount: 4000,
      grandTotal: 20000,
    });
    expect(cartDisplaySummary(fullSummary, selection?.summary).grandTotal).toBe(
      20000,
    );
    expect(cartDisplaySummary(fullSummary, null)).toBe(fullSummary);
  });

  it("builds customer display payload", () => {
    const cart = cartOrder();
    const payload = buildCustomerDisplayPayload({
      cart,
      now: new Date("2026-05-29T00:00:00.000Z"),
      summary: cartSummary(cart),
      table,
    });

    expect(payload).toMatchObject({
      table_name: "A1",
      grand_total: 29500,
      service: 700,
      subtotal: 32000,
      total: 29500,
      updated_at: "2026-05-29T00:00:00.000Z",
      vat: 800,
    });
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0]).toMatchObject({
      image: null,
      imageColor: "#10b981",
      name: "Noodle (M)",
      note: "less spicy",
      qty: 2,
      total: 20000,
    });
  });
});
