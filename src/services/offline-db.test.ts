import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserRequestFingerprint,
  browserSyncQueueHasRetryableWork,
  cacheBrowserApiResponse,
  getBrowserSyncQueueSummary,
  isSafeBrowserCacheFallback,
  listBrowserSyncQueue,
  readBrowserApiFallback,
  stageBrowserSyncRequest,
  updateBrowserSyncEvent,
  type BrowserApiCacheEntry,
  type BrowserOfflineScope,
  type BrowserOfflineStore,
  type BrowserSyncQueueEntry,
  type BrowserSyncStatusEntry,
} from "@/services/offline-db";
import { OFFLINE_READ_ONLY_PATHS } from "@/lib/offline-routes";
import {
  discardBlockedBrowserSyncEvent,
  listBlockedBrowserSyncEvents,
  pushBrowserSyncQueue,
  reconcileBrowserSyncQueue,
  readBrowserOfflineCache,
  requestLocalFallback,
  retryBlockedBrowserSyncEvent,
} from "@/services/offline-sync";

class MemoryBrowserOfflineStore implements BrowserOfflineStore {
  readonly apiCache = new Map<string, BrowserApiCacheEntry>();
  readonly syncQueue = new Map<string, BrowserSyncQueueEntry>();
  readonly syncStatus = new Map<string, BrowserSyncStatusEntry>();

  async getApiCache(key: string) {
    return this.apiCache.get(key);
  }

  async putApiCache(entry: BrowserApiCacheEntry) {
    this.apiCache.set(entry.key, structuredClone(entry));
  }

  async pruneApiCache(scope: BrowserOfflineScope, maxEntries: number) {
    const oldest = [...this.apiCache.values()]
      .filter((entry) => entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid)
      .sort((left, right) => left.cachedAt - right.cachedAt);
    for (const entry of oldest.slice(0, Math.max(0, oldest.length - maxEntries))) {
      this.apiCache.delete(entry.key);
    }
  }

  async listApiCacheByPath(scope: BrowserOfflineScope, path: string) {
    return [...this.apiCache.values()].filter((entry) =>
      entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid && entry.path === path);
  }

  async getSyncQueue(eventUuid: string) {
    const entry = this.syncQueue.get(eventUuid);
    return entry ? structuredClone(entry) : undefined;
  }

  async putSyncQueue(entry: BrowserSyncQueueEntry) {
    this.syncQueue.set(entry.eventUuid, structuredClone(entry));
  }

  async deleteSyncQueue(eventUuid: string) {
    this.syncQueue.delete(eventUuid);
  }

  async listSyncQueue(scope: BrowserOfflineScope) {
    return [...this.syncQueue.values()]
      .filter((entry) => entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid)
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((entry) => structuredClone(entry));
  }

  async getSyncStatus(scopeKey: string) {
    const entry = this.syncStatus.get(scopeKey);
    return entry ? structuredClone(entry) : undefined;
  }

  async putSyncStatus(entry: BrowserSyncStatusEntry) {
    this.syncStatus.set(entry.scopeKey, structuredClone(entry));
  }

  async pruneSyncedQueue(scope: BrowserOfflineScope, updatedBefore: number) {
    for (const entry of this.syncQueue.values()) {
      if (
        entry.storeUuid === scope.storeUuid &&
        entry.branchUuid === scope.branchUuid &&
        entry.status === "SYNCED" &&
        entry.updatedAt < updatedBefore
      ) {
        this.syncQueue.delete(entry.eventUuid);
      }
    }
  }
}

