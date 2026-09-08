import { TableStatus } from "@/config/pos-constants";
import { openOrderForTable, visibleItemsForOrder } from "./order-state";
import { OFFLINE_ITEM_STATUS, type OfflineOrderState } from "./types";

// The offline table grid overlays local order state on the last `fetch_table`
// response rather than rebuilding it. Zone names, table names, seat counts and
// the active language are exactly what the Backend rendered; only the parts the
// offline outbox actually changed are rewritten. Rebuilding the grid locally
// would mean re-deriving all of that from cached master data and getting the
// language wrong the moment a cashier switches it.

const CUSTOMER_CART_PENDING_ITEM_STATUS = 0;

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

function colorsFor(status: number) {
  return {
    bg_color: status === TableStatus.OCCUPIED
      ? "#fdebd0"
      : status === TableStatus.CASHIER_CREATING_ORDER ? "#ffd1d1" : "#ffffff",
    text_color: status === TableStatus.CASHIER_CREATING_ORDER ? "white" : "black",
  };
}

function statusForOpenOrder(currentStatus: number, itemStatuses: number[]) {
  // Backend preserves explicit waiter/check-bill alerts while order items
  // change. The offline projection must do the same or switching transport
  // silently clears the purple/teal table state.
  if (
    currentStatus === TableStatus.CALL_STAFF ||
    currentStatus === TableStatus.AWAITING_PAYMENT
  ) {
    return currentStatus;
  }
  if (itemStatuses.some((status) => status === CUSTOMER_CART_PENDING_ITEM_STATUS)) {
    return TableStatus.AWAITING_CONFIRM;
  }
  if (itemStatuses.some((status) => status === OFFLINE_ITEM_STATUS.WAITING)) {
    return TableStatus.CASHIER_CREATING_ORDER;
  }
  if (itemStatuses.length) return TableStatus.OCCUPIED;
  return TableStatus.AVAILABLE;
}

/**
 * Overlay offline order state on a cached `GET /api/v1/posAll/fetch_table`
 * response. An open local bill derives the same table workflow status used by
 * the Backend; one whose bill was paid offline goes back to available even
 * though the cached response still showed it taken.
 */
export function projectOfflineTables(
  cachedResponse: unknown,
  state: OfflineOrderState,
): unknown {
  const body = record(cachedResponse);
  if (!list(body.data).length) return cachedResponse;

  const paidOffline = new Set(
    [...state.orders.values()]
      .filter((order) => order.checkBill !== 1 && order.tableUuid)
      .map((order) => String(order.tableUuid)),
  );

  return {
    ...body,
    offline: true,
    data: list(body.data).map((rawZone) => {
      const zone = record(rawZone);
      return {
        ...zone,
        tables: list(zone.tables).map((rawTable) => {
          const table = record(rawTable);
          const tableUuid = text(table.table_uuid);
          const openOrder = tableUuid ? openOrderForTable(state, tableUuid) : null;

          if (openOrder) {
            const items = visibleItemsForOrder(state, openOrder.orderUuid);
            const next = statusForOpenOrder(
              Number(table.table_status ?? TableStatus.AVAILABLE),
              items.map((item) => Number(item.status)),
            );
            return {
              ...table,
              table_status: next,
              // Mobile offline writes are cashier writes. Do not turn every
              // status-1 cashier item into the red customer-order alert; that
              // flag is independent and remains whatever fetch_table reported.
              customer_order_state:
                next === TableStatus.AVAILABLE
                  ? false
                  : Boolean(table.customer_order_state),
              ...(next === TableStatus.AVAILABLE
                ? {
                    table_date_in: null,
                    table_time_in: null,
                    opened_at: null,
                    datetime_in: null,
                    open_minutes: null,
                  }
                : {}),
              ...colorsFor(next),
            };
          }

          if (tableUuid && paidOffline.has(tableUuid)) {
            return {
              ...table,
              table_status: TableStatus.AVAILABLE,
              table_date_in: null,
              table_time_in: null,
              opened_at: null,
              datetime_in: null,
              open_minutes: null,
              customer_order_state: false,
              ...colorsFor(TableStatus.AVAILABLE),
            };
          }

          return table;
        }),
      };
    }),
  };
}
