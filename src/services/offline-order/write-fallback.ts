import type { HttpMethod, RequestOptions } from "@/lib/api";
import i18n from "@/lib/i18n";
import {
  listBrowserApiCacheResponses,
  listBrowserApiCacheEntries,
  listBrowserSyncQueue,
  stageBrowserSyncRequest,
  retainBrowserItemSnapshots,
  updateBrowserSyncEvent,
  type BrowserOfflineIdentity,
  type BrowserOfflineScope,
  type BrowserOfflineStore,
} from "@/services/offline-db";
import { mobileOfflineCheckoutEnabled } from "@/services/mobile-offline-capabilities";
import { getOfflineSyncDeviceAuth } from "./device-registration";
import { planMobileOfflinePrintJobs } from "@/services/printer/mobile-offline-queue";
import { buildOfflineMasterIndex } from "./master-index";
import { decodeOfflineOrderEvent, decodeOfflineOrderEvents } from "./order-events";
import { emptyOfflineOrderState, reduceOfflineOrderEvents } from "./order-state";
import { projectOfflineCart } from "./cart-projection";
import { seedOfflineStateFromCart } from "./cart-seed";
import type { OfflineOrderState } from "./types";

// Capacitor has no Local Agent to hand a write to, so this is what
// `requestLocalFallback` is for every other platform: the thing `apiRequest`
// (src/lib/api.ts) calls instead of throwing when a mutation on one of the 10
// order-lifecycle routes fails at the transport layer. Print-dependent
// completion is guarded below until a durable native print engine exists.
// Unlike the Agent, there
// is no separate process with its own database to ask — the "response" is
// computed inline, in the browser, from the same Dexie outbox the read side
// (readBrowserOfflineCache) already replays.

const FETCH_CART_PATH = "/api/v1/posAll/fetch_cart";
const FETCH_CATE_PRODUCTS_PATH = "/api/v1/posAll/fetch_cate_products";
const GET_PROD_ITEM_PATH = "/api/v1/posAll/get_prod_item";
const BRANCH_CONFIG_PATH = "/api/v1/branch/fetch_all";
const TABLE_CONFIG_PATH = "/api/v1/table/fetch_all";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function responseRows(value: unknown) {
  const rows = record(value).data;
  return Array.isArray(rows) ? rows.map(record) : [];
}

function resolvedBranchVatStatus(status: unknown, rate: unknown) {
  const code = Number(status);
  const numericRate = Number(rate || 0);
  const hasRate = Number.isFinite(numericRate) && numericRate > 0;
  if (code === 3) return 3;
  if (code === 2) return hasRate ? 2 : 1;
  if (code === 1) return hasRate ? 3 : 1;
  return 1;
}

/**
 * Staff order payloads deliberately send zero rates because the online
 * Backend owns pricing. A device without the Local Agent still needs the
 * latest server snapshot to render and validate a brand-new offline bill.
 * Missing branch/table policy fails closed instead of producing a zero-tax
 * receipt that the Backend would later reject.
 */
