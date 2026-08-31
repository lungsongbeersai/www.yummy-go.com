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
  readBrowserApiFallback,
  stageBrowserSyncRequest,
  updateBrowserSyncEvent,
  type BrowserApiCacheEntry,
  type BrowserOfflineScope,
  type BrowserOfflineStore,
  type BrowserSyncQueueEntry,
  type BrowserSyncStatusEntry,
} from "@/services/offline-db";
import { reconcileBrowserSyncQueue, requestLocalFallback } from "@/services/offline-sync";

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

  async pruneApiCache(maxEntries: number) {
    const oldest = [...this.apiCache.values()].sort((left, right) => left.cachedAt - right.cachedAt);
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

  async pruneSyncedQueue(updatedBefore: number) {
    for (const entry of this.syncQueue.values()) {
      if (entry.status === "SYNCED" && entry.updatedAt < updatedBefore) {
        this.syncQueue.delete(entry.eventUuid);
      }
    }
  }
}

const scope = { storeUuid: "store-1", branchUuid: "branch-1", actorLoginUuid: "login-1" };
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
});
