import {
  OFFLINE_ITEM_STATUS,
  type OfflineOrder,
  type OfflineOrderEvent,
  type OfflineOrderItem,
  type OfflineOrderState,
} from "./types";

// Applying the outbox in order. Every rule here mirrors the Local Printer
// Agent's SQLite behaviour so a device with an Agent and a device without one
// show the same cart: status only moves forward, a cancelled or deleted line
// never comes back, and a closed bill stops accepting changes.

export function emptyOfflineOrderState(): OfflineOrderState {
  return { orders: new Map(), items: new Map() };
}

function openOrder(state: OfflineOrderState, orderUuid: string) {
  const order = state.orders.get(orderUuid);
  return order && order.checkBill === 1 ? order : null;
}

function itemFor(state: OfflineOrderState, orderItemUuid: string) {
  const item = state.items.get(orderItemUuid);
  if (!item) return null;
  // A cancelled line is a tombstone: later edits must not resurrect it.
  if (item.status === OFFLINE_ITEM_STATUS.CANCELLED) return null;
  return openOrder(state, item.orderUuid) ? item : null;
}

function applyEvent(state: OfflineOrderState, event: OfflineOrderEvent, sequence: number) {
  switch (event.kind) {
    case "ORDER_CREATE": {
      // The real create_order payload never carries order_uuid for a table
      // order (staff-order-payload.ts's buildStaffOrderInput omits it on
      // purpose — the Backend finds-or-creates the table's open order
      // itself); prepareOfflineRequest stamps a fresh random one purely so
      // the staged event has a stable id. Left as event.orderUuid, every
      // "add item" call would decode as its own brand-new order, and
      // openOrderForTable (one order per table, most recent wins) would
      // show only the latest item — hiding a table's existing items,
      // online-seeded or already added offline, behind it. Reuse the
      // table's already-open order instead, exactly like the Backend does.
      const openForTable = event.tableUuid
        ? [...state.orders.values()].find(
            (order) => order.checkBill === 1 && order.tableUuid === event.tableUuid,
          )
        : undefined;
      const orderUuid = openForTable?.orderUuid ?? event.orderUuid;
      const existing = state.orders.get(orderUuid);
      if (!existing) {
        const order: OfflineOrder = {
          orderUuid,
          tableUuid: event.tableUuid,
          branchUuid: event.branchUuid,
          checkBill: 1,
          discountType: "",
          discountValue: 0,
          serviceRate: event.serviceRate,
          vatRate: event.vatRate,
          vatStatus: event.vatStatus,
          sequence,
        };
        state.orders.set(order.orderUuid, order);
      } else if (existing.checkBill !== 1) {
        // The bill was already paid; a replayed create must not reopen it.
        return;
      } else {
        // A bill seeded from a cached cart may predate the rates the Backend now
        // returns. The next round carries them, so adopt them rather than pricing
        // later items with no VAT or service charge.
        state.orders.set(existing.orderUuid, {
          ...existing,
          serviceRate: existing.serviceRate || event.serviceRate,
          vatRate: existing.vatRate || event.vatRate,
          vatStatus: existing.vatStatus ?? event.vatStatus,
          tableUuid: existing.tableUuid ?? event.tableUuid,
        });
      }
      event.items.forEach((item, index) => {
        if (state.items.has(item.orderItemUuid)) return;
        state.items.set(item.orderItemUuid, {
          orderItemUuid: item.orderItemUuid,
          orderUuid,
          prodDetailUuid: item.prodDetailUuid,
          quantity: item.quantity,
          status: item.status,
          note: item.note,
          discountType: "",
          discountValue: 0,
          toppings: item.toppings,
          sequence: sequence * 1000 + index,
        });
      });
      return;
    }

    case "ITEM_QTY": {
      const item = itemFor(state, event.orderItemUuid);
      if (!item) return;
      const delta = event.changeType === "DECREASE" ? -event.changeQty : event.changeQty;
      const quantity = Math.max(0, item.quantity + delta);
      state.items.set(item.orderItemUuid, { ...item, quantity });
      return;
    }

    case "ITEM_NOTE": {
      const item = itemFor(state, event.orderItemUuid);
      if (!item) return;
      state.items.set(item.orderItemUuid, { ...item, note: event.note });
      return;
    }

    case "ITEM_DISCOUNT": {
      const item = itemFor(state, event.orderItemUuid);
      if (!item) return;
      state.items.set(item.orderItemUuid, {
        ...item,
        discountType: event.discountType,
        discountValue: event.discountValue,
      });
      return;
    }

    case "BILL_DISCOUNT": {
      const order = openOrder(state, event.orderUuid);
      if (!order) return;
      state.orders.set(order.orderUuid, {
        ...order,
        discountType: event.discountType,
        discountValue: event.discountValue,
      });
      return;
    }

    case "ITEM_DELETE": {
      const item = itemFor(state, event.orderItemUuid);
      if (!item) return;
      // Delete wins, and stays won: keep the tombstone so a replay cannot revive it.
      state.items.set(item.orderItemUuid, {
        ...item,
        status: OFFLINE_ITEM_STATUS.CANCELLED,
        quantity: 0,
      });
      return;
    }

    case "ITEM_CANCEL": {
      const item = itemFor(state, event.orderItemUuid);
      if (!item) return;
      const cancelled = event.quantity === null ? item.quantity : Math.max(0, event.quantity);
      const remaining = Math.max(0, item.quantity - cancelled);
      state.items.set(item.orderItemUuid, remaining > 0
        ? { ...item, quantity: remaining }
        : { ...item, quantity: 0, status: OFFLINE_ITEM_STATUS.CANCELLED });
      return;
    }

    case "KITCHEN_CONFIRM": {
      const order = openOrder(state, event.orderUuid);
      if (!order) return;
      const targets = event.orderItemUuids.length
        ? event.orderItemUuids
        : [...state.items.values()]
          .filter((item) => item.orderUuid === order.orderUuid)
          .map((item) => item.orderItemUuid);
      for (const orderItemUuid of targets) {
        const item = itemFor(state, orderItemUuid);
        // Status never moves backwards: an item already served stays served.
        if (!item || item.status >= OFFLINE_ITEM_STATUS.SENT_TO_KITCHEN) continue;
        state.items.set(orderItemUuid, { ...item, status: OFFLINE_ITEM_STATUS.SENT_TO_KITCHEN });
      }
      return;
    }

    case "ITEM_SERVED": {
      for (const orderItemUuid of event.orderItemUuids) {
        const item = itemFor(state, orderItemUuid);
        if (!item || item.status >= OFFLINE_ITEM_STATUS.SERVED) continue;
        state.items.set(orderItemUuid, { ...item, status: OFFLINE_ITEM_STATUS.SERVED });
      }
      return;
    }

    case "PAYMENT": {
      const order = openOrder(state, event.orderUuid);
      if (order) {
        state.orders.set(order.orderUuid, { ...order, checkBill: 2 });
        return;
      }
      // Paying a bill this device never saw opened: record the closure anyway so
      // the table stops reading as occupied in the offline grid.
      if (state.orders.has(event.orderUuid) || !event.tableUuid) return;
      state.orders.set(event.orderUuid, {
        orderUuid: event.orderUuid,
        tableUuid: event.tableUuid,
        branchUuid: "",
        checkBill: 2,
        discountType: "",
        discountValue: 0,
        serviceRate: 0,
        vatRate: 0,
        vatStatus: null,
        sequence,
      });
    }
  }
}

export function reduceOfflineOrderEvents(
  events: OfflineOrderEvent[],
  base: OfflineOrderState = emptyOfflineOrderState(),
): OfflineOrderState {
  const state: OfflineOrderState = {
    orders: new Map(base.orders),
    items: new Map(base.items),
  };
  events.forEach((event, index) => applyEvent(state, event, index + 1));
  return state;
}

/** The open bill for a table, or null when the table is free. */
export function openOrderForTable(state: OfflineOrderState, tableUuid: string) {
  const candidates = [...state.orders.values()]
    .filter((order) => order.checkBill === 1 && order.tableUuid === tableUuid)
    .sort((left, right) => right.sequence - left.sequence);
  return candidates[0] ?? null;
}

/** Cart lines for an order, cancelled ones excluded, in the order they were added. */
export function visibleItemsForOrder(state: OfflineOrderState, orderUuid: string): OfflineOrderItem[] {
  return [...state.items.values()]
    .filter((item) =>
      item.orderUuid === orderUuid &&
      item.status !== OFFLINE_ITEM_STATUS.CANCELLED &&
      item.quantity > 0)
    .sort((left, right) => left.sequence - right.sequence);
}
