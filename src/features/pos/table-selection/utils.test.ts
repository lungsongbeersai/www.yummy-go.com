import { describe, expect, it } from "vitest";
import type { CartItem, CartOrder, PosTable } from "@/services/pos";
import {
  appendDiscountCalculatorInput,
  billDiscountButtonValue,
  buildCustomerDisplayPayload,
  canPayFullBill,
  cartDisplaySummary,
  cartForTable,
  cartItemBaseUnitPrice,
  cartItemsQty,
  cartOrderBelongsToTable,
  cartOrdersBelongToTable,
  cartQuantityCount,
  cartSummary,
  cartToppingDisplay,
  discountDraftValue,
  discountDraftWithType,
  isCanceledCartItem,
  isNewOrderCartItem,
  isOrderHistoryCartItem,
  isServedCartItem,
  isWaitingCartItem,
  markTableAvailableInZones,
  newOrderTabItems,
  newOrderConfirmGroups,
  normalizeDiscountType,
  pruneSelectedItemQuantities,
  splitPaymentSelection,
  visibleCartItems,
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
  it("keeps the cart unit price separate from topping totals", () => {
    expect(
      cartItemBaseUnitPrice({
        detail: {
          order_it_qty: 1,
          unit_price: 86000,
          base_line_total: 45000,
          topping_line_total: 41000,
          gross_total: 86000,
        },
      }),
    ).toBe(45000);
  });

  it("formats bill discount and validates discount drafts", () => {
    expect(billDiscountButtonValue(cartOrder())).toBe("10%");
    expect(
      billDiscountButtonValue(
        cartOrder({ order_discount_type: "AMT", order_discount_value: 5000 }),
      ),
    ).toBe("5.000 ₭");
    expect(
      billDiscountButtonValue(
        cartOrder({
          order_discount_type: "amt" as CartOrder["order_discount_type"],
          order_discount_value: 100000,
        }),
      ),
    ).toBe("100.000 ₭");
    const numericTypeAmountLabel = billDiscountButtonValue(
      cartOrder({
        order_discount_type: "2" as CartOrder["order_discount_type"],
        order_discount_value: 100000,
      }),
    );
    const inferredAmountLabel = billDiscountButtonValue(
      cartOrder({
        order_discount_type: undefined,
        order_discount_value: 100000,
      }),
    );

    expect(numericTypeAmountLabel).toContain("100.000");
    expect(numericTypeAmountLabel).not.toContain("%");
    expect(inferredAmountLabel).toContain("100.000");
    expect(inferredAmountLabel).not.toContain("%");
    expect(normalizeDiscountType(undefined, 10)).toBe("PCT");
    expect(normalizeDiscountType(undefined, 100000)).toBe("AMT");
    expect(discountDraftValue({ type: "PCT", value: "101" }, 1000)).toBeNull();
    expect(discountDraftValue({ type: "AMT", value: "500" }, 1000)).toBe(500);
  });

  it("blocks percent keypad input above 100 but allows amounts", () => {
    expect(appendDiscountCalculatorInput({ type: "PCT", value: "10" }, "0")).toBe("100");
    expect(appendDiscountCalculatorInput({ type: "PCT", value: "100" }, "0")).toBe("100");
    expect(appendDiscountCalculatorInput({ type: "PCT", value: "99" }, "9")).toBe("99");
    expect(appendDiscountCalculatorInput({ type: "PCT", value: "5" }, "00")).toBe("5");
    expect(appendDiscountCalculatorInput({ type: "PCT", value: "100" }, "delete")).toBe("10");
    expect(appendDiscountCalculatorInput({ type: "AMT", value: "100" }, "000")).toBe("100000");
  });

  it("clears the draft value when switching to percent with a value above 100", () => {
    expect(discountDraftWithType({ type: "AMT", value: "5000" }, "PCT")).toEqual({
      type: "PCT",
      value: "",
    });
    expect(discountDraftWithType({ type: "AMT", value: "50" }, "PCT")).toEqual({
      type: "PCT",
      value: "50",
    });
    expect(discountDraftWithType({ type: "PCT", value: "50" }, "AMT")).toEqual({
      type: "AMT",
      value: "50",
    });
  });

  it("extracts confirmable new order groups", () => {
    expect(newOrderConfirmGroups([cartOrder()])).toEqual([
      { orderUuid: "order-1", itemUuids: ["item-2"] },
    ]);
  });

  it("keeps waiting items at the bottom of the new order tab", () => {
    const waitingItem = {
      order_it_uuid: "waiting",
      detail: { order_it_status: 0, net_total: 12000 },
    } as CartItem;
    const newItem = {
      order_it_uuid: "new",
      detail: { order_it_status: 1, net_total: 8000 },
    } as CartItem;
    const historyItem = {
      order_it_uuid: "history",
      detail: { order_it_status: 2, net_total: 20000 },
    } as CartItem;
    const cart = cartOrder({
      items: [waitingItem, newItem, historyItem],
      totals: undefined,
    });

    expect(visibleCartItems(cart)).toEqual([waitingItem, newItem, historyItem]);
    expect(visibleCartItems(cart).filter(isWaitingCartItem)).toEqual([waitingItem]);
    expect(visibleCartItems(cart).filter(isNewOrderCartItem)).toEqual([newItem]);
    expect(visibleCartItems(cart).filter(isOrderHistoryCartItem)).toEqual([historyItem]);
    expect(newOrderTabItems(visibleCartItems(cart))).toEqual([newItem, waitingItem]);
    expect(cartSummary(cart).subtotal).toBe(40000);
    expect(newOrderConfirmGroups([cart])).toEqual([
      { orderUuid: "order-1", itemUuids: ["new"] },
    ]);
  });

  it("counts cart quantity from order totals and item quantities", () => {
    const cart = cartOrder({
      items: [
        {
          order_it_uuid: "item-1",
          detail: { order_it_qty: 2, net_total: 150000 },
        },
        {
          order_it_uuid: "item-2",
          detail: { order_it_qty: 1, net_total: 200000 },
        },
        {
          order_it_uuid: "item-3",
          detail: { order_it_qty: 1, net_total: 200000 },
        },
        {
          order_it_uuid: "item-4",
          detail: { order_it_qty: 1, net_total: 200000 },
        },
        {
          order_it_uuid: "item-5",
          detail: { order_it_qty: 1, net_total: 200000 },
        },
      ],
      totals: { order_qty: 6 },
    });

    expect(visibleCartItems(cart)).toHaveLength(5);
    expect(cartItemsQty(visibleCartItems(cart))).toBe(6);
    expect(cartQuantityCount(cart)).toBe(6);
    expect(cartQuantityCount(cartOrder({ totals: undefined }))).toBe(3);
  });

  it("allows full payment when waiting items are the only unpaid new-order items", () => {
    expect(
      canPayFullBill({
        currentOrderUuid: "order-1",
        grandTotal: 12000,
        historyItemCount: 0,
        newOrderItemCount: 0,
        waitingItemCount: 1,
      }),
    ).toBe(true);
    expect(
      canPayFullBill({
        currentOrderUuid: "order-1",
        grandTotal: 32000,
        historyItemCount: 1,
        newOrderItemCount: 0,
        waitingItemCount: 1,
      }),
    ).toBe(true);
  });

  it("blocks full payment when status 1 items are still waiting for kitchen confirmation", () => {
    expect(
      canPayFullBill({
        currentOrderUuid: "order-1",
        grandTotal: 20000,
        historyItemCount: 0,
        newOrderItemCount: 1,
        waitingItemCount: 1,
      }),
    ).toBe(false);
  });

  it("blocks full payment without payable items or total", () => {
    expect(
      canPayFullBill({
        currentOrderUuid: "order-1",
        grandTotal: 0,
        historyItemCount: 0,
        newOrderItemCount: 0,
        waitingItemCount: 1,
      }),
    ).toBe(false);
    expect(
      canPayFullBill({
        currentOrderUuid: "order-1",
        grandTotal: 12000,
        historyItemCount: 0,
        newOrderItemCount: 0,
        waitingItemCount: 0,
      }),
    ).toBe(false);
    expect(
      canPayFullBill({
        currentOrderUuid: null,
        grandTotal: 12000,
        historyItemCount: 0,
        newOrderItemCount: 0,
        waitingItemCount: 1,
      }),
    ).toBe(false);
  });

  it("detects canceled cart items from status code and text", () => {
    expect(isCanceledCartItem({ detail: { order_it_status: 9 } } as CartItem)).toBe(true);
    expect(isCanceledCartItem({ detail: { order_it_status_text: "ຍົກເລີກ" } } as CartItem)).toBe(true);
    expect(isCanceledCartItem({ detail: { order_it_status_text: "sent" } } as CartItem)).toBe(false);
  });

  // Locks in the staff table view's "exact match only" served rule: unlike
  // the public QR menu (public-pos/order), this surface does not match the
  // Lao word "ເສີບ" as a substring, and only an exact "served" string
  // counts — a genuine divergence found while deduping into
  // src/lib/pos/cart-status.ts, not an oversight to silently fix here.
  it("detects served cart items from status code or an exact status text match only", () => {
    expect(isServedCartItem({ detail: { order_it_status: 4 } } as CartItem)).toBe(true);
    expect(isServedCartItem({ detail: { order_it_status_text: "served" } } as CartItem)).toBe(true);
    expect(isServedCartItem({ detail: { order_it_status_text: "Served up" } } as CartItem)).toBe(false);
    expect(isServedCartItem({ detail: { order_it_status_text: "ເສີບ" } } as CartItem)).toBe(false);
  });

  it("marks a table available in zone state after its cart becomes empty", () => {
    const zones = [
      {
        zone_uuid: "zone-1",
        zone_name: "Indoor",
        tables: [
          {
            table_uuid: "table-1",
            table_name: "A1",
            table_status: 2,
            customer_order_state: true,
          },
          {
            table_uuid: "table-2",
            table_name: "A2",
            table_status: 2,
            customer_order_state: true,
          },
        ],
      },
    ];

    const nextZones = markTableAvailableInZones(zones, "table-1");

    expect(nextZones[0]?.tables[0]).toMatchObject({
      customer_order_state: false,
      table_status: 1,
    });
    expect(nextZones[0]?.tables[1]).toBe(zones[0]?.tables[1]);
  });

  it("keeps cart data only for the selected table", () => {
    const currentTableCart = cartOrder({
      order_uuid: "order-current",
      table_uuid_fk: "table-1",
    });
    const otherTableCart = cartOrder({
      order_uuid: "order-other",
      table_uuid_fk: "table-2",
    });

    expect(cartForTable(currentTableCart, "table-1")).toBe(currentTableCart);
    expect(cartForTable(otherTableCart, "table-1")).toBeNull();
    expect(cartForTable([otherTableCart, currentTableCart], "table-1")).toEqual([
      currentTableCart,
    ]);
  });

  it("checks whether payment orders belong to the selected table", () => {
    expect(
      cartOrderBelongsToTable(
        cartOrder({ table_uuid_fk: "table-1" }),
        table,
      ),
    ).toBe(true);
    expect(
      cartOrderBelongsToTable(
        cartOrder({ table_uuid_fk: "table-2" }),
        table,
      ),
    ).toBe(false);
    expect(
      cartOrderBelongsToTable(cartOrder({ table_name_la: "A1" }), table),
    ).toBe(true);
    expect(
      cartOrdersBelongToTable(
        [
          cartOrder({ table_uuid_fk: "table-1" }),
          cartOrder({ order_uuid: "order-2", table_uuid_fk: "table-2" }),
        ],
        table,
      ),
    ).toBe(false);
  });

  it("preserves legacy cart data when the API does not include table ids", () => {
    const legacyCart = cartOrder();

    expect(cartForTable(legacyCart, "table-1")).toBe(legacyCart);
    expect(cartForTable([legacyCart], "table-1")).toEqual([legacyCart]);
    expect(cartForTable(legacyCart, "")).toBeNull();
  });

  it("builds split payment selection for one order", () => {
    const cart = cartOrder();
    const fullSummary = cartSummary(cart);
    const selection = splitPaymentSelection([cart], new Map([["item-1", 2]]));
    expect(selection?.orderUuid).toBe("order-1");
    expect(selection?.orderItemUuids).toEqual([{ "item-1": 2 }]);
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

  it("prorates the item total when only part of its quantity is selected", () => {
    // item-1: order_it_qty 2, gross_total 24000, discount 4000 — เลือกจ่ายแค่ 1 ใน 2
    // (เช่น เบียร์ 10 ขวด จ่ายก่อน 2 ขวด) ยอด/discount ต้องถูกสเกลลงครึ่งหนึ่งตามสัดส่วน
    const cart = cartOrder();
    const selection = splitPaymentSelection([cart], new Map([["item-1", 1]]));
    expect(selection?.orderItemUuids).toEqual([{ "item-1": 1 }]);
    expect(selection?.summary).toMatchObject({
      subtotal: 12000,
      itemDiscount: 2000,
      grandTotal: 10000,
    });
  });

  it("includes the stored VAT rate in a split payment even when legacy cache flags are missing", () => {
    const cart = cartOrder({
      vat_enabled: undefined,
      branch_vat_status: undefined,
      vat_rate: 10,
      items: [
        {
          order_it_uuid: "item-1",
          detail: {
            order_it_qty: 1,
            order_it_status: 2,
            gross_total: 870000,
            order_it_discount_amount: 0,
          },
        },
      ],
    });

    const selection = splitPaymentSelection([cart], new Map([["item-1", 1]]));

    expect(selection?.summary).toMatchObject({
      subtotal: 870000,
      tax: 87000,
      grandTotal: 957000,
    });
  });

  it("rounds split service and VAT in the same order as the backend", () => {
    const cart = cartOrder({
      service_charge_rate: 7,
      vat_rate: 10,
      items: [
        {
          order_it_uuid: "item-1",
          detail: {
            order_it_qty: 1,
            order_it_status: 2,
            gross_total: 100007,
            order_it_discount_amount: 0,
          },
        },
      ],
    });

    const selection = splitPaymentSelection([cart], new Map([["item-1", 1]]));

    // service = round(100007 * 7%) = 7000
    // VAT = round((100007 + 7000) * 10%) = 10701
    expect(selection?.summary).toMatchObject({
      serviceTotal: 7000,
      tax: 10701,
      grandTotal: 117708,
    });
  });

  it("prunes split selections that are no longer eligible", () => {
    const current = new Map([
      ["item-1", 2],
      ["item-2", 1],
    ]);
    const eligibleItems: CartItem[] = [
      { order_it_uuid: "item-1", detail: { order_it_qty: 2 } },
      { order_it_uuid: "item-2", detail: { order_it_qty: 1 } },
    ];
    const unchanged = pruneSelectedItemQuantities(current, eligibleItems);
    const pruned = pruneSelectedItemQuantities(current, [eligibleItems[0]]);

    expect(unchanged).toBe(current);
    expect([...pruned.entries()]).toEqual([["item-1", 2]]);
  });

  it("clamps a selected quantity down when the item's own quantity shrinks", () => {
    const current = new Map([["item-1", 2]]);
    const eligibleItems: CartItem[] = [
      { order_it_uuid: "item-1", detail: { order_it_qty: 1 } },
    ];
    const clamped = pruneSelectedItemQuantities(current, eligibleItems);

    expect([...clamped.entries()]).toEqual([["item-1", 1]]);
  });

  it("shows topping qty and total as returned by the backend", () => {
    expect(
      cartToppingDisplay({
        topping_name: "Egg",
        topping_qty: 10,
        topping_price: 5000,
        topping_line_total: 50000,
      }),
    ).toEqual({ qty: 10, total: 50000 });
    expect(
      cartToppingDisplay({ topping_name: "Egg", topping_price: 5000 }),
    ).toEqual({ qty: null, total: 5000 });
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
