import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  reconcileBrowserSyncQueue,
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

  it("never serves a stale browser snapshot as a current transaction", async () => {
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

    await expect(readBrowserApiFallback(request, store)).resolves.toBeNull();
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

  it("still refuses POS pages Android cannot use offline", async () => {
    // /pos/tables and /pos/order are blocked on Android because their writes need
    // the Local Agent; serving their reads from cache would only look usable.
    for (const api of [
      "/api/v1/posAll/fetch_table",
      "/api/v1/posAll/fetch_cart",
      "/api/v1/posAll/customer_order_queue",
    ]) {
      expect(isSafeBrowserCacheFallback(api)).toBe(false);
    }

    const store = new MemoryBrowserOfflineStore();
    const request = { ...scope, method: "get", path: "/api/v1/posAll/fetch_table", params: {} };
    await cacheBrowserApiResponse({ ...request, response: { tables: [] }, source: "ONLINE" }, store);
    expect(await readBrowserApiFallback(request, store)).toBeNull();
  });
});
