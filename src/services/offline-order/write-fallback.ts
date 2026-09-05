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
  const [categoryResponses, productItemResponses] = await Promise.all([
    listBrowserApiCacheResponses(scope, FETCH_CATE_PRODUCTS_PATH, store),
    listBrowserApiCacheResponses(scope, GET_PROD_ITEM_PATH, store),
  ]);
  return buildOfflineMasterIndex([
    ...categoryResponses.map((response) => ({ path: FETCH_CATE_PRODUCTS_PATH, response })),
    ...productItemResponses.map((response) => ({ path: GET_PROD_ITEM_PATH, response })),
  ]);
}

/** Which order this mutation affects, once its own event is folded into state. */
function resolveOrderUuid(
  state: OfflineOrderState,
  data: Record<string, unknown>,
): string | null {
  const direct = data.order_uuid;
  if (typeof direct === "string" && direct) return direct;
  const itemUuid = String(data.order_item_uuid || data.order_it_uuid || "");
  if (itemUuid) return state.items.get(itemUuid)?.orderUuid ?? null;
  const itemUuids = Array.isArray(data.order_item_uuids) ? data.order_item_uuids : [];
  for (const raw of itemUuids) {
    const found = state.items.get(String(raw))?.orderUuid;
    if (found) return found;
  }
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