const scope = { storeUuid: "store-1", branchUuid: "branch-1", actorLoginUuid: "login-1" };
const otherBranchScope = { storeUuid: "store-1", branchUuid: "branch-2", actorLoginUuid: "login-2" };
const eventUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Dexie browser offline mirror", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("installs Dexie without Dexie Cloud", () => {
    const testDir = dirname(fileURLToPath(import.meta.url));
    const packageJson = readFileSync(join(testDir, "..", "..", "package.json"), "utf8");
    expect(packageJson).toContain('"dexie"');
    expect(packageJson).not.toContain("dexie-cloud-addon");
  });

  it("uses a stable exact-request identity and keeps branch caches isolated", async () => {
    const store = new MemoryBrowserOfflineStore();
    const request = {
      ...scope,
      method: "get",
      path: "/api/v1/posAll/fetch_cate_products",
      params: { lang: "la", page: 1 },
    };
    expect(browserRequestFingerprint(request)).toBe(browserRequestFingerprint({
      ...request,
      params: { page: 1, lang: "la" },
    }));

    await cacheBrowserApiResponse({
      ...request,
      response: { status: "success", data: [{ prod_uuid: "product-1" }] },
      source: "ONLINE",
    }, store);

    await expect(readBrowserApiFallback(request, store)).resolves.toMatchObject({
      data: [{ prod_uuid: "product-1" }],
    });
    await expect(readBrowserApiFallback({ ...request, branchUuid: "branch-2" }, store)).resolves.toBeNull();
  });

  it("serves a cached fetch_cart snapshot at this raw layer — readBrowserOfflineCache's overlay is what reconstructs it from real state, not this cache read", async () => {
    const store = new MemoryBrowserOfflineStore();
    const request = {
      ...scope,
      method: "get",
      path: "/api/v1/posAll/fetch_cart",
      params: { order_uuid: "order-1" },
    };
    await cacheBrowserApiResponse({
      ...request,
      response: { status: "success", orders: [{ order_uuid: "order-1" }] },
      source: "AGENT",
    }, store);

    await expect(readBrowserApiFallback(request, store)).resolves.toEqual({
      status: "success",
      orders: [{ order_uuid: "order-1" }],
    });
  });

  it("persists one stable payment event across a logical Chrome restart", async () => {
    const store = new MemoryBrowserOfflineStore();
    const paymentRequest = {
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: {
        sync_event_uuid: eventUuid,
        payment_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        order_uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    };
    await stageBrowserSyncRequest(paymentRequest, store);
    await stageBrowserSyncRequest(paymentRequest, store);

    const afterRestart = await getBrowserSyncQueueSummary(scope, store);
    expect(afterRestart.staged).toBe(1);
    expect(browserSyncQueueHasRetryableWork(afterRestart)).toBe(true);
    expect(store.syncQueue.size).toBe(1);

    await expect(stageBrowserSyncRequest({
      ...paymentRequest,
      data: { ...paymentRequest.data, order_uuid: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    }, store)).rejects.toThrow("BROWSER_SYNC_EVENT_PAYLOAD_MISMATCH");
  });

  it("replays a crash-staged request to the Agent once and follows its durable status", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/create_order",
      data: {
        sync_event_uuid: eventUuid,
        order_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    }, store);
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    });
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await expect(reconcileBrowserSyncQueue(scope, store)).resolves.toMatchObject({ pending: 1 });
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining("/local/api"),
      expect.objectContaining({ event_uuid: eventUuid }),
      { timeout: 10000 },
    );

    get.mockResolvedValueOnce({
      data: {
        ok: true,
        data: {
          event_uuid: eventUuid,
          dependencies: [],
          sync_status: "SYNCED",
          last_error: null,
        },
      },
    });
    await expect(reconcileBrowserSyncQueue(scope, store)).resolves.toMatchObject({ synced: 1 });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("replays a parent before its child even when both were staged in the same millisecond", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T00:00:00.000Z"));
    const store = new MemoryBrowserOfflineStore();
    const paymentEventUuid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/create_order",
      data: { sync_event_uuid: eventUuid },
    }, store);
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid: paymentEventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: { sync_event_uuid: paymentEventUuid },
    }, store);
    vi.spyOn(axios, "get").mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await reconcileBrowserSyncQueue(scope, store);

    expect(post.mock.calls.map((call) => (call[1] as { path: string }).path)).toEqual([
      "/api/v1/posAll/create_order",
      "/api/v1/posAll/payment",
    ]);
  });

  it("persists a payment before Agent handoff and does not create a second browser event", async () => {
    const store = new MemoryBrowserOfflineStore();
    const post = vi.spyOn(axios, "post").mockImplementation(async () => {
      expect(store.syncQueue.has(eventUuid)).toBe(true);
      return { data: { ok: true, data: { status: "success", offline: true } } };
    });
    const options = {
      data: {
        sync_event_uuid: eventUuid,
        payment_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        order_uuid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    };

    await requestLocalFallback("post", "/api/v1/posAll/payment", options, eventUuid, scope, store);
    await requestLocalFallback("post", "/api/v1/posAll/payment", options, eventUuid, scope, store);

    expect(store.syncQueue.size).toBe(1);
    await expect(getBrowserSyncQueueSummary(scope, store)).resolves.toMatchObject({ pending: 1 });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("uses Dexie only as a safe master-data fallback when the Agent becomes unavailable", async () => {
    const store = new MemoryBrowserOfflineStore();
    const response = { status: "success", data: [{ prod_uuid: "product-1" }] };
    const post = vi.spyOn(axios, "post")
      .mockResolvedValueOnce({ data: { ok: true, data: response } })
      .mockRejectedValueOnce(new Error("Agent stopped"));

    await expect(requestLocalFallback(
      "get",
      "/api/v1/posAll/fetch_cate_products?lang=la",
      undefined,
      null,
      scope,
      store,
    )).resolves.toEqual(response);
    await expect(requestLocalFallback(
      "get",
      "/api/v1/posAll/fetch_cate_products?lang=la",
      undefined,
      null,
      scope,
      store,
    )).resolves.toEqual(response);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("finishes a crash-replayed local-only receipt without creating an endless sync event", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/reprint_receipt",
      data: { order_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    }, store);
    vi.spyOn(axios, "get").mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await expect(reconcileBrowserSyncQueue(scope, store)).resolves.toMatchObject({ synced: 1 });
    await expect(reconcileBrowserSyncQueue(scope, store)).resolves.toMatchObject({ synced: 1 });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("never replays a staged event under a different cashier identity", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: { sync_event_uuid: eventUuid },
    }, store);
    const get = vi.spyOn(axios, "get");
    const post = vi.spyOn(axios, "post");

    await expect(reconcileBrowserSyncQueue({
      ...scope,
      actorLoginUuid: "login-2",
    }, store)).resolves.toMatchObject({ blocked: 1 });
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("does not consider a blocked event retryable when the Agent requires review", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: { sync_event_uuid: eventUuid },
    }, store);
    await updateBrowserSyncEvent(eventUuid, { status: "BLOCKED", lastError: "conflict" }, store);

    const summary = await getBrowserSyncQueueSummary(scope, store);
    expect(summary.blocked).toBe(1);
    expect(browserSyncQueueHasRetryableWork(summary)).toBe(false);
  });

  it("lists only blocked events for the offline sync review screen", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: { sync_event_uuid: eventUuid },
    }, store);
    await updateBrowserSyncEvent(eventUuid, { status: "BLOCKED", lastError: "conflict" }, store);
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      method: "post",
      path: "/api/v1/posAll/create_order",
      data: {},
    }, store);

    const blocked = await listBlockedBrowserSyncEvents(scope, store);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ eventUuid, status: "BLOCKED", lastError: "conflict" });
  });

  it("puts a blocked event back in queue for retry", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: { sync_event_uuid: eventUuid },
    }, store);
    await updateBrowserSyncEvent(eventUuid, { status: "BLOCKED", lastError: "conflict" }, store);

    await retryBlockedBrowserSyncEvent(eventUuid, store);

    const entry = await store.getSyncQueue(eventUuid);
    expect(entry).toMatchObject({ status: "STAGED", lastError: null });
  });

  it("discards a blocked event permanently", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid,
      method: "post",
      path: "/api/v1/posAll/payment",
      data: { sync_event_uuid: eventUuid },
    }, store);
    await updateBrowserSyncEvent(eventUuid, { status: "BLOCKED", lastError: "conflict" }, store);

    await discardBlockedBrowserSyncEvent(eventUuid, store);

    expect(await store.getSyncQueue(eventUuid)).toBeUndefined();
  });
});

