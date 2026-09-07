import { describe, expect, it } from "vitest";
import { emptyOfflineMasterIndex } from "./master-index";
import { seedOfflineStateFromCart } from "./cart-seed";
import { projectOfflineCart } from "./cart-projection";
import { reduceOfflineOrderEvents } from "./order-state";
import { OfflineCartDataUnavailableError } from "./cart-data-error";

// Actual cashier contract: title + detail.unit_price, no product/detail UUID.
function backendLine(uuid: string, unitPrice = 40000, overrides: Record<string, unknown> = {}) {
  return {
    order_it_uuid: uuid, title: "Shiopan", prod_image: "bread.png", prod_status_imge: 1,
    detail: { order_it_qty: 1, unit_price: unitPrice, order_it_status: 2, order_it_note: "",
      order_it_discount_type: "AMT", order_it_discount_value: 16000,
      order_it_discount_amount: 16000, gross_total: unitPrice, net_total: unitPrice - 16000,
      affects_total: true },
    toppings: [], ...overrides,
  };
}
function stateWith(items: unknown[]) {
  return seedOfflineStateFromCart({ orders: [{ order_uuid: "bill", order_invoice: "060926-0011",
    table_uuid_fk: "T03", service_charge_rate: 0, vat_rate: 10, vat_status: 2,
    order_discount_type: 0, order_discount_value: 0, items }] });
}

describe("offline Backend cart snapshots", () => {
  it("shows cached names/prices without any product master or product detail UUID", () => {
    const cart = projectOfflineCart(stateWith([backendLine("one"), backendLine("two")]),
      { table_uuid: "T03" }, emptyOfflineMasterIndex());
    expect(cart.orders[0].order_invoice).toBe("060926-0011");
    expect(cart.orders[0].items.map((item) => [item.prod_name, item.total])).toEqual([["Shiopan", 24000], ["Shiopan", 24000]]);
    expect(cart.orders[0].totals).toMatchObject({ order_total: 80000, order_item_discount_amount: 32000, order_grand_total: 48000, order_vat_amount: 4000 });
  });

  it("does not replace different sale-time prices with the menu or another line's price", () => {
    const master = emptyOfflineMasterIndex();
    master.details.set("detail", { prodDetailUuid: "detail", prodUuid: "p", price: 99000,
      productName: "New menu name", productImage: "", productHasImage: 0 });
    const state = stateWith([backendLine("one", 40000, { pro_detail_uuid: "detail" }), backendLine("two", 50000, { pro_detail_uuid: "detail" })]);
    const cart = projectOfflineCart(state, { order_uuid: "bill" }, master);
    expect(cart.orders[0].items.map((item) => item.detail.unit_price)).toEqual([40000, 50000]);
  });

  it("keeps real zero-priced items, but rejects missing price or name", () => {
    const free = backendLine("free", 0, { detail: { unit_price: 0, order_it_qty: 1, order_it_status: 1 } });
    expect(projectOfflineCart(stateWith([free]), { order_uuid: "bill" }, emptyOfflineMasterIndex()).orders[0].items[0].total).toBe(0);
    for (const line of [{ ...free, title: "" }, { ...free, detail: { order_it_qty: 1, order_it_status: 1 } }]) {
      expect(() => projectOfflineCart(stateWith([line]), { order_uuid: "bill" }, emptyOfflineMasterIndex()))
        .toThrow(OfflineCartDataUnavailableError);
    }
  });

  it("replays quantity edits without multiplying topping quantities twice or keeping stale totals", () => {
    const state = stateWith([backendLine("one", 20000, {
      detail: { unit_price: 20000, order_it_qty: 2, order_it_status: 1, base_line_total: 40000,
        gross_total: 50000, net_total: 50000, topping_unit_total: 5000, topping_line_total: 10000 },
      toppings: [{ prod_topping_uuid: "top", topping_name: "Extra", topping_qty_per_unit: 1,
        topping_total_qty: 2, topping_qty: 1, topping_price: 5000, topping_line_total: 10000 }],
    })]);
    const next = reduceOfflineOrderEvents([{ kind: "ITEM_QTY", orderItemUuid: "one", changeType: "INCREASE", changeQty: 1 }], state);
    const line = projectOfflineCart(next, { order_uuid: "bill" }, emptyOfflineMasterIndex()).orders[0].items[0];
    expect(line.detail).toMatchObject({ unit_price: 20000, base_line_total: 60000, topping_line_total: 15000, gross_total: 75000, net_total: 75000 });
    expect(line.toppings[0]).toMatchObject({ topping_name: "Extra", topping_total_qty: 3, topping_line_total: 15000 });
  });

  it("reads numeric discount and tax/service aliases from the actual Backend order", () => {
    const state = seedOfflineStateFromCart({ orders: [{ order_uuid: "bill", order_discount_type: 2,
      order_discount_value: 10000, service_charge_rate: 10, vat_rate: 10, vat_status: 3,
      items: [backendLine("one", 40000, { detail: { unit_price: 40000, order_it_qty: 1, order_it_status: 1 } })] }] });
    expect(projectOfflineCart(state, { order_uuid: "bill" }, emptyOfflineMasterIndex()).orders[0].totals)
      .toMatchObject({ order_discount_amount: 10000, order_service_amount: 3000, order_grand_total: 36000 });
  });
});
