"use client";

import Dexie, { type Table } from "dexie";

export const OFFLINE_BROWSER_DB_NAME = "yummy-go-browser-offline-v1";

const MAX_API_CACHE_ENTRIES = 300;
const MAX_API_CACHE_RESPONSE_BYTES = 4 * 1024 * 1024;
// Read-back window for the browser mirror. Deliberately short: these responses
// include takings, daily closing and payment summaries, and a month-old figure
// rendered with no "as of" marker reads as today's money. Past this age the page
// surfaces its load error instead, which is the honest answer. Only affects the
// degraded path — Desktop serves these from the Agent's SQLite first, and this
// runs when the Agent is down or (on Android) absent.
const MAX_API_CACHE_AGE_MS = 48 * 60 * 60 * 1000;
const SYNCED_QUEUE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const SAFE_BROWSER_FALLBACK_PATHS = new Set([
  "/api/v1/posAll/fetch_cate_products",
  "/api/v1/posAll/get_prod_item",
  "/api/v1/status/fetch_size",
  "/api/v1/exchange/fetch_all",
  "/api/v1/currency/fetch_all",
  "/api/v1/customer/list",
  "/api/v1/printer/fetch",
  "/api/v1/printer/fetch_all",
  "/api/v1/printer/roles",
  "/api/v1/zone/fetch_all",
  "/api/v1/branch/fetch_limit",
  "/api/v1/branch/fetch_all",
  "/api/v1/groups/fetch_limit",
  "/api/v1/groups/fetch_all",
  "/api/v1/category/fetch_limit",
  "/api/v1/unite/fetch_limit",
  "/api/v1/unite/fetch_all",
  "/api/v1/sizes/fetch_limit",
  "/api/v1/sizes/fetch_all",
  "/api/v1/topping/fetch_limit",
  "/api/v1/topping/fetch_all",
  "/api/v1/colors/fetch_limit",
  "/api/v1/status/fetch_all",
  "/api/v1/product/fetch_limit",
  "/api/v1/product/stock_qty",
  "/api/v1/register/fetch_limit",
  // Capacitor has no Local Printer Agent, so every offline-viewable page must
  // be able to read its scoped online response back from Dexie. Desktop uses
  // the Agent first and reaches this mirror only when that process is absent.
  "/api/v1/report/sale_report",
  "/api/v1/report_all/sale_report_bill",
  "/api/v1/report_all/sale_report_list",
  "/api/v1/report_all/sale_list",
  "/api/v1/report_all/payment_summary_by_method",
  "/api/v1/report_all/group_list",
  "/api/v1/report_all/daily_closing",
  "/api/v1/best_selling/best_selling_products",
  // "/" is always offline-allowed (OFFLINE_INFRA_PATHS) and is the landing screen
  // on Android, so its dashboard needs the same treatment as the report pages.
  "/api/v1/dashboard/executive",
  // The table grid also backs the offline order-entry route.
  "/api/v1/posAll/fetch_table",
  // /pos/order can now stage real writes offline on Android too (see
  // write-fallback.ts) — loadCart's first read on that page needs this to
  // come back as an empty cart instead of a thrown error for a table that
  // has never been opened before (nothing to have cached yet). Once there is
  // something cached or staged, readBrowserOfflineCache's overlay projects
  // the real state on top; customer_order_queue stays refused — it belongs
  // to the public QR ordering flow, not this one.
  "/api/v1/posAll/fetch_cart",
  "/api/v1/posAll/fetch_join_move_table",
  "/api/v1/cancel/fetch_cancelable_bills",
  "/api/v1/cancel/fetch_cancel_bills",
  "/api/v1/posAll/credit/payment-selection",
  "/api/v1/report_all/order_audit_log",
  "/api/v1/packages/billing_cycles",
  "/api/v1/packages/methods",
  "/api/v1/packages/plans/fetch",
  "/api/v1/packages/fetch_limit",
  "/api/v1/store/fetch_limit",
  "/api/v1/store/fetch_all",
  "/api/v1/province/fetch_limit",
  "/api/v1/province/fetch_all",
  "/api/v1/district/fetch_limit",
  "/api/v1/exchange/fetch_limit",
  "/api/v1/zone/fetch_limit",
  "/api/v1/table/fetch_limit",
  "/api/v1/table/fetch_all",
  "/api/v1/permission/menu",
  "/api/v1/permission/fetch",
  "/api/v1/permission/stores",
  "/api/v1/permission/tree",
  "/api/v1/sub_menu/fetch_all",
  "/api/v1/register/get_id",
  "/api/v1/sync/runtime-capabilities",
]);