describe("queue scope isolation", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  async function stage(
    store: MemoryBrowserOfflineStore,
    target: typeof scope,
    uuid: string,
    status: BrowserSyncQueueEntry["status"],
    updatedAt: number,
  ) {
    await stageBrowserSyncRequest({
      ...target,
      eventUuid: uuid,
      method: "post",
      path: "/api/v1/posAll/create_order",
      data: { order: uuid },
    }, store);
    const entry = await store.getSyncQueue(uuid);
    await store.putSyncQueue({ ...entry!, status, updatedAt });
  }

  it("retention for one branch never deletes another branch's synced queue", async () => {
    const store = new MemoryBrowserOfflineStore();
    const expired = Date.now() - 30 * DAY_MS;
    await stage(store, scope, "11111111-1111-4111-8111-111111111111", "SYNCED", expired);
    await stage(store, otherBranchScope, "22222222-2222-4222-8222-222222222222", "SYNCED", expired);

    // Branch 1 lists (and therefore prunes) its own queue.
    const remaining = await listBrowserSyncQueue(scope, store);

    expect(remaining).toHaveLength(0);
    expect(store.syncQueue.has("22222222-2222-4222-8222-222222222222")).toBe(true);
  });

  it("keeps another branch's pending queue when this branch drains", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stage(store, scope, "33333333-3333-4333-8333-333333333333", "SYNCED", Date.now() - 30 * DAY_MS);
    await stage(store, otherBranchScope, "44444444-4444-4444-8444-444444444444", "PENDING", Date.now());

    await listBrowserSyncQueue(scope, store);
    const other = await listBrowserSyncQueue(otherBranchScope, store);

    expect(other.map((entry) => entry.eventUuid)).toEqual(["44444444-4444-4444-8444-444444444444"]);
    expect(other[0].status).toBe("PENDING");
  });

  it("one branch's API cache overflow never evicts another branch's cache", async () => {
    const store = new MemoryBrowserOfflineStore();
    await cacheBrowserApiResponse({
      ...otherBranchScope,
      method: "get",
      path: "/api/v1/posAll/fetch_cate_products",
      response: { keep: true },
      source: "ONLINE",
    }, store);
    const otherKeys = [...store.apiCache.keys()];

    for (let index = 0; index < 40; index += 1) {
      await cacheBrowserApiResponse({
        ...scope,
        method: "get",
        path: "/api/v1/posAll/fetch_cate_products",
        params: { page: index },
        response: { index },
        source: "ONLINE",
      }, store);
    }

    for (const key of otherKeys) expect(store.apiCache.has(key)).toBe(true);
  });

  it("summaries and blocked reviews only ever see this branch", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stage(store, scope, "55555555-5555-4555-8555-555555555555", "PENDING", Date.now());
    await stage(store, otherBranchScope, "66666666-6666-4666-8666-666666666666", "BLOCKED", Date.now());

    expect(await getBrowserSyncQueueSummary(scope, store)).toMatchObject({ pending: 1, blocked: 0 });
    expect(await listBlockedBrowserSyncEvents(scope, store)).toHaveLength(0);
    expect(await listBlockedBrowserSyncEvents(otherBranchScope, store)).toHaveLength(1);
  });
});

