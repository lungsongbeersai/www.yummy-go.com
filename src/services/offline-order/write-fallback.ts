import type { HttpMethod, RequestOptions } from "@/lib/api";
import {
  listBrowserApiCacheResponses,
  listBrowserSyncQueue,
  stageBrowserSyncRequest,
  type BrowserOfflineIdentity,
  type BrowserOfflineScope,
  type BrowserOfflineStore,
} from "@/services/offline-db";
import { buildOfflineMasterIndex } from "./master-index";
import { decodeOfflineOrderEvent, decodeOfflineOrderEvents } from "./order-events";
import { emptyOfflineOrderState, reduceOfflineOrderEvents } from "./order-state";
import { projectOfflineCart } from "./cart-projection";
import { seedOfflineStateFromCart } from "./cart-seed";
import type { OfflineOrderState } from "./types";

// Android has no Local Agent to hand a write to, so this is what
// `requestLocalFallback` is for every other platform: the thing `apiRequest`
// (src/lib/api.ts) calls instead of throwing when a mutation on one of the 10
// order-lifecycle routes fails at the transport layer. Unlike the Agent, there
// is no separate process with its own database to ask — the "response" is
// computed inline, in the browser, from the same Dexie outbox the read side
// (readBrowserOfflineCache) already replays.

const FETCH_CART_PATH = "/api/v1/posAll/fetch_cart";
const FETCH_CATE_PRODUCTS_PATH = "/api/v1/posAll/fetch_cate_products";
const GET_PROD_ITEM_PATH = "/api/v1/posAll/get_prod_item";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Every staged mutation for the scope, reduced on top of every cached
 * fetch_cart response — the one piece of local order state both the write
 * fallback (a cart-shaped response for the mutation just made) and the read
 * overlay (folding staged writes onto a cached fetch_cart/fetch_table GET)
 * need in common.
 */
export async function loadOfflineOrderState(
  scope: BrowserOfflineScope,
  store?: BrowserOfflineStore,
): Promise<OfflineOrderState> {
  // Every fetch_cart response this device has ever cached for the branch,
  // merged. Each is keyed by order/item uuid, so replaying several is safe —
  // it is the same merge cart-seed.ts already does for one response, just
  // over every cached order/table instead of guessing which one this
  // mutation's own payload belongs to (most only carry order_item_uuid).
  const cachedCarts = await listBrowserApiCacheResponses(scope, FETCH_CART_PATH, store);
  let state = cachedCarts.reduce<OfflineOrderState>((base, cached) => {
    const seeded = seedOfflineStateFromCart(cached);
    return {
      orders: new Map([...base.orders, ...seeded.orders]),
      items: new Map([...base.items, ...seeded.items]),
    };
  }, emptyOfflineOrderState());

  const queued = await listBrowserSyncQueue(scope, store);
  state = reduceOfflineOrderEvents(decodeOfflineOrderEvents(queued), state);
  return state;
}

export async function loadOfflineMasterIndex(scope: BrowserOfflineScope, store?: BrowserOfflineStore) {
  const [categoryResponses, productItemResponses, cartResponses] = await Promise.all([
    listBrowserApiCacheResponses(scope, FETCH_CATE_PRODUCTS_PATH, store),
    listBrowserApiCacheResponses(scope, GET_PROD_ITEM_PATH, store),
    listBrowserApiCacheResponses(scope, FETCH_CART_PATH, store),
  ]);
  return buildOfflineMasterIndex([
    ...categoryResponses.map((response) => ({ path: FETCH_CATE_PRODUCTS_PATH, response })),
    ...productItemResponses.map((response) => ({ path: GET_PROD_ITEM_PATH, response })),
    // Last on purpose: a long-open table's history can include products whose
    // fetch_cate_products entry has since aged out of the cache, or that were
    // never re-viewed this session — a real order line's own name/image/price
    // (indexCartItems, master-index.ts) is the only remaining source for those,
    // and must not be left blank just because the menu cache moved on.
    ...cartResponses.map((response) => ({ path: FETCH_CART_PATH, response })),
  ]);
}