export type BrowserSyncEventStatus =
  | "STAGED"
  | "PENDING"
  | "PROCESSING"
  | "FAILED"
  | "BLOCKED"
  | "SYNCED";

export interface BrowserOfflineScope {
  storeUuid: string;
  branchUuid: string;
}

export interface BrowserOfflineIdentity extends BrowserOfflineScope {
  actorLoginUuid: string;
}

export interface BrowserApiCacheEntry extends BrowserOfflineScope {
  key: string;
  method: string;
  path: string;
  requestFingerprint: string;
  response: unknown;
  source: "AGENT" | "ONLINE";
  cachedAt: number;
  syncedThrough?: number;
  retainForOfflineMenu?: boolean;
}

export interface BrowserSyncQueueEntry extends BrowserOfflineIdentity {
  eventUuid: string;
  method: string;
  path: string;
  params: Record<string, unknown>;
  data: unknown;
  requestFingerprint: string;
  dependencies: string[];
  status: BrowserSyncEventStatus;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
  /** Frozen before the first native push; retries must send byte-equivalent data. */
  wireEvent?: BrowserSyncWireEvent;
  /** Display/pricing snapshot only; never included in the frozen Backend request. */
  localItemSnapshots?: Record<string, Record<string, unknown>>;
  /** Present only when event + native print decision were committed together. */
  printContractVersion?: "offline-first-v2";
}

export interface BrowserSyncWireEvent {
  event_uuid: string;
  operation: string;
  branch_uuid: string;
  store_uuid: string;
  device_code: string;
  actor_login_uuid: string;
  entity_type: string;
  entity_uuid: string | null;
  sequence: number;
  dependencies: string[];
  payload: { request: { params: Record<string, unknown>; data: unknown } };
}

export type BrowserPrintJobStatus =
  | "PENDING"
  | "PRINTING"
  | "PRINTED"
  | "FAILED"
  | "UNCERTAIN";

export interface BrowserPrintLine {
  left: string;
  right?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  size?: number;
}

/**
 * Native print work is kept beside the sales outbox, not in localStorage.
 * PRINTING is deliberately not retried after a process death: paper may have
 * left the printer even though the app did not receive the socket result.
 */
