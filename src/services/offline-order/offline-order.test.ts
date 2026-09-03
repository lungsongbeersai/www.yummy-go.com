import { describe, expect, it } from "vitest";
import type { BrowserSyncQueueEntry } from "@/services/offline-db";
import {
  OFFLINE_ITEM_STATUS,
  buildOfflineMasterIndex,
  decodeOfflineOrderEvents,
  openOrderForTable,
  projectOfflineCart,
  reduceOfflineOrderEvents,
  visibleItemsForOrder,
} from "@/services/offline-order";

const TABLE = "77777777-7777-4777-8777-777777777777";
const DETAIL = "55555555-5555-4555-8555-555555555555";
const PRODUCT = "44444444-4444-4444-8444-444444444444";
const ORDER = "10000000-0000-4000-8000-000000000001";

let sequence = 0;

function queued(
  method: string,
  path: string,
  data: Record<string, unknown>,
): BrowserSyncQueueEntry {
  sequence += 1;
  return {
    eventUuid: `evt-${String(sequence).padStart(4, "0")}`,
    storeUuid: "store-1",
    branchUuid: "branch-1",
    actorLoginUuid: "login-1",
    method,
    path,
    params: {},
    data,
    requestFingerprint: "",
    dependencies: [],
    status: "PENDING",
    lastError: null,
    createdAt: sequence,
    updatedAt: sequence,
  };
}

function createOrder(items: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) {
  return queued("post", "/api/v1/posAll/create_order", {
    order_uuid: ORDER,
    table_uuid_fk: TABLE,
    branch_uuid_fk: "branch-1",
    order_service_rate: 0,
    order_vat_rate: 0,
    order_vat_status: 1,
    items,
    ...overrides,
  });
}

function item(orderItemUuid: string, qty: number, extra: Record<string, unknown> = {}) {
  return {
    order_it_uuid: orderItemUuid,
    prod_detail_uuid_fk: DETAIL,
    order_it_qty: qty,
    order_it_status: OFFLINE_ITEM_STATUS.WAITING,
    ...extra,
  };
}

const master = buildOfflineMasterIndex([
  {
    path: "/api/v1/posAll/fetch_cate_products",
    response: {
      data: [{
        cate_uuid: "cate-1",
        products: [{
          prod_uuid: PRODUCT,
          prod_name: "ເຂົ້າຜັດ",
          prod_image: "rice.png",
          prod_status_imge: 1,
          pro_detail_uuid: DETAIL,
          pro_detail_sprice: 20000,
        }],
      }],
    },
  },
]);

function stateFrom(entries: BrowserSyncQueueEntry[]) {
  return reduceOfflineOrderEvents(decodeOfflineOrderEvents(entries));
}

function cartFrom(entries: BrowserSyncQueueEntry[]) {
  return projectOfflineCart(stateFrom(entries), { table_uuid: TABLE }, master);
}