// Android has no Local Printer Agent, so for the pages it is allowed to open
// offline the Dexie mirror is the only data source left. Every one of those
// pages must be able to read back what it cached, or it renders empty.
describe("offline read-only pages can read their own cache back", () => {
  const READ_ONLY_PAGE_APIS: Record<string, readonly string[]> = {
    "/sales/sales-list": [
      "/api/v1/report_all/sale_list",
      "/api/v1/report_all/sale_report_list",
      "/api/v1/report_all/sale_report_bill",
    ],
    "/report/daily-closing": ["/api/v1/report_all/daily_closing"],
    "/report/daily-sales": ["/api/v1/report/sale_report"],
    "/report/best-selling-products": ["/api/v1/best_selling/best_selling_products"],
    "/report/payment-methods": ["/api/v1/report_all/payment_summary_by_method"],
    "/report/category-sales": ["/api/v1/report_all/group_list"],
    "/products": ["/api/v1/product/fetch_limit"],
    "/stock": ["/api/v1/product/stock_qty"],
    "/printers": [
      "/api/v1/printer/fetch",
      "/api/v1/printer/roles",
      "/api/v1/zone/fetch_all",
      "/api/v1/category/fetch_limit",
    ],
    "/settings/user": ["/api/v1/register/fetch_limit"],
    "/settings/branch": ["/api/v1/branch/fetch_all"],
    "/pos/tables": ["/api/v1/posAll/fetch_table"],
  };

  it("covers every page in OFFLINE_READ_ONLY_PATHS", () => {
    expect(Object.keys(READ_ONLY_PAGE_APIS).sort()).toEqual([...OFFLINE_READ_ONLY_PATHS].sort());
  });

  it.each(Object.entries(READ_ONLY_PAGE_APIS))("%s reads from the browser mirror", (_page, apis) => {
    for (const api of apis) expect(isSafeBrowserCacheFallback(api)).toBe(true);
  });

  it("round-trips a cached report response for a page Android is allowed to open", async () => {
    const store = new MemoryBrowserOfflineStore();
    const request = {
      ...scope,
      method: "get",
      path: "/api/v1/report_all/daily_closing",
      params: { date_from: "2026-09-01", date_to: "2026-09-01" },
    };
    await cacheBrowserApiResponse({ ...request, response: { total: 4200 }, source: "ONLINE" }, store);

    expect(await readBrowserApiFallback(request, store)).toEqual({ total: 4200 });
  });

  it("round-trips a cached table grid for Android — the page it backs is now read-only reachable", async () => {
    const store = new MemoryBrowserOfflineStore();
    const request = {
      ...scope,
      method: "get",
      path: "/api/v1/posAll/fetch_table",
      params: { branch_uuid_fk: scope.branchUuid, zone_uuid: "", lang: "la" },
    };
    await cacheBrowserApiResponse({ ...request, response: { tables: [] }, source: "ONLINE" }, store);

    expect(await readBrowserApiFallback(request, store)).toEqual({ tables: [] });
  });

  it("serves fetch_cart now that /pos/order can stage real writes on Android, but still refuses the public QR queue", async () => {
    expect(isSafeBrowserCacheFallback("/api/v1/posAll/fetch_cart")).toBe(true);
    // customer_order_queue belongs to the public QR ordering flow, not this one.
    expect(isSafeBrowserCacheFallback("/api/v1/posAll/customer_order_queue")).toBe(false);

    const store = new MemoryBrowserOfflineStore();
    const request = { ...scope, method: "get", path: "/api/v1/posAll/fetch_cart", params: {} };
    await cacheBrowserApiResponse({ ...request, response: { orders: [] }, source: "ONLINE" }, store);
    expect(await readBrowserApiFallback(request, store)).toEqual({ orders: [] });
  });
});