export interface BrowserPrintJobEntry extends BrowserOfflineIdentity {
  printJobUuid: string;
  eventUuid: string;
  orderUuid: string;
  orderItemUuids: string[];
  documentType: "KITCHEN" | "RECEIPT";
  printConfigUuid: string;
  interfaceValue: string;
  printerName: string;
  paperWidthMm: 58 | 80;
  openCashDrawer: boolean;
  lines: BrowserPrintLine[];
  status: BrowserPrintJobStatus;
  attempts: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface BrowserSyncStatusEntry extends BrowserOfflineScope {
  scopeKey: string;
  actorLoginUuid: string | null;
  connectionState: "DEGRADED" | "OFFLINE" | "ONLINE" | "SYNCING";
  agentAvailable: boolean;
  pending: number;
  processing: number;
  failed: number;
  blocked: number;
  lastMutationAt: number | null;
  updatedAt: number;
}

export interface BrowserSyncQueueSummary {
  staged: number;
  pending: number;
  processing: number;
  failed: number;
  blocked: number;
  synced: number;
}

export interface BrowserOfflineStore {
  transaction?: <T>(task: () => Promise<T>) => Promise<T>;
  getApiCache: (key: string) => Promise<BrowserApiCacheEntry | undefined>;
  putApiCache: (entry: BrowserApiCacheEntry) => Promise<void>;
  pruneApiCache: (scope: BrowserOfflineScope, maxEntries: number) => Promise<void>;
  listApiCacheByPath: (scope: BrowserOfflineScope, path: string) => Promise<BrowserApiCacheEntry[]>;
  getSyncQueue: (eventUuid: string) => Promise<BrowserSyncQueueEntry | undefined>;
  putSyncQueue: (entry: BrowserSyncQueueEntry) => Promise<void>;
  deleteSyncQueue: (eventUuid: string) => Promise<void>;
  listSyncQueue: (scope: BrowserOfflineScope) => Promise<BrowserSyncQueueEntry[]>;
  getSyncStatus: (scopeKey: string) => Promise<BrowserSyncStatusEntry | undefined>;
  putSyncStatus: (entry: BrowserSyncStatusEntry) => Promise<void>;
  pruneSyncedQueue: (scope: BrowserOfflineScope, updatedBefore: number) => Promise<void>;
  getPrintJob?: (printJobUuid: string) => Promise<BrowserPrintJobEntry | undefined>;
  putPrintJob?: (entry: BrowserPrintJobEntry) => Promise<void>;
  listPrintJobs?: (scope: BrowserOfflineScope) => Promise<BrowserPrintJobEntry[]>;
  deletePrintJob?: (printJobUuid: string) => Promise<void>;
}

interface CacheRequest extends BrowserOfflineScope {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
}

interface CacheWriteInput extends CacheRequest {
  response: unknown;
  source: "AGENT" | "ONLINE";
  preservePendingOrders?: boolean;
  /** Allow master-data refresh without evicting snapshots needed by the outbox. */
  preservePendingOrderCache?: boolean;
  retainForOfflineMenu?: boolean;
  requestStartedAt?: number;
}

interface StageSyncRequestInput extends CacheRequest, BrowserOfflineIdentity {
  eventUuid: string;
  requireExclusiveActor?: boolean;
  localItemSnapshots?: Record<string, Record<string, unknown>>;
  printJobs?: BrowserPrintJobEntry[];
  printContractVersion?: "offline-first-v2";
}

interface BrowserStatusInput extends BrowserOfflineScope {
  actorLoginUuid?: string | null;
  connectionState: BrowserSyncStatusEntry["connectionState"];
  agentAvailable: boolean;
  pending?: number;
  processing?: number;
  failed?: number;
  blocked?: number;
}

class YummyGoBrowserDatabase extends Dexie {
  apiCache!: Table<BrowserApiCacheEntry, string>;
  syncQueue!: Table<BrowserSyncQueueEntry, string>;
  syncStatus!: Table<BrowserSyncStatusEntry, string>;
  printQueue!: Table<BrowserPrintJobEntry, string>;

  constructor() {
    super(OFFLINE_BROWSER_DB_NAME);
    this.version(1).stores({
      apiCache: "&key, [storeUuid+branchUuid], path, cachedAt",
      syncQueue: "&eventUuid, [storeUuid+branchUuid], status, createdAt, updatedAt",
      syncStatus: "&scopeKey, [storeUuid+branchUuid], connectionState, updatedAt",
    });
    // Add-only migration: existing carts/outbox rows stay byte-for-byte intact.
    this.version(2).stores({
      apiCache: "&key, [storeUuid+branchUuid], path, cachedAt",
      syncQueue: "&eventUuid, [storeUuid+branchUuid], status, createdAt, updatedAt",
      syncStatus: "&scopeKey, [storeUuid+branchUuid], connectionState, updatedAt",
      printQueue: "&printJobUuid, eventUuid, [storeUuid+branchUuid], status, createdAt, updatedAt",
    });
  }
}

class DexieBrowserOfflineStore implements BrowserOfflineStore {
  constructor(private readonly database: YummyGoBrowserDatabase) {}

  transaction<T>(task: () => Promise<T>) {
    return this.database.transaction(
      "rw",
      this.database.apiCache,
      this.database.syncQueue,
      this.database.syncStatus,
      this.database.printQueue,
      task,
    );
  }