async function withPreparedOfflinePricing(
  data: Record<string, unknown>,
  scope: BrowserOfflineScope,
  store?: BrowserOfflineStore,
) {
  const [branchResponses, tableResponses] = await Promise.all([
    listBrowserApiCacheResponses(scope, BRANCH_CONFIG_PATH, store),
    listBrowserApiCacheResponses(scope, TABLE_CONFIG_PATH, store),
  ]);
  const branch = branchResponses.flatMap(responseRows).find((row) =>
    String(row.branch_uuid || "") === scope.branchUuid);
  if (!branch) throw new Error("MOBILE_OFFLINE_PRICING_NOT_PREPARED");

  const tableUuid = String(data.table_uuid_fk || data.table_uuid || "");
  const table = tableUuid
    ? tableResponses.flatMap(responseRows).find((row) => String(row.table_uuid || "") === tableUuid)
    : null;
  if (tableUuid && !table) throw new Error("MOBILE_OFFLINE_TABLE_POLICY_NOT_PREPARED");

  const vatStatus = resolvedBranchVatStatus(branch.vat_status, branch.vat_name);
  const branchChargeEnabled = Number(branch.charge_status) === 1;
  const tableChargeEnabled = !tableUuid || Number(table?.charge_status) === 1;
  return {
    ...data,
    order_vat_status: vatStatus,
    order_vat_rate: vatStatus === 1 ? 0 : Math.max(0, Number(branch.vat_name || 0)),
    order_service_rate: tableUuid && branchChargeEnabled && tableChargeEnabled
      ? Math.max(0, Number(branch.charge_name || 0))
      : 0,
  };
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
  const cachedCarts = await listBrowserApiCacheEntries(scope, FETCH_CART_PATH, store);
  const watermarks = new Map<string, number>();
  let state = cachedCarts.reduce<OfflineOrderState>((base, cached) => {
    const seeded = seedOfflineStateFromCart(cached.response);
    for (const orderUuid of seeded.orders.keys()) watermarks.set(orderUuid, cached.syncedThrough ?? 0);
    // Replacing a cart must also remove lines absent from its new snapshot.
    const retained = [...base.items].filter(([, item]) => !seeded.orders.has(item.orderUuid));
    return {
      orders: new Map([...base.orders, ...seeded.orders]),
      items: new Map([...retained, ...seeded.items]),
    };
  }, emptyOfflineOrderState());

  const queued = await listBrowserSyncQueue(scope, store);
  const remaining = queued.filter((entry) => {
    const data = record(entry.wireEvent?.payload.request.data ?? entry.data);
    const orderUuid = resolveOrderUuid(state, data);
    return entry.status !== "SYNCED" || entry.createdAt > (watermarks.get(orderUuid ?? "") ?? 0);
  }).map((entry) => ({ ...entry, data: entry.wireEvent?.payload.request.data ?? entry.data }));
  state = reduceOfflineOrderEvents(decodeOfflineOrderEvents(remaining), state);
  for (const entry of remaining) {
    for (const [uuid, snapshot] of Object.entries(entry.localItemSnapshots ?? {})) {
      const item = state.items.get(uuid);
      if (!item || item.snapshot) continue;
      const toppings = Array.isArray(snapshot.toppings) ? snapshot.toppings.map(record) : [];
      state.items.set(uuid, { ...item, snapshot, toppings: item.toppings.map((topping) => {
        const saved = toppings.find((candidate) => candidate.prod_topping_uuid_fk === topping.prod_topping_uuid_fk);
        return { ...topping,
          ...(typeof saved?.topping_price === "number" ? { topping_price: saved.topping_price } : {}),
          ...(typeof saved?.topping_name === "string" ? { topping_name: saved.topping_name } : {}),
        };
      }) });
    }
  }
  return state;
}