/**
 * Which order this mutation affects, once its own event is folded into state.
 *
 * Item lookups are checked before `data.order_uuid` on purpose: create_order
 * never carries a real order_uuid for a table order (the Backend finds-or-
 * creates by table_uuid_fk), so prepareOfflineRequest stamps a fresh random
 * one just to give the event a stable id. order-state.ts's ORDER_CREATE
 * handler already retargets that event's items onto a table's already-open
 * order when one exists — so for create_order specifically, `data.order_uuid`
 * itself can be a discarded, never-used uuid, and only the items it carries
 * point at where they actually landed. Every other mutation kind's
 * `order_uuid` is one the UI already read back from a real prior state, so
 * it stays a valid answer whenever no item resolves (e.g. bill_discount,
 * which carries no item reference at all).
 *
 * Exported because `pushBrowserSyncQueue` (offline-sync.ts) needs the exact
 * same resolution for the opposite reason: a create_order event's *own*
 * stamped order_uuid is exactly what must NOT be sent to the Backend as-is
 * once it has been retargeted onto a table's already-open order — the
 * Backend's offline-sync path (api/v1/posAll/create.js) rejects a create
 * whose order_uuid disagrees with the table's real open order.
 */
export function resolveOrderUuid(
  state: OfflineOrderState,
  data: Record<string, unknown>,
): string | null {
  const items = Array.isArray(data.items) ? data.items : [];
  for (const raw of items) {
    const item = record(raw);
    const uuid = String(item.order_it_uuid || item.order_item_uuid || "");
    if (!uuid) continue;
    const found = state.items.get(uuid)?.orderUuid;
    if (found) return found;
  }
  const itemUuid = String(data.order_item_uuid || data.order_it_uuid || "");
  if (itemUuid) {
    const found = state.items.get(itemUuid)?.orderUuid;
    if (found) return found;
  }
  const itemUuids = Array.isArray(data.order_item_uuids) ? data.order_item_uuids : [];
  for (const raw of itemUuids) {
    const found = state.items.get(String(raw))?.orderUuid;
    if (found) return found;
  }
  const direct = data.order_uuid;
  if (typeof direct === "string" && direct) return direct;
  return null;
}

/**
 * Stages `method`/`url` as a durable offline mutation and returns the same
 * shape `GET fetch_cart` would — every mutation route folds back into "here
 * is the cart now", which is what every caller already re-fetches for online
 * anyway (see the resulting-state assumption in cart-projection.ts).
 *
 * Throws `BROWSER_SYNC_EVENT_PAYLOAD_MISMATCH` (from `stageBrowserSyncRequest`)
 * unchanged — that means this event_uuid was already used for a different
 * request, a bug rather than a retry, and must surface rather than silently
 * apply the wrong mutation.
 */
export async function synthesizeOfflineWrite(
  method: HttpMethod,
  url: string,
  options: RequestOptions | undefined,
  eventUuid: string,
  scope: BrowserOfflineIdentity,
  store?: BrowserOfflineStore,
): Promise<unknown | null> {
  const path = url.split("?")[0];
  const data = record(options?.data);
  const event = decodeOfflineOrderEvent({ method, path, data });
  if (!event) return null;

  await stageBrowserSyncRequest(
    {
      eventUuid,
      storeUuid: scope.storeUuid,
      branchUuid: scope.branchUuid,
      actorLoginUuid: scope.actorLoginUuid,
      method,
      path,
      params: options?.params ?? {},
      data,
    },
    store,
  );

  const [state, master] = await Promise.all([
    loadOfflineOrderState(scope, store),
    loadOfflineMasterIndex(scope, store),
  ]);

  const orderUuid = resolveOrderUuid(state, data);
  return projectOfflineCart(state, orderUuid ? { order_uuid: orderUuid } : {}, master);
}