// Android has no Local Agent, so apiRequest reads its offline data straight from
// the Dexie mirror instead of going through requestLocalFallback.
describe("agent-free offline reads", () => {
  // readBrowserOfflineCache is client-only and bails out without `window`.
  beforeEach(() => vi.stubGlobal("window", {}));
  afterEach(() => vi.unstubAllGlobals());

  it("serves a cached report read with no Local Agent in the path", async () => {
    const store = new MemoryBrowserOfflineStore();
    const request = {
      ...scope,
      method: "get",
      path: "/api/v1/report_all/sale_list",
      params: { date_from: "2026-09-01", date_to: "2026-09-04" },
    };
    await cacheBrowserApiResponse({ ...request, response: { bills: [{ total: 90 }] }, source: "ONLINE" }, store);

    const agentCalls: unknown[] = [];
    vi.spyOn(axios, "post").mockImplementation(async (...args) => {
      agentCalls.push(args);
      throw new Error("Local Agent must not be contacted");
    });

    await expect(
      readBrowserOfflineCache("get", "/api/v1/report_all/sale_list?date_from=2026-09-01&date_to=2026-09-04", undefined, scope, store),
    ).resolves.toEqual({ bills: [{ total: 90 }] });
    expect(agentCalls).toHaveLength(0);
  });

  it("returns null when nothing is cached, so the network error surfaces", async () => {
    const store = new MemoryBrowserOfflineStore();
    await expect(
      readBrowserOfflineCache("get", "/api/v1/report_all/daily_closing", undefined, scope, store),
    ).resolves.toBeNull();
  });

  it("never serves a route that is not a cacheable read", async () => {
    const store = new MemoryBrowserOfflineStore();
    await expect(
      readBrowserOfflineCache("post", "/api/v1/posAll/create_order", { data: { a: 1 } }, scope, store),
    ).resolves.toBeNull();
  });

  it("answers an empty cart for a table that has never been opened, instead of surfacing an error", async () => {
    // Online, opening a fresh table is just an empty cart — nothing has ever
    // been cached for it offline either, so this must not fall through to
    // the raw network error the way every other cacheable GET does on a miss.
    const store = new MemoryBrowserOfflineStore();
    const response = await readBrowserOfflineCache(
      "get",
      "/api/v1/posAll/fetch_cart",
      { params: { table_uuid: "table-never-opened" } },
      scope,
      store,
    ) as { status: string; orders: unknown[] };
    expect(response.status).toBe("success");
    expect(response.orders).toEqual([]);
  });

  it("overlays a staged offline order on top of an empty cached cart", async () => {
    const store = new MemoryBrowserOfflineStore();
    await cacheBrowserApiResponse({
      ...scope,
      method: "get",
      path: "/api/v1/posAll/fetch_cate_products",
      params: {},
      response: {
        data: [{
          cate_uuid: "cate-1",
          products: [{
            prod_uuid: "prod-1",
            prod_name: "Fried rice",
            pro_detail_uuid: "detail-1",
            pro_detail_sprice: 15000,
          }],
        }],
      },
      source: "ONLINE",
    }, store);
    await stageBrowserSyncRequest({
      eventUuid: "evt-cart-overlay",
      ...scope,
      actorLoginUuid: "login-1",
      method: "post",
      path: "/api/v1/posAll/create_order",
      params: {},
      data: {
        order_uuid: "order-new",
        table_uuid_fk: "table-1",
        branch_uuid_fk: scope.branchUuid,
        order_service_rate: 0,
        order_vat_rate: 0,
        order_vat_status: 1,
        items: [{ order_it_uuid: "item-1", prod_detail_uuid_fk: "detail-1", order_it_qty: 1, order_it_status: 1 }],
      },
    }, store);

    const response = await readBrowserOfflineCache(
      "get",
      "/api/v1/posAll/fetch_cart",
      { params: { table_uuid: "table-1" } },
      scope,
      store,
    ) as { orders: Array<{ order_uuid: string; items: unknown[] }> };
    expect(response.orders[0]?.order_uuid).toBe("order-new");
    expect(response.orders[0]?.items).toHaveLength(1);
  });

  it("synthesizes get_prod_item from cached category-listing data when this exact product was never individually opened online", async () => {
    // Opening any table's menu already caches fetch_cate_products for every
    // product in it — a cashier should not have to have also tapped this
    // specific product online once before an outage for a plain, no-options
    // item to still be addable offline.
    const store = new MemoryBrowserOfflineStore();
    await cacheBrowserApiResponse({
      ...scope,
      method: "get",
      path: "/api/v1/posAll/fetch_cate_products",
      params: {},
      response: {
        data: [{
          cate_uuid: "cate-1",
          products: [{
            prod_uuid: "prod-1",
            prod_name: "Fried rice",
            prod_image: "rice.png",
            prod_status_imge: 1,
            pro_detail_uuid: "detail-1",
            pro_detail_sprice: 15000,
          }],
        }],
      },
      source: "ONLINE",
    }, store);

    const response = await readBrowserOfflineCache(
      "post",
      "/api/v1/posAll/get_prod_item",
      { data: { prod_uuid: "prod-1", lang: "en" } },
      scope,
      store,
    ) as { status: string; data: { prod_uuid: string; details: Array<{ pro_detail_uuid: string }> } };

    expect(response.status).toBe("success");
    expect(response.data.prod_uuid).toBe("prod-1");
    expect(response.data.details).toEqual([expect.objectContaining({ pro_detail_uuid: "detail-1" })]);
  });

  it("still returns null for get_prod_item when no cached category listing ever mentioned this product", async () => {
    const store = new MemoryBrowserOfflineStore();
    await expect(
      readBrowserOfflineCache(
        "post",
        "/api/v1/posAll/get_prod_item",
        { data: { prod_uuid: "never-seen", lang: "en" } },
        scope,
        store,
      ),
    ).resolves.toBeNull();
  });
});

