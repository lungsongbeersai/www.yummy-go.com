import { openOrderForTable, visibleItemsForOrder } from "./order-state";
import { OFFLINE_ITEM_STATUS, type OfflineOrderState } from "./types";

// The offline table grid overlays local order state on the last `fetch_table`
// response rather than rebuilding it. Zone names, table names, seat counts and
// the active language are exactly what the Backend rendered; only the parts the
// offline outbox actually changed are rewritten. Rebuilding the grid locally
// would mean re-deriving all of that from cached master data and getting the
// language wrong the moment a cashier switches it.

const TABLE_FREE = 1;
const TABLE_OCCUPIED = 2;
const TABLE_BILL_REQUESTED = 3;

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
    bg_color: status === TABLE_OCCUPIED
      ? "#fdebd0"
      : status === TABLE_BILL_REQUESTED ? "#ffd1d1" : "#ffffff",
    text_color: status === TABLE_BILL_REQUESTED ? "white" : "black",
  };
}

/**
 * Overlay offline order state on a cached `GET /api/v1/posAll/fetch_table`
 * response. A table with an open local bill reads as occupied; one whose bill
 * was paid offline goes back to free even though the cached response still
 * showed it taken.
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
            const waiting = visibleItemsForOrder(state, openOrder.orderUuid)
              .some((item) => item.status === OFFLINE_ITEM_STATUS.WAITING);
            const status = Number(table.table_status ?? TABLE_FREE);
            // Keep a bill-requested table on its own status; opening a bill only
            // moves a free table to occupied.
            const next = status === TABLE_BILL_REQUESTED ? status : TABLE_OCCUPIED;
            return {
              ...table,
              table_status: next,
              customer_order_state: waiting,
              ...colorsFor(next),
            };
          }

          if (tableUuid && paidOffline.has(tableUuid)) {
            return {
              ...table,
              table_status: TABLE_FREE,
              table_date_in: null,
              table_time_in: null,
              opened_at: null,
              datetime_in: null,
              open_minutes: null,
              customer_order_state: false,
              ...colorsFor(TABLE_FREE),
            };
          }

          return table;
        }),
      };
    }),
  };
}
