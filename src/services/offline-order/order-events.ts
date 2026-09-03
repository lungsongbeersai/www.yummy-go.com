import type { BrowserSyncQueueEntry } from "@/services/offline-db";
import {
  OFFLINE_ITEM_STATUS,
  type OfflineOrderEvent,
  type OfflineTopping,
} from "./types";

// Decoding the outbox, not re-deciding business rules. Each queued entry is the
// exact HTTP request the POS already builds, so the payload keys here must match
// the input types in `src/services/pos/types.ts` — that file is the contract.

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function count(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toppings(value: unknown): OfflineTopping[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const topping = record(raw);
    return {
      prod_topping_uuid_fk: text(topping.prod_topping_uuid_fk),
      topping_qty: count(topping.topping_qty, 1),
      topping_price: count(topping.topping_price, 0),
    };
  });
}

function uuidList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

/**
 * `order_it_uuid` and `order_item_uuid` both appear across the POS routes.
 * prepareOfflineRequest stamps `order_it_uuid` on create; the mutation routes
 * mostly send `order_item_uuid`. Read either rather than guessing per route.
 */
function itemUuid(data: Record<string, unknown>) {
  return text(data.order_item_uuid) || text(data.order_it_uuid);
}

export function decodeOfflineOrderEvent(
  entry: Pick<BrowserSyncQueueEntry, "method" | "path" | "data">,
): OfflineOrderEvent | null {
  const data = record(entry.data);
  const route = `${entry.method.toUpperCase()} ${entry.path}`;

  switch (route) {
    case "POST /api/v1/posAll/create_order": {
      const orderUuid = text(data.order_uuid);
      if (!orderUuid) return null;
      const rawItems = Array.isArray(data.items) ? data.items : [];
      return {
        kind: "ORDER_CREATE",
        orderUuid,
        tableUuid: text(data.table_uuid_fk) || text(data.table_uuid) || null,
        branchUuid: text(data.branch_uuid_fk),
        serviceRate: count(data.order_service_rate),
        vatRate: count(data.order_vat_rate),
        vatStatus: data.order_vat_status === undefined ? null : count(data.order_vat_status),
        items: rawItems.map((raw) => {
          const item = record(raw);
          return {
            orderItemUuid: text(item.order_it_uuid) || text(item.order_item_uuid),
            prodDetailUuid: text(item.prod_detail_uuid_fk) || text(item.pro_detail_uuid_fk),
            quantity: count(item.order_it_qty, count(item.qty, 0)),
            status: count(item.order_it_status, OFFLINE_ITEM_STATUS.WAITING),
            note: text(item.order_it_note),
            toppings: toppings(item.toppings),
          };
        }).filter((item) => item.orderItemUuid && item.prodDetailUuid),
      };
    }

    case "PATCH /api/v1/posAll/order_item/update_qty": {
      const orderItemUuid = itemUuid(data);
      if (!orderItemUuid) return null;
      return {
        kind: "ITEM_QTY",
        orderItemUuid,
        changeType: text(data.change_type, "INCREASE").toUpperCase(),
        changeQty: count(data.change_qty),
      };
    }

    case "PATCH /api/v1/posAll/update_note": {
      const orderItemUuid = itemUuid(data);
      if (!orderItemUuid) return null;
      return { kind: "ITEM_NOTE", orderItemUuid, note: text(data.order_it_note) };
    }

    case "PATCH /api/v1/posAll/item_discount": {
      const orderItemUuid = itemUuid(data);
      if (!orderItemUuid) return null;
      return {
        kind: "ITEM_DISCOUNT",
        orderItemUuid,
        discountType: text(data.order_it_discount_type).toUpperCase(),
        discountValue: count(data.order_it_discount_value),
      };
    }

    case "PATCH /api/v1/posAll/bill_discount": {
      const orderUuid = text(data.order_uuid);
      if (!orderUuid) return null;
      return {
        kind: "BILL_DISCOUNT",
        orderUuid,
        discountType: text(data.order_discount_type).toUpperCase(),
        discountValue: count(data.order_discount_value),
      };
    }

    case "DELETE /api/v1/posAll/delete_order_item": {
      const orderItemUuid = itemUuid(data);
      if (!orderItemUuid) return null;
      return { kind: "ITEM_DELETE", orderItemUuid };
    }

    case "PATCH /api/v1/posAll/cancel_order_item": {
      const orderItemUuid = itemUuid(data);
      if (!orderItemUuid) return null;
      // No quantity means cancel the whole line, matching the Backend route.
      const quantity = data.order_it_qty === undefined ? null : count(data.order_it_qty);
      return { kind: "ITEM_CANCEL", orderItemUuid, quantity };
    }

    case "PATCH /api/v1/posAll/confirm_to_kitchen": {
      const orderUuid = text(data.order_uuid);
      if (!orderUuid) return null;
      return {
        kind: "KITCHEN_CONFIRM",
        orderUuid,
        orderItemUuids: uuidList(data.order_item_uuids),
      };
    }

    case "PATCH /api/v1/posAll/confirm_order_item_served": {
      const list = uuidList(data.order_item_uuids);
      const single = itemUuid(data);
      const orderItemUuids = list.length ? list : (single ? [single] : []);
      if (!orderItemUuids.length) return null;
      return { kind: "ITEM_SERVED", orderItemUuids };
    }

    case "POST /api/v1/posAll/payment": {
      const orderUuid = text(data.order_uuid);
      if (!orderUuid) return null;
      return {
        kind: "PAYMENT",
        orderUuid,
        tableUuid: text(data.table_uuid) || text(data.table_uuid_fk) || null,
      };
    }

    default:
      return null;
  }
}

/**
 * Queue entries in the order they must be applied. `createdAt` is allocated
 * strictly increasing per scope by stageBrowserSyncRequest, so it is a local
 * sequence rather than a wall clock — ties fall back to the event id so the
 * result is deterministic.
 */
export function decodeOfflineOrderEvents(entries: BrowserSyncQueueEntry[]): OfflineOrderEvent[] {
  return [...entries]
    .sort((left, right) =>
      left.createdAt - right.createdAt || left.eventUuid.localeCompare(right.eventUuid))
    .map((entry) => decodeOfflineOrderEvent(entry))
    .filter((event): event is OfflineOrderEvent => event !== null);
}
