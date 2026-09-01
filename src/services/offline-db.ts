"use client";

import Dexie, { type Table } from "dexie";

export const OFFLINE_BROWSER_DB_NAME = "yummy-go-browser-offline-v1";

const MAX_API_CACHE_ENTRIES = 300;
const MAX_API_CACHE_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_API_CACHE_AGE_MS = 31 * 24 * 60 * 60 * 1000;
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
  getApiCache: (key: string) => Promise<BrowserApiCacheEntry | undefined>;
  putApiCache: (entry: BrowserApiCacheEntry) => Promise<void>;
  pruneApiCache: (maxEntries: number) => Promise<void>;
  getSyncQueue: (eventUuid: string) => Promise<BrowserSyncQueueEntry | undefined>;
  putSyncQueue: (entry: BrowserSyncQueueEntry) => Promise<void>;
  deleteSyncQueue: (eventUuid: string) => Promise<void>;
  listSyncQueue: (scope: BrowserOfflineScope) => Promise<BrowserSyncQueueEntry[]>;
  getSyncStatus: (scopeKey: string) => Promise<BrowserSyncStatusEntry | undefined>;
  putSyncStatus: (entry: BrowserSyncStatusEntry) => Promise<void>;
  pruneSyncedQueue: (updatedBefore: number) => Promise<void>;
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
}

interface StageSyncRequestInput extends CacheRequest, BrowserOfflineIdentity {
  eventUuid: string;
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

  constructor() {
    super(OFFLINE_BROWSER_DB_NAME);
    this.version(1).stores({
      apiCache: "&key, [storeUuid+branchUuid], path, cachedAt",
      syncQueue: "&eventUuid, [storeUuid+branchUuid], status, createdAt, updatedAt",
      syncStatus: "&scopeKey, [storeUuid+branchUuid], connectionState, updatedAt",
    });
  }
}

class DexieBrowserOfflineStore implements BrowserOfflineStore {
  constructor(private readonly database: YummyGoBrowserDatabase) {}

  async getApiCache(key: string) {
    return this.database.apiCache.get(key);
  }

  async putApiCache(entry: BrowserApiCacheEntry) {
    await this.database.apiCache.put(entry);
  }

  async pruneApiCache(maxEntries: number) {
    const overflow = Math.max(0, await this.database.apiCache.count() - maxEntries);
    if (!overflow) return;
    const keys = await this.database.apiCache.orderBy("cachedAt").limit(overflow).primaryKeys();
    await this.database.apiCache.bulkDelete(keys);
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

  async pruneSyncedQueue(updatedBefore: number) {
    const keys = await this.database.syncQueue
      .where("updatedAt")
      .below(updatedBefore)
      .and((entry) => entry.status === "SYNCED")
      .primaryKeys();
    await this.database.syncQueue.bulkDelete(keys);
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
  });
  await store.pruneApiCache(MAX_API_CACHE_ENTRIES);
  return true;
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
  const fingerprint = browserRequestFingerprint(input);
  const existing = await store.getSyncQueue(input.eventUuid);
  if (existing && (
    existing.requestFingerprint !== fingerprint ||
    existing.actorLoginUuid !== input.actorLoginUuid
  )) {
    throw new Error("BROWSER_SYNC_EVENT_PAYLOAD_MISMATCH");
  }
  const now = Date.now();
  const existingScopeEntries = existing ? [] : await store.listSyncQueue(input);
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
  };
  await store.putSyncQueue({ ...entry, updatedAt: now });
  await updateMutationTimestamp(input, now, store);
  return entry;
}

export async function updateBrowserSyncEvent(
  eventUuid: string,
  update: {
    status: BrowserSyncEventStatus;
    dependencies?: string[];
    lastError?: string | null;
  },
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return null;
  const current = await store.getSyncQueue(eventUuid);
  if (!current) return null;
  const entry: BrowserSyncQueueEntry = {
    ...current,
    status: update.status,
    dependencies: update.dependencies ?? current.dependencies,
    lastError: update.lastError === undefined ? current.lastError : update.lastError,
    updatedAt: Date.now(),
  };
  await store.putSyncQueue(entry);
  return entry;
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

export async function listBrowserSyncQueue(
  scope: BrowserOfflineScope,
  override?: BrowserOfflineStore,
) {
  const store = storeFor(override);
  if (!store) return [];
  await store.pruneSyncedQueue(Date.now() - SYNCED_QUEUE_RETENTION_MS);
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