  async getApiCache(key: string) {
    return this.database.apiCache.get(key);
  }

  async putApiCache(entry: BrowserApiCacheEntry) {
    await this.database.apiCache.put(entry);
  }

  // Scoped: one store/branch's traffic must never evict another's offline cache.
  async pruneApiCache(scope: BrowserOfflineScope, maxEntries: number) {
    const key = [scope.storeUuid, scope.branchUuid];
    const entries = await this.database.apiCache
      .where("[storeUuid+branchUuid]")
      .equals(key)
      .sortBy("cachedAt");
    await this.database.apiCache.bulkDelete(browserApiCacheEvictionKeys(entries, maxEntries));
  }

  // Any cached response for this path/scope, regardless of which params/data
  // produced it — used to seed offline order state from whichever fetch_cart
  // calls happen to be cached (see write-fallback.ts), since a mutation's own
  // payload rarely carries every param the original GET was fetched with.
  async listApiCacheByPath(scope: BrowserOfflineScope, path: string) {
    const key = [scope.storeUuid, scope.branchUuid];
    const entries = await this.database.apiCache.where("[storeUuid+branchUuid]").equals(key).toArray();
    return entries.filter((entry) => entry.path === path);
  }

  async getSyncQueue(eventUuid: string) {
    return this.database.syncQueue.get(eventUuid);
  }

  async putSyncQueue(entry: BrowserSyncQueueEntry) {
    await this.database.syncQueue.put(entry);
  }

  async deleteSyncQueue(eventUuid: string) {
    await this.database.syncQueue.delete(eventUuid);
  }

  async listSyncQueue(scope: BrowserOfflineScope) {
    return this.database.syncQueue
      .where("[storeUuid+branchUuid]")
      .equals([scope.storeUuid, scope.branchUuid])
      .sortBy("createdAt");
  }

  async getSyncStatus(scopeKey: string) {
    return this.database.syncStatus.get(scopeKey);
  }

  async putSyncStatus(entry: BrowserSyncStatusEntry) {
    await this.database.syncStatus.put(entry);
  }

  // Scoped: retention for this store/branch never deletes another scope's queue.
  async pruneSyncedQueue(scope: BrowserOfflineScope, updatedBefore: number) {
    const keys = await this.database.syncQueue
      .where("[storeUuid+branchUuid]")
      .equals([scope.storeUuid, scope.branchUuid])
      .and((entry) => entry.status === "SYNCED" && entry.updatedAt < updatedBefore)
      .primaryKeys();
    await this.database.syncQueue.bulkDelete(keys);
  }

  async getPrintJob(printJobUuid: string) {
    return this.database.printQueue.get(printJobUuid);
  }

  async putPrintJob(entry: BrowserPrintJobEntry) {
    await this.database.printQueue.put(entry);
  }

  async listPrintJobs(scope: BrowserOfflineScope) {
    return this.database.printQueue
      .where("[storeUuid+branchUuid]")
      .equals([scope.storeUuid, scope.branchUuid])
      .sortBy("createdAt");
  }