describe("offline order state", () => {
  it("opens one bill for a table and adds the item that was queued", () => {
    const cart = cartFrom([createOrder([item("item-1", 2)])]);

    expect(cart.orders).toHaveLength(1);
    expect(cart.orders[0].order_uuid).toBe(ORDER);
    expect(cart.orders[0].items).toHaveLength(1);
    expect(cart.orders[0].items[0]).toMatchObject({
      pro_detail_uuid: DETAIL,
      prod_uuid: PRODUCT,
      prod_name: "ເຂົ້າຜັດ",
      qty: 2,
      total: 40000,
    });
    expect(cart.orders[0].totals.order_grand_total).toBe(40000);
  });

  it("keeps a second round on the same bill instead of opening a new one", () => {
    const state = stateFrom([
      createOrder([item("item-1", 1)]),
      createOrder([item("item-2", 3)]),
    ]);

    expect(state.orders.size).toBe(1);
    expect(openOrderForTable(state, TABLE)?.orderUuid).toBe(ORDER);
    expect(visibleItemsForOrder(state, ORDER).map((line) => line.orderItemUuid))
      .toEqual(["item-1", "item-2"]);
  });

  it("applies a quantity change as a delta, never below zero", () => {
    const cart = cartFrom([
      createOrder([item("item-1", 2)]),
      queued("patch", "/api/v1/posAll/order_item/update_qty", {
        order_item_uuid: "item-1", change_type: "INCREASE", change_qty: 3,
      }),
      queued("patch", "/api/v1/posAll/order_item/update_qty", {
        order_item_uuid: "item-1", change_type: "DECREASE", change_qty: 99,
      }),
    ]);

    expect(cart.orders).toHaveLength(1);
    expect(cart.orders[0].items).toHaveLength(0);
  });

  it("carries the note and the item discount into the line", () => {
    const cart = cartFrom([
      createOrder([item("item-1", 2)]),
      queued("patch", "/api/v1/posAll/update_note", {
        order_it_uuid: "item-1", order_it_note: "ບໍ່ເອົາຜັກ",
      }),
      queued("patch", "/api/v1/posAll/item_discount", {
        order_item_uuid: "item-1", order_it_discount_type: "PCT", order_it_discount_value: 10,
      }),
    ]);

    const line = cart.orders[0].items[0];
    expect(line.detail.order_it_note).toBe("ບໍ່ເອົາຜັກ");
    expect(line.total).toBe(36000);
    expect(cart.orders[0].totals.order_item_discount_amount).toBe(4000);
  });

  it("does not resurrect a deleted line when a later edit replays", () => {
    const cart = cartFrom([
      createOrder([item("item-1", 2)]),
      queued("delete", "/api/v1/posAll/delete_order_item", { order_item_uuid: "item-1" }),
      queued("patch", "/api/v1/posAll/order_item/update_qty", {
        order_item_uuid: "item-1", change_type: "INCREASE", change_qty: 5,
      }),
    ]);

    expect(cart.orders[0].items).toHaveLength(0);
    expect(cart.orders[0].totals.order_grand_total).toBe(0);
  });

  it("cancels only the requested quantity and keeps the rest sellable", () => {
    const cart = cartFrom([
      createOrder([item("item-1", 5)]),
      queued("patch", "/api/v1/posAll/cancel_order_item", {
        order_it_uuid: "item-1", order_it_qty: 2,
      }),
    ]);

    expect(cart.orders[0].items[0].qty).toBe(3);
    expect(cart.orders[0].totals.order_grand_total).toBe(60000);
  });

  it("never moves an item status backwards", () => {
    const state = stateFrom([
      createOrder([item("item-1", 1), item("item-2", 1)]),
      queued("patch", "/api/v1/posAll/confirm_to_kitchen", {
        order_uuid: ORDER, order_item_uuids: ["item-1", "item-2"],
      }),
      queued("patch", "/api/v1/posAll/confirm_order_item_served", {
        order_item_uuids: ["item-1"],
      }),
      // A replayed kitchen confirm must not drag the served line back.
      queued("patch", "/api/v1/posAll/confirm_to_kitchen", {
        order_uuid: ORDER, order_item_uuids: ["item-1", "item-2"],
      }),
    ]);

    expect(state.items.get("item-1")?.status).toBe(OFFLINE_ITEM_STATUS.SERVED);
    expect(state.items.get("item-2")?.status).toBe(OFFLINE_ITEM_STATUS.SENT_TO_KITCHEN);
  });

  it("closes the bill on payment and refuses later edits to it", () => {
    const entries = [
      createOrder([item("item-1", 1)]),
      queued("post", "/api/v1/posAll/payment", { order_uuid: ORDER, payment_method: 1 }),
      queued("patch", "/api/v1/posAll/order_item/update_qty", {
        order_item_uuid: "item-1", change_type: "INCREASE", change_qty: 5,
      }),
    ];
    const state = stateFrom(entries);

    expect(state.orders.get(ORDER)?.checkBill).toBe(2);
    expect(state.items.get("item-1")?.quantity).toBe(1);
    // The table is free again, so the next sale opens its own bill.
    expect(openOrderForTable(state, TABLE)).toBeNull();
    expect(projectOfflineCart(state, { table_uuid: TABLE }, master).orders).toHaveLength(0);
  });

  it("a replayed create cannot reopen a paid bill", () => {
    const state = stateFrom([
      createOrder([item("item-1", 1)]),
      queued("post", "/api/v1/posAll/payment", { order_uuid: ORDER, payment_method: 1 }),
      createOrder([item("item-9", 4)]),
    ]);

    expect(state.orders.get(ORDER)?.checkBill).toBe(2);
    expect(state.items.has("item-9")).toBe(false);
  });

  it("ignores routes that are not order mutations", () => {
    expect(decodeOfflineOrderEvents([
      queued("get", "/api/v1/posAll/fetch_table", {}),
      queued("post", "/api/v1/printer/jobs/ack", { print_job_uuid: "x" }),
    ])).toEqual([]);
  });
});