describe("browser mirror read-back window", () => {
  const HOUR_MS = 60 * 60 * 1000;

  async function readAfter(ageHours: number) {
    const store = new MemoryBrowserOfflineStore();
    const request = {
      ...scope,
      method: "get",
      path: "/api/v1/report_all/daily_closing",
      params: { date: "2026-09-04" },
    };
    await cacheBrowserApiResponse({ ...request, response: { total: 4495000 }, source: "ONLINE" }, store);
    for (const entry of store.apiCache.values()) {
      store.apiCache.set(entry.key, { ...entry, cachedAt: Date.now() - ageHours * HOUR_MS });
    }
    return readBrowserApiFallback(request, store);
  }

  it("serves takings cached within the window", async () => {
    await expect(readAfter(47)).resolves.toEqual({ total: 4495000 });
  });

  it("refuses takings older than the window rather than showing them as current", async () => {
    await expect(readAfter(49)).resolves.toBeNull();
    await expect(readAfter(24 * 30)).resolves.toBeNull();
  });
});

// A 404 from the Agent has two meanings, and only one of them is safe to
// recover by re-sending. Getting this wrong is what turned one promotion
// conflict into eight blocked events and five items the server never saw.
describe("an event the Agent no longer has", () => {
  // This block needs its own cleanup: the afterEach above is scoped to the first
  // describe, so without this a spy stays installed and carries its call history
  // into the next case.
  afterEach(() => vi.restoreAllMocks());

  const ORDER_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  async function stageOrderCreate(store: MemoryBrowserOfflineStore, uuid: string) {
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid: uuid,
      method: "post",
      path: "/api/v1/posAll/create_order",
      data: { sync_event_uuid: uuid, order_uuid: ORDER_UUID },
    }, store);
  }

  function agentMissing() {
    return vi.spyOn(axios, "get").mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
  }

  it("re-sends one the Agent never acknowledged", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageOrderCreate(store, eventUuid);
    // stageBrowserSyncRequest leaves STAGED: the Agent never replied, so this id
    // has never been used anywhere and re-sending is the recovery it exists for.
    expect((await store.getSyncQueue(eventUuid))?.status).toBe("STAGED");
    agentMissing();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await reconcileBrowserSyncQueue(scope, store);

    expect(post).toHaveBeenCalledWith(
      expect.stringContaining("/local/api"),
      expect.objectContaining({ event_uuid: eventUuid }),
      { timeout: 10000 },
    );
    expect((await store.getSyncQueue(eventUuid))?.status).toBe("PENDING");
  });

  it("never re-sends one the Agent already accepted", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageOrderCreate(store, eventUuid);
    // PENDING means the Agent took it and may already have pushed it to Backend.
    await updateBrowserSyncEvent(eventUuid, { status: "PENDING" }, store);
    agentMissing();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await reconcileBrowserSyncQueue(scope, store);

    // Re-sending would mint a fresh invoice, stock event and sequence under an id
    // Backend already holds, which it rejects forever as a payload mismatch.
    expect(post).not.toHaveBeenCalled();
    const entry = await store.getSyncQueue(eventUuid);
    expect(entry?.status).toBe("BLOCKED");
    expect(entry?.lastError).toBe("BROWSER_SYNC_EVENT_MISSING_ON_AGENT");
    // The order is kept, not discarded, and no replacement id is minted.
    expect((entry?.data as { order_uuid?: string })?.order_uuid).toBe(ORDER_UUID);
    expect(entry?.eventUuid).toBe(eventUuid);
  });

  it.each(["PROCESSING", "FAILED"] as const)(
    "never re-sends one last seen as %s either",
    async (status) => {
      const store = new MemoryBrowserOfflineStore();
      await stageOrderCreate(store, eventUuid);
      await updateBrowserSyncEvent(eventUuid, { status }, store);
      agentMissing();
      const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

      await reconcileBrowserSyncQueue(scope, store);

      expect(post).not.toHaveBeenCalled();
      expect((await store.getSyncQueue(eventUuid))?.status).toBe("BLOCKED");
    },
  );

  it("keeps a business conflict a business conflict across a reconcile", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageOrderCreate(store, eventUuid);
    // Backend rejected this on its merits — an expired promotion — and the Agent
    // recorded that verdict. It must not come back as a payload mismatch.
    await updateBrowserSyncEvent(eventUuid, {
      status: "BLOCKED",
      lastError: "ໂປຣໝົດອາຍຸ/ບໍ່ຢູ່ໃນເວລາ",
    }, store);
    const get = agentMissing();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await reconcileBrowserSyncQueue(scope, store);

    expect(post).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    const entry = await store.getSyncQueue(eventUuid);
    expect(entry?.status).toBe("BLOCKED");
    expect(entry?.lastError).toBe("ໂປຣໝົດອາຍຸ/ບໍ່ຢູ່ໃນເວລາ");
  });

  it("does not drag the rest of the bill down with it", async () => {
    const store = new MemoryBrowserOfflineStore();
    const parent = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const child = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    await stageOrderCreate(store, parent);
    await updateBrowserSyncEvent(parent, { status: "PENDING" }, store);
    await stageBrowserSyncRequest({
      ...scope,
      eventUuid: child,
      method: "patch",
      path: "/api/v1/posAll/confirm_to_kitchen",
      data: { sync_event_uuid: child, order_uuid: ORDER_UUID },
    }, store);

    agentMissing();
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true, data: {} } });

    await reconcileBrowserSyncQueue(scope, store);

    // The parent is held for review; the child, which the Agent never took, is
    // still recoverable on its own id rather than blocked by association.
    expect((await store.getSyncQueue(parent))?.status).toBe("BLOCKED");
    expect((await store.getSyncQueue(child))?.status).toBe("PENDING");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining("/local/api"),
      expect.objectContaining({ event_uuid: child }),
      { timeout: 10000 },
    );
  });
});