  async deletePrintJob(printJobUuid: string) {
    await this.database.printQueue.delete(printJobUuid);
  }
}

let dexieStore: BrowserOfflineStore | null = null;

function defaultStore() {
  if (typeof indexedDB === "undefined") return null;
  if (!dexieStore) dexieStore = new DexieBrowserOfflineStore(new YummyGoBrowserDatabase());
  return dexieStore;
}

function storeFor(override?: BrowserOfflineStore) {
  return override ?? defaultStore();
}

function normalizedPath(path: string) {
  return String(path || "").split("?")[0];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function browserOfflineScopeKey(scope: BrowserOfflineScope) {
  return `${scope.storeUuid}:${scope.branchUuid}`;
}

export function browserRequestFingerprint(input: Pick<CacheRequest, "method" | "path" | "params" | "data">) {
  return stableJson({
    method: input.method.toUpperCase(),
    path: normalizedPath(input.path),
    params: input.params ?? {},
    data: input.data ?? {},
  });
}

export function browserApiCacheKey(input: CacheRequest) {
  return stableJson({
    scope: browserOfflineScopeKey(input),
    request: browserRequestFingerprint(input),
  });
}

export function isSafeBrowserCacheFallback(path: string) {
  return SAFE_BROWSER_FALLBACK_PATHS.has(normalizedPath(path));
}

export function browserApiCacheEvictionKeys(entries: BrowserApiCacheEntry[], maxEntries: number, now = Date.now()) {
  // A full mobile catalog can exceed 300 products. Its fresh detail records
  // must not evict each other (or carts) halfway through preparation.
  const evictable = entries.filter((entry) => !entry.retainForOfflineMenu || now - entry.cachedAt > MAX_API_CACHE_AGE_MS)
    .sort((a, b) => a.cachedAt - b.cachedAt);
  return evictable.slice(0, Math.max(0, evictable.length - maxEntries)).map((entry) => entry.key);
}

export async function readBrowserApiCacheEntry(input: CacheRequest, override?: BrowserOfflineStore) {
  return storeFor(override)?.getApiCache(browserApiCacheKey(input));
}

function serializedSize(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export async function cacheBrowserApiResponse(
  input: CacheWriteInput,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store || !input.storeUuid || !input.branchUuid) return false;
  if (serializedSize(input.response) > MAX_API_CACHE_RESPONSE_BYTES) return false;
  const cache = async () => {
    const queued = input.preservePendingOrders || input.preservePendingOrderCache
      ? await store.listSyncQueue(input) : [];
    // A response started online can arrive after the cashier wrote locally.
    // Keep the old base until all local mutations have been acknowledged.
    if (input.preservePendingOrders && queued.some((entry) => entry.status !== "SYNCED" ||
      (input.requestStartedAt !== undefined && entry.updatedAt >= input.requestStartedAt))) return false;
    const cachedAt = Date.now();
    await store.putApiCache({
      key: browserApiCacheKey(input),
      storeUuid: input.storeUuid,
      branchUuid: input.branchUuid,
      method: input.method.toUpperCase(),
      path: normalizedPath(input.path),
      requestFingerprint: browserRequestFingerprint(input),
      response: input.response,
      source: input.source,
      cachedAt,
      ...(input.retainForOfflineMenu ? { retainForOfflineMenu: true } : {}),
      ...(input.preservePendingOrders ? { syncedThrough: queued.reduce((latest, entry) => Math.max(latest, entry.createdAt), 0) } : {}),
    });
    // Browsing new categories during recovery must not evict the old cart base
    // (or product data) needed to replay a pending/blocked bill. Resume the cap
    // on the next successful cache write after acknowledgement.
    if (!input.preservePendingOrderCache || !queued.some((entry) => entry.status !== "SYNCED")) {
      await store.pruneApiCache(input, MAX_API_CACHE_ENTRIES);
    }
    return true;
  };
  if (!input.preservePendingOrders && !input.preservePendingOrderCache) return cache();
  return store.transaction ? store.transaction(cache) : serializeStoreWrite(store, cache);
}

export async function readBrowserApiFallback<T>(
  input: CacheRequest,
  override?: BrowserOfflineStore,
): Promise<T | null> {
  const store = storeFor(override);
  if (!store || !isSafeBrowserCacheFallback(input.path)) return null;
  const cached = await store.getApiCache(browserApiCacheKey(input));
  if (!cached || Date.now() - cached.cachedAt > MAX_API_CACHE_AGE_MS) return null;
  return cached.response as T;
}

/**
 * Every cached response for one path/scope, regardless of the exact
 * params/data that produced it — a mutation's own payload rarely carries
 * every param the original GET was fetched with, so an exact-key lookup
 * (`readBrowserApiFallback`) cannot find "the cart this order was in".
 */
export async function listBrowserApiCacheResponses(
  scope: BrowserOfflineScope,
  path: string,
  override?: BrowserOfflineStore,
): Promise<unknown[]> {
  return (await listBrowserApiCacheEntries(scope, path, override)).map((entry) => entry.response);
}

export async function listBrowserApiCacheEntries(
  scope: BrowserOfflineScope,
  path: string,
  override?: BrowserOfflineStore,
): Promise<BrowserApiCacheEntry[]> {
  const store = storeFor(override);
  if (!store) return [];
  const entries = await store.listApiCacheByPath(scope, normalizedPath(path));
  const operational = path.startsWith("/api/v1/posAll/");
  const pending = operational && (await store.listSyncQueue(scope)).some((entry) => entry.status !== "SYNCED");
  return entries
    .filter((entry) => pending || Date.now() - entry.cachedAt <= MAX_API_CACHE_AGE_MS)
    .sort((left, right) => left.cachedAt - right.cachedAt);
}

async function updateMutationTimestamp(
  scope: BrowserOfflineScope,
  now: number,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return;
  const scopeKey = browserOfflineScopeKey(scope);
  const current = await store.getSyncStatus(scopeKey);
  await store.putSyncStatus({
    scopeKey,
    storeUuid: scope.storeUuid,
    branchUuid: scope.branchUuid,
    actorLoginUuid: current?.actorLoginUuid ?? null,
    connectionState: current?.connectionState ?? "DEGRADED",
    agentAvailable: current?.agentAvailable ?? true,
    pending: current?.pending ?? 0,
    processing: current?.processing ?? 0,
    failed: current?.failed ?? 0,
    blocked: current?.blocked ?? 0,
    lastMutationAt: now,
    updatedAt: now,
  });
}

export async function noteBrowserMutation(
  scope: BrowserOfflineScope,
  override?: BrowserOfflineStore,
) {
  if (!scope.storeUuid || !scope.branchUuid) return;
  await updateMutationTimestamp(scope, Date.now(), override);
}

export async function stageBrowserSyncRequest(
  input: StageSyncRequestInput,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store || !input.eventUuid || !input.storeUuid || !input.branchUuid || !input.actorLoginUuid) return null;
  if (input.printJobs?.length && (!store.getPrintJob || !store.putPrintJob)) {
    throw new Error("MOBILE_PRINT_STORAGE_UNAVAILABLE");
  }
  const stage = async () => {
    const fingerprint = browserRequestFingerprint(input);
    const existing = await store.getSyncQueue(input.eventUuid);
    if (existing && (
      existing.requestFingerprint !== fingerprint ||
      existing.actorLoginUuid !== input.actorLoginUuid ||
      existing.storeUuid !== input.storeUuid || existing.branchUuid !== input.branchUuid
    )) {
      throw new Error("BROWSER_SYNC_EVENT_PAYLOAD_MISMATCH");
    }
    const now = Date.now();
    const existingScopeEntries = existing ? [] : await store.listSyncQueue(input);
    if (input.requireExclusiveActor && existingScopeEntries.some((entry) =>
      entry.status !== "SYNCED" && entry.actorLoginUuid !== input.actorLoginUuid)) {
      throw new Error("MOBILE_PREVIOUS_CASHIER_PENDING");
    }
    const latestCreatedAt = existingScopeEntries.reduce(
      (latest, entry) => Math.max(latest, entry.createdAt),
      0,
    );
    const createdAt = existing?.createdAt ?? Math.max(now, latestCreatedAt + 1);
    const entry: BrowserSyncQueueEntry = existing ?? {
      eventUuid: input.eventUuid,
      storeUuid: input.storeUuid,
      branchUuid: input.branchUuid,
      actorLoginUuid: input.actorLoginUuid,
      method: input.method.toUpperCase(),
      path: normalizedPath(input.path),
      params: input.params ?? {},
      data: input.data ?? {},
      requestFingerprint: fingerprint,
      dependencies: [],
      status: "STAGED",
      lastError: null,
      createdAt,
      updatedAt: now,
      ...(input.localItemSnapshots ? { localItemSnapshots: input.localItemSnapshots } : {}),
      ...(input.printContractVersion ? { printContractVersion: input.printContractVersion } : {}),
    };
    await store.putSyncQueue({ ...entry, updatedAt: now });
    for (const printJob of input.printJobs ?? []) {
      if (
        printJob.eventUuid !== input.eventUuid ||
        printJob.storeUuid !== input.storeUuid ||
        printJob.branchUuid !== input.branchUuid ||
        printJob.actorLoginUuid !== input.actorLoginUuid
      ) throw new Error("MOBILE_PRINT_JOB_SCOPE_MISMATCH");
      const saved = await store.getPrintJob?.(printJob.printJobUuid);
      if (saved && saved.eventUuid !== input.eventUuid) {
        throw new Error("MOBILE_PRINT_JOB_IDENTITY_MISMATCH");
      }
      if (!saved) await store.putPrintJob?.(printJob);
    }
    await updateMutationTimestamp(input, now, store);
    return entry;
  };
  return store.transaction ? store.transaction(stage) : serializeStoreWrite(store, stage);
}

const storeWrites = new WeakMap<BrowserOfflineStore, Promise<unknown>>();

export async function retainBrowserItemSnapshots(
  eventUuid: string,
  scope: BrowserOfflineScope,
  snapshots: Record<string, Record<string, unknown>>,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return;
  const retain = async () => {
    const entry = await store.getSyncQueue(eventUuid);
    if (!entry || entry.storeUuid !== scope.storeUuid || entry.branchUuid !== scope.branchUuid || entry.localItemSnapshots) return;
    // Do not alter identity, status, payload, sequence or acknowledgement time.
    await store.putSyncQueue({ ...entry, localItemSnapshots: snapshots });
  };
  return store.transaction ? store.transaction(retain) : serializeStoreWrite(store, retain);
}

function serializeStoreWrite<T>(store: BrowserOfflineStore, task: () => Promise<T>): Promise<T> {
  const previous = storeWrites.get(store) ?? Promise.resolve();
  const current = previous.then(task, task);
  const tail = current.then(() => undefined, () => undefined);
  storeWrites.set(store, tail);
  void tail.then(() => { if (storeWrites.get(store) === tail) storeWrites.delete(store); });
  return current;
}

export async function updateBrowserSyncEvent(
  eventUuid: string,
  update: {
    status: BrowserSyncEventStatus;
    dependencies?: string[];
    lastError?: string | null;
    wireEvent?: BrowserSyncWireEvent;
  },
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return null;
  const apply = async () => {
    const current = await store.getSyncQueue(eventUuid);
    if (!current) return null;
    const entry: BrowserSyncQueueEntry = {
      ...current,
      status: update.status,
      dependencies: update.dependencies ?? current.dependencies,
      lastError: update.lastError === undefined ? current.lastError : update.lastError,
      wireEvent: current.wireEvent ?? update.wireEvent,
      updatedAt: Date.now(),
    };
    await store.putSyncQueue(entry);
    return entry;
  };
  return store.transaction ? store.transaction(apply) : serializeStoreWrite(store, apply);
}

export async function discardBrowserSyncEvent(
  eventUuid: string,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return false;
  await store.deleteSyncQueue(eventUuid);
  return true;
}

export async function putBrowserPrintJob(
  entry: BrowserPrintJobEntry,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store?.putPrintJob) throw new Error("MOBILE_PRINT_STORAGE_UNAVAILABLE");
  await store.putPrintJob(entry);
  return entry;
}