/** Preserve display data for pre-snapshot drafts before a background menu refresh. */
export async function retainPendingBrowserItemSnapshots(scope: BrowserOfflineScope, store?: BrowserOfflineStore) {
  const queue = (await listBrowserSyncQueue(scope, store)).filter((entry) =>
    entry.status !== "SYNCED" && entry.path === "/api/v1/posAll/create_order" && !entry.localItemSnapshots);
  if (!queue.length) return;
  const [state, master] = await Promise.all([loadOfflineOrderState(scope, store), loadOfflineMasterIndex(scope, store)]);
  for (const entry of queue) {
    const data = record(entry.wireEvent?.payload.request.data ?? entry.data);
    const uuid = resolveOrderUuid(state, data);
    if (!uuid) continue;
    try {
      const ids = new Set((Array.isArray(data.items) ? data.items : []).map((item) => String(record(item).order_it_uuid || record(item).order_item_uuid || "")));
      const cart = projectOfflineCart(state, { order_uuid: uuid }, master);
      const snapshots = Object.fromEntries(cart.orders.flatMap((order) => order.items)
        .filter((item) => ids.has(item.order_it_uuid)).map((item) => [item.order_it_uuid, { ...item }]));
      if (Object.keys(snapshots).length) await retainBrowserItemSnapshots(entry.eventUuid, scope, snapshots, store);
    } catch {
      // Unknown legacy data may be repaired by the incoming catalog. Never
      // invent a price or block all menu downloads because one old line is missing.
    }
  }
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
  let data = record(options?.data);
  let event = decodeOfflineOrderEvent({ method, path, data });
  if (!event) return null;

  const printDependent = event.kind === "KITCHEN_CONFIRM" || event.kind === "PAYMENT";
  if (printDependent && !await mobileOfflineCheckoutEnabled(scope, store)) {
    throw new Error(i18n.t("offlineSync.mobilePrintUnavailable"));
  }
  const queued = await listBrowserSyncQueue(scope, store);
  if (queued.some((entry) => entry.status !== "SYNCED" && entry.actorLoginUuid !== scope.actorLoginUuid)) {
    throw new Error(i18n.t("offlineSync.mobilePreviousCashierPending"));
  }

  // Validate the resulting cart before accepting a durable mutation. Missing
  // product data must not create an unnamed/free line that syncs later.
  const [base, master] = await Promise.all([
    loadOfflineOrderState(scope, store),
    loadOfflineMasterIndex(scope, store),
  ]);
  if (event.kind === "ORDER_CREATE") {
    const tableUuid = String(data.table_uuid_fk || data.table_uuid || "");
    const existing = [...base.orders.values()].find((order) =>
      order.checkBill === 1 && order.tableUuid === tableUuid);
    data = existing ? {
      ...data,
      order_service_rate: existing.serviceRate,
      order_vat_rate: existing.vatRate,
      order_vat_status: existing.vatStatus ?? 1,
    } : await withPreparedOfflinePricing(data, scope, store);
    event = decodeOfflineOrderEvent({ method, path, data });
    if (!event) return null;
  }
  const orderBefore = resolveOrderUuid(base, data);
  const cartBefore = orderBefore ? projectOfflineCart(base, { order_uuid: orderBefore }, master).orders[0] : null;
  if (printDependent && !cartBefore) throw new Error("MOBILE_OFFLINE_ORDER_NOT_PREPARED");

  if (event.kind === "PAYMENT" && cartBefore) {
    const due = Number(cartBefore.grand_total || 0);
    const method = Number(data.payment_method || 0);
    const cash = Number(data.cash_payment_amount || 0);
    const transfer = Number(data.transfer_payment_amount || 0);
    if (!Number.isFinite(due) || due <= 0) throw new Error("MOBILE_OFFLINE_PAYMENT_TOTAL_INVALID");
    if (![1, 2, 3, 4].includes(method)) throw new Error("MOBILE_OFFLINE_PAYMENT_METHOD_INVALID");
    if (Number(data.amount || 0) !== due) throw new Error("MOBILE_OFFLINE_PAYMENT_AMOUNT_CHANGED");
    if (method === 1 && (cash < due || transfer !== 0)) throw new Error("MOBILE_OFFLINE_CASH_PAYMENT_INVALID");
    if (method === 2 && (transfer < due || cash !== 0)) throw new Error("MOBILE_OFFLINE_TRANSFER_PAYMENT_INVALID");
    if (method === 3 && cash + transfer < due) throw new Error("MOBILE_OFFLINE_MIXED_PAYMENT_INVALID");
    if (method === 4 && (cash !== 0 || transfer !== 0 || !data.due_date)) throw new Error("MOBILE_OFFLINE_CREDIT_PAYMENT_INVALID");
  }

  const device = printDependent ? getOfflineSyncDeviceAuth() : null;
  if (printDependent && !device) throw new Error("MOBILE_OFFLINE_DEVICE_NOT_REGISTERED");
  const printJobs = printDependent && cartBefore && device &&
    (event.kind === "KITCHEN_CONFIRM" || event.kind === "PAYMENT")
    ? await planMobileOfflinePrintJobs({
      eventUuid,
      operation: event.kind,
      scope,
      data,
      order: cartBefore,
      deviceCode: device.deviceCode,
      store,
    })
    : [];
  const preview = reduceOfflineOrderEvents([event], base);
  const previewOrder = resolveOrderUuid(preview, data);
  const cartPreview = previewOrder ? projectOfflineCart(preview, { order_uuid: previewOrder }, master) : null;
  const createdIds = new Set(event.kind === "ORDER_CREATE" ? event.items.map((item) => item.orderItemUuid) : []);
  const localItemSnapshots = Object.fromEntries((cartPreview?.orders ?? []).flatMap((order) => order.items)
    .filter((item) => createdIds.has(item.order_it_uuid)).map((item) => [item.order_it_uuid, { ...item }]));

  const staged = await stageBrowserSyncRequest(
    {
      eventUuid,
      storeUuid: scope.storeUuid,
      branchUuid: scope.branchUuid,
      actorLoginUuid: scope.actorLoginUuid,
      requireExclusiveActor: true,
      method,
      path,
      params: options?.params ?? {},
      data,
      ...(createdIds.size ? { localItemSnapshots } : {}),
      ...(printDependent ? { printJobs } : {}),
      ...(printDependent ? { printContractVersion: "offline-first-v2" as const } : {}),
    },
    store,
  );
  if (!staged) throw new Error(i18n.t("offlineSync.mobileStorageUnavailable"));

  // Receipt ownership is proven by the durable queue itself. Kitchen work is
  // held until every required printer reports PRINTED; no-printer routing can
  // proceed immediately and is proved explicitly during push.
  if (event.kind === "PAYMENT" || (event.kind === "KITCHEN_CONFIRM" && !printJobs.length)) {
    await updateBrowserSyncEvent(eventUuid, { status: "PENDING", lastError: null }, store);
  }

  const state = await loadOfflineOrderState(scope, store);

  const orderUuid = resolveOrderUuid(state, data);
  const localPrintJobUuid = printJobs[0]?.printJobUuid;
  if (event.kind === "KITCHEN_CONFIRM") {
    return {
      status: "success",
      message: "offline kitchen confirmation saved",
      offline: true,
      sync_status: printJobs.length ? "WAITING_PRINT" : "PENDING",
      order_uuid: orderUuid,
      login_uuid_fk: scope.actorLoginUuid,
      print_job: localPrintJobUuid ? { print_job_uuid: localPrintJobUuid, job_status: "pending" } : null,
      pending_query: localPrintJobUuid ? { print_job_uuid: localPrintJobUuid, login_uuid_fk: scope.actorLoginUuid } : null,
      print_queue_error: null,
    };
  }
  if (event.kind === "PAYMENT") {
    const paidOrder = orderUuid ? projectOfflineCart(base, { order_uuid: orderUuid }, master).orders[0] : cartBefore;
    return {
      status: "success",
      message: "offline payment saved",
      offline: true,
      sync_status: "PENDING",
      order_uuid: orderUuid,
      order_invoice: paidOrder?.order_invoice ?? "",
      payment: { ...data, payment_status: 1 },
      totals: paidOrder?.totals ?? {},
      is_fully_paid: true,
      order_check_bill_after: 2,
      order_status_after: 2,
      print_job: localPrintJobUuid ? { print_job_uuid: localPrintJobUuid, job_status: "pending" } : null,
      pending_query: localPrintJobUuid ? { print_job_uuid: localPrintJobUuid, login_uuid_fk: scope.actorLoginUuid } : null,
      fallback_print: null,
    };
  }
  return projectOfflineCart(state, orderUuid ? { order_uuid: orderUuid } : {}, master);
}