describe("pushing a staged create_order to Backend never sends a discarded order_uuid", () => {
  // pushBrowserSyncQueue needs a registered device identity, read from
  // window.localStorage (device-registration.ts) — no jsdom in this project,
  // so a minimal stand-in is enough for that one call.
  class MemoryLocalStorage {
    private readonly data = new Map<string, string>();
    getItem(key: string) {
      return this.data.has(key) ? this.data.get(key)! : null;
    }
    setItem(key: string, value: string) {
      this.data.set(key, value);
    }
  }

  beforeEach(() => {
    const storage = new MemoryLocalStorage();
    storage.setItem(
      "yummy-go:offline-sync-device",
      JSON.stringify({ deviceCode: "android-test", agentSecret: "a".repeat(32) }),
    );
    // onlineApiBase() (offline-sync.ts) falls back to window.location.origin
    // when NEXT_PUBLIC_BASE_URL isn't set — needs more than bare localStorage.
    vi.stubGlobal("window", { localStorage: storage, location: { origin: "https://yummy-go.com" } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rewrites a retargeted create_order's order_uuid to the table's real open order before pushing", async () => {
    // Mirrors the real scenario: the table already had a real online order,
    // then one item was added offline — order-state.ts's ORDER_CREATE handler
    // retargets it locally onto the real order, but prepareOfflineRequest's
    // own stamped order_uuid ("order-tap-offline", never real) is still what
    // sits in the Dexie-staged payload. Backend's offline-sync path rejects a
    // create whose order_uuid disagrees with the table's actual open order
    // (SYNC_OPEN_ORDER_CONFLICT) — sending the stamped value unchanged would
    // silently drop this item the moment the device reconnects.
    const store = new MemoryBrowserOfflineStore();
    await cacheBrowserApiResponse({
      ...scope,
      method: "get",
      path: "/api/v1/posAll/fetch_cart",
      params: { table_uuid: "table-1" },
      response: {
        status: "success",
        orders: [{
          order_uuid: "order-online",
          table_uuid_fk: "table-1",
          items: [{
            order_item_uuid: "item-online",
            order_it_uuid: "item-online",
            pro_detail_uuid: "detail-1",
            detail: { order_it_qty: 1, order_it_status: 1 },
          }],
        }],
      },
      source: "ONLINE",
    }, store);
    await stageBrowserSyncRequest({
      eventUuid: "evt-push-retarget",
      ...scope,
      method: "post",
      path: "/api/v1/posAll/create_order",
      params: {},
      data: {
        order_uuid: "order-tap-offline",
        table_uuid_fk: "table-1",
        branch_uuid_fk: scope.branchUuid,
        order_service_rate: 0,
        order_vat_rate: 0,
        order_vat_status: 1,
        items: [{ order_it_uuid: "item-offline", prod_detail_uuid_fk: "detail-1", order_it_qty: 1, order_it_status: 1 }],
      },
    }, store);

    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { results: [{ event_uuid: "evt-push-retarget", status: "SYNCED" }] } },
    });

    await pushBrowserSyncQueue(scope, store);

    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0][1] as { events: Array<{ payload: { request: { data: Record<string, unknown> } } }> };
    expect(body.events[0].payload.request.data.order_uuid).toBe("order-online");
  });

  it("leaves a genuinely new order's order_uuid untouched", async () => {
    const store = new MemoryBrowserOfflineStore();
    await stageBrowserSyncRequest({
      eventUuid: "evt-push-new",
      ...scope,
      method: "post",
      path: "/api/v1/posAll/create_order",
      params: {},
      data: {
        order_uuid: "order-brand-new",
        table_uuid_fk: "table-2",
        branch_uuid_fk: scope.branchUuid,
        order_service_rate: 0,
        order_vat_rate: 0,
        order_vat_status: 1,
        items: [{ order_it_uuid: "item-first", prod_detail_uuid_fk: "detail-1", order_it_qty: 1, order_it_status: 1 }],
      },
    }, store);

    const post = vi.spyOn(axios, "post").mockResolvedValue({
      data: { data: { results: [{ event_uuid: "evt-push-new", status: "SYNCED" }] } },
    });

    await pushBrowserSyncQueue(scope, store);

    const body = post.mock.calls[0][1] as { events: Array<{ payload: { request: { data: Record<string, unknown> } } }> };
    expect(body.events[0].payload.request.data.order_uuid).toBe("order-brand-new");
  });
});