export async function getBrowserPrintJob(
  printJobUuid: string,
  override?: BrowserOfflineStore,
) {
  return storeFor(override)?.getPrintJob?.(printJobUuid);
}

export async function listBrowserPrintJobs(
  scope: BrowserOfflineScope,
  override?: BrowserOfflineStore,
) {
  return (await storeFor(override)?.listPrintJobs?.(scope)) ?? [];
}

export async function deleteBrowserPrintJob(
  printJobUuid: string,
  override?: BrowserOfflineStore,
) {
  await storeFor(override)?.deletePrintJob?.(printJobUuid);
}

export async function listBrowserPrintJobsForEvent(
  eventUuid: string,
  scope: BrowserOfflineScope,
  override?: BrowserOfflineStore,
) {
  return (await listBrowserPrintJobs(scope, override)).filter(
    (entry) => entry.eventUuid === eventUuid,
  );
}

export async function updateBrowserPrintJob(
  printJobUuid: string,
  update: Pick<BrowserPrintJobEntry, "status"> & {
    lastError?: string | null;
    incrementAttempts?: boolean;
  },
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store?.getPrintJob || !store.putPrintJob) return null;
  const apply = async () => {
    const current = await store.getPrintJob?.(printJobUuid);
    if (!current) return null;
    const next: BrowserPrintJobEntry = {
      ...current,
      status: update.status,
      attempts: current.attempts + (update.incrementAttempts ? 1 : 0),
      lastError: update.lastError === undefined ? current.lastError : update.lastError,
      updatedAt: Date.now(),
    };
    await store.putPrintJob?.(next);
    return next;
  };
  return store.transaction ? store.transaction(apply) : serializeStoreWrite(store, apply);
}