describe("offline cart money", () => {
  // `queued` allocates an increasing sequence, and arguments evaluate before the
  // call — so later entries must be built inside, or they sort before the create.
  function totalsWith(
    overrides: Record<string, unknown>,
    extra: () => BrowserSyncQueueEntry[] = () => [],
  ) {
    const create = createOrder([item("item-1", 2)], overrides);
    return cartFrom([create, ...extra()]).orders[0].totals;
  }

  it("adds service charge before VAT", () => {
    // 40,000 + 10% service = 44,000; 10% VAT = 4,400, rounded to 4,000 by the
    // shared LAK rule (nearest 1,000) that Backend, Agent and web all apply.
    const totals = totalsWith({ order_service_rate: 10, order_vat_rate: 10, order_vat_status: 3 });
    expect(totals.order_service_amount).toBe(4000);
    expect(totals.order_amount_before_vat).toBe(44000);
    expect(totals.order_vat_amount).toBe(4000);
    expect(totals.order_grand_total).toBe(48000);
  });

  it("treats a VAT-included price as already containing the tax", () => {
    const totals = totalsWith({ order_vat_rate: 10, order_vat_status: 2 });
    expect(totals.order_grand_total).toBe(40000);
    expect(totals.order_amount_before_vat + totals.order_vat_amount).toBe(40000);
  });

  it("charges no VAT for an exempt bill", () => {
    const totals = totalsWith({ order_vat_rate: 10, order_vat_status: 1 });
    expect(totals.order_vat_amount).toBe(0);
    expect(totals.order_grand_total).toBe(40000);
  });

  it("applies the bill discount after item discounts and before service and VAT", () => {
    const totals = totalsWith(
      { order_service_rate: 10, order_vat_rate: 10, order_vat_status: 3 },
      () => [queued("patch", "/api/v1/posAll/bill_discount", {
        order_uuid: ORDER, order_discount_type: "AMT", order_discount_value: 10000,
      })],
    );
    // 40,000 - 10,000 = 30,000; +10% service = 33,000; 10% VAT = 3,300 -> 3,000
    expect(totals.order_discount_amount).toBe(10000);
    expect(totals.order_subtotal).toBe(30000);
    expect(totals.order_service_amount).toBe(3000);
    expect(totals.order_grand_total).toBe(36000);
  });

  it("prices a topping into the unit price", () => {
    const cart = cartFrom([createOrder([item("item-1", 2, {
      toppings: [{ prod_topping_uuid_fk: "top-1", topping_qty: 1, topping_price: 5000 }],
    })])]);

    expect(cart.orders[0].items[0].detail.unit_price).toBe(25000);
    expect(cart.orders[0].totals.order_grand_total).toBe(50000);
  });

  it("rounds money with the shared LAK rule, not its own", () => {
    // 40,000 less 7% = 2,800 discount, rounded to 3,000 by the shared rule.
    // A projection that rounded differently would hand the cashier a total the
    // Backend will not agree with once the bill syncs.
    const totals = totalsWith({}, () => [queued("patch", "/api/v1/posAll/bill_discount", {
      order_uuid: ORDER, order_discount_type: "PCT", order_discount_value: 7,
    })]);
    expect(totals.order_discount_amount).toBe(3000);
    expect(totals.order_grand_total).toBe(37000);
  });

  it("returns an empty cart for a table with no open bill", () => {
    const cart = projectOfflineCart(stateFrom([]), { table_uuid: TABLE }, master);
    expect(cart).toMatchObject({ status: "success", offline: true, orders: [], data: [] });
  });
});
