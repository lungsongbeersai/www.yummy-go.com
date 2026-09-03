import { OFFLINE_ITEM_STATUS, type OfflineOrderState, type OfflineTopping } from "./types";
import { emptyOfflineOrderState } from "./order-state";

// The last cart the Backend sent for a table is the base the offline outbox is
// applied on top of. Without it, a bill opened while online could not be added
// to, edited or paid once the connection drops — the device would only know
// about orders it created itself.
//
// This is the merge the offline contract asks for: server data seeds, queued
// local events win on top, and neither replaces the other wholesale.

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function count(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function seedToppings(value: unknown): OfflineTopping[] {
  return list(value).map((raw) => {
    const topping = record(raw);
    return {
      prod_topping_uuid_fk:
        text(topping.prod_topping_uuid_fk) || text(topping.prod_topping_uuid),
      topping_qty: count(topping.topping_total_qty, count(topping.topping_qty, 1)),
      topping_price: count(topping.topping_price),
    };
  });
}

/**
 * Rebuild local state from a cached `GET /api/v1/posAll/fetch_cart` response.
 * Both the cashier route and the Agent's mirror emit the same envelope, so this
 * accepts either.
 */
export function seedOfflineStateFromCart(response: unknown): OfflineOrderState {
  const state = emptyOfflineOrderState();
  const body = record(response);
  const orders = list(body.orders).length ? list(body.orders) : list(body.data);

  orders.forEach((rawOrder, orderIndex) => {
    const order = record(rawOrder);
    const orderUuid = text(order.order_uuid);
    if (!orderUuid) return;
    state.orders.set(orderUuid, {
      orderUuid,
      tableUuid: text(order.table_uuid_fk) || text(order.table_uuid) || null,
      branchUuid: text(order.branch_uuid_fk) || text(body.branch_uuid_fk),
      checkBill: 1,
      discountType: text(order.order_discount_type).toUpperCase(),
      discountValue: count(order.order_discount_value),
      serviceRate: count(order.order_service_rate),
      vatRate: count(order.order_vat_rate),
      vatStatus: order.order_vat_status === undefined ? null : count(order.order_vat_status),
      // Seeded orders sort before anything opened offline afterwards.
      sequence: -1_000_000 + orderIndex,
    });

    list(order.items).forEach((rawItem, itemIndex) => {
      const item = record(rawItem);
      const detail = record(item.detail);
      const orderItemUuid = text(item.order_it_uuid) || text(item.order_item_uuid);
      const prodDetailUuid = text(item.pro_detail_uuid) || text(item.prod_detail_uuid);
      if (!orderItemUuid) return;
      const status = count(detail.order_it_status, OFFLINE_ITEM_STATUS.WAITING);
      if (status === OFFLINE_ITEM_STATUS.CANCELLED) return;
      state.items.set(orderItemUuid, {
        orderItemUuid,
        orderUuid,
        prodDetailUuid,
        quantity: count(detail.order_it_qty, count(item.qty)),
        status,
        note: text(detail.order_it_note),
        discountType: text(detail.order_it_discount_type).toUpperCase(),
        discountValue: count(detail.order_it_discount_value),
        toppings: seedToppings(item.toppings),
        sequence: -1_000_000 + orderIndex * 1000 + itemIndex,
      });
    });
  });

  return state;
}