// Retention is maintenance, not part of reading the queue. The reconcile loop
// lists the queue every couple of seconds; pruning on every one of those reads
// puts a delete scan on a hot path for rows that only expire once a week.
const SYNCED_QUEUE_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const lastSyncedQueuePruneAt = new WeakMap<BrowserOfflineStore, Map<string, number>>();

export async function listBrowserSyncQueue(
  scope: BrowserOfflineScope,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return [];
  const now = Date.now();
  let prunedAtByScope = lastSyncedQueuePruneAt.get(store);
  if (!prunedAtByScope) {
    prunedAtByScope = new Map<string, number>();
    lastSyncedQueuePruneAt.set(store, prunedAtByScope);
  }
  const scopeKey = browserOfflineScopeKey(scope);
  if (now - (prunedAtByScope.get(scopeKey) ?? 0) >= SYNCED_QUEUE_PRUNE_INTERVAL_MS) {
    prunedAtByScope.set(scopeKey, now);
    // A still-open recovery chain may need its acknowledged parents to rebuild
    // the cart or satisfy dependencies. Never prune them out from under it.
    const entries = await store.listSyncQueue(scope);
    if (!entries.some((entry) => entry.status !== "SYNCED")) {
      await store.pruneSyncedQueue(scope, now - SYNCED_QUEUE_RETENTION_MS);
    }
  }
  return store.listSyncQueue(scope);
}

export function browserSyncQueueSummary(entries: BrowserSyncQueueEntry[]): BrowserSyncQueueSummary {
  const result: BrowserSyncQueueSummary = {
    staged: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    blocked: 0,
    synced: 0,
  };
  for (const entry of entries) {
    const key = entry.status.toLowerCase() as keyof BrowserSyncQueueSummary;
    result[key] += 1;
  }
  return result;
}

export function browserSyncQueueHasRetryableWork(summary: BrowserSyncQueueSummary) {
  return summary.staged > 0 || summary.pending > 0 || summary.processing > 0 || summary.failed > 0;
}

export async function getBrowserSyncQueueSummary(
  scope: BrowserOfflineScope,
  override?: BrowserOfflineStore,
) {
  return browserSyncQueueSummary(await listBrowserSyncQueue(scope, override));
}

export async function persistBrowserSyncStatus(
  input: BrowserStatusInput,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store || !input.storeUuid || !input.branchUuid) return false;
  const scopeKey = browserOfflineScopeKey(input);
  const current = await store.getSyncStatus(scopeKey);
  await store.putSyncStatus({
    scopeKey,
    storeUuid: input.storeUuid,
    branchUuid: input.branchUuid,
    actorLoginUuid: input.actorLoginUuid ?? current?.actorLoginUuid ?? null,
    connectionState: input.connectionState,
    agentAvailable: input.agentAvailable,
    pending: Number(input.pending ?? current?.pending ?? 0),
    processing: Number(input.processing ?? current?.processing ?? 0),
    failed: Number(input.failed ?? current?.failed ?? 0),
    blocked: Number(input.blocked ?? current?.blocked ?? 0),
    lastMutationAt: current?.lastMutationAt ?? null,
    updatedAt: Date.now(),
  });
  return true;
}
