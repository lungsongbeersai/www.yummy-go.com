import { describe, expect, it } from "vitest";
import type {
  BrowserApiCacheEntry,
  BrowserOfflineScope,
  BrowserOfflineStore,
  BrowserSyncQueueEntry,
  BrowserSyncStatusEntry,
} from "@/services/offline-db";
import { loadOfflineOrderState, synthesizeOfflineWrite } from "./write-fallback";
import type { OfflineCartResponse } from "./cart-projection";

const SCOPE = { storeUuid: "store-1", branchUuid: "branch-1", actorLoginUuid: "login-1" };
const TABLE = "77777777-7777-4777-8777-777777777777";
const DETAIL = "55555555-5555-4555-8555-555555555555";
const PRODUCT = "44444444-4444-4444-8444-444444444444";
const ORDER = "10000000-0000-4000-8000-000000000001";

class MemoryBrowserOfflineStore implements BrowserOfflineStore {
  readonly apiCache = new Map<string, BrowserApiCacheEntry>();
  readonly syncQueue = new Map<string, BrowserSyncQueueEntry>();
  readonly syncStatus = new Map<string, BrowserSyncStatusEntry>();

  async getApiCache(key: string) {
    return this.apiCache.get(key);
  }

  async putApiCache(entry: BrowserApiCacheEntry) {
    this.apiCache.set(entry.key, entry);
  }

  async pruneApiCache() {}

  async listApiCacheByPath(scope: BrowserOfflineScope, path: string) {
    return [...this.apiCache.values()].filter((entry) =>
      entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid && entry.path === path);
  }

  async getSyncQueue(eventUuid: string) {
    return this.syncQueue.get(eventUuid);
  }

  async putSyncQueue(entry: BrowserSyncQueueEntry) {
    this.syncQueue.set(entry.eventUuid, entry);
  }

  async deleteSyncQueue(eventUuid: string) {
    this.syncQueue.delete(eventUuid);
  }

  async listSyncQueue(scope: BrowserOfflineScope) {
    return [...this.syncQueue.values()]
      .filter((entry) => entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid)
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  async getSyncStatus(scopeKey: string) {
    return this.syncStatus.get(scopeKey);
  }

  async putSyncStatus(entry: BrowserSyncStatusEntry) {
    this.syncStatus.set(entry.scopeKey, entry);
  }

  async pruneSyncedQueue() {}
}

function seedCategoryCache(store: MemoryBrowserOfflineStore) {
  void store.putApiCache({
    key: "cate-1",
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    method: "POST",
    path: "/api/v1/posAll/fetch_cate_products",
    requestFingerprint: "",
    source: "ONLINE",
    cachedAt: Date.now(),
    response: {
      data: [{
        cate_uuid: "cate-1",
        products: [{
          prod_uuid: PRODUCT,
          prod_name: "ເຂົ້າຜັດ",
          prod_image: "rice.png",
          prod_status_imge: 1,
          pro_detail_uuid: DETAIL,
          pro_detail_sprice: 20000,
        }],
      }],
    },
  });
}

describe("synthesizeOfflineWrite", () => {
  it("stages a fresh create_order and returns a fetch_cart-shaped response with the new item priced", async () => {
    const store = new MemoryBrowserOfflineStore();
    seedCategoryCache(store);

    const response = await synthesizeOfflineWrite(
      "post",
      "/api/v1/posAll/create_order",
      {
        data: {
          order_uuid: ORDER,
          table_uuid_fk: TABLE,
          branch_uuid_fk: SCOPE.branchUuid,
          order_service_rate: 0,
          order_vat_rate: 0,
          order_vat_status: 1,
          items: [{
            order_it_uuid: "item-1",
            prod_detail_uuid_fk: DETAIL,
            order_it_qty: 2,
            order_it_status: 1,
          }],
        },
      },
      "evt-0001",
      SCOPE,
      store,
    ) as OfflineCartResponse;

    expect(response.status).toBe("success");
    expect(response.orders).toHaveLength(1);
    expect(response.orders[0].order_uuid).toBe(ORDER);
    expect(response.orders[0].items).toHaveLength(1);
    expect(response.orders[0].items[0].qty).toBe(2);
    expect(response.orders[0].sum_grand_total).toBe(40000);

    // The mutation is durably staged, not just reflected in this one response.
    const staged = await store.getSyncQueue("evt-0001");
    expect(staged?.path).toBe("/api/v1/posAll/create_order");
  });

  it("resolves the order from a cached fetch_cart when the mutation only carries order_item_uuid", async () => {
    const store = new MemoryBrowserOfflineStore();
    seedCategoryCache(store);
    void store.putApiCache({
      key: "cart-1",
      storeUuid: SCOPE.storeUuid,
      branchUuid: SCOPE.branchUuid,
      method: "GET",
      path: "/api/v1/posAll/fetch_cart",
      requestFingerprint: "",
      source: "ONLINE",
      cachedAt: Date.now(),
      response: {
        orders: [{
          order_uuid: ORDER,
          table_uuid_fk: TABLE,
          order_service_rate: 0,
          order_vat_rate: 0,
          order_vat_status: 1,
          order_discount_type: "",
          order_discount_value: 0,
          items: [{
            order_it_uuid: "item-1",
            pro_detail_uuid: DETAIL,
            qty: 1,
            detail: { order_it_qty: 1, order_it_status: 1 },
          }],
        }],
      },
    });

    // This bill was already open online before the connection dropped — the
    // qty-change payload below carries only order_item_uuid, never order_uuid.
    const response = await synthesizeOfflineWrite(
      "patch",
      "/api/v1/posAll/order_item/update_qty",
      { data: { order_item_uuid: "item-1", change_type: "INCREASE", change_qty: 2 } },
      "evt-0002",
      SCOPE,
      store,
    ) as OfflineCartResponse;

    expect(response.orders[0].order_uuid).toBe(ORDER);
    expect(response.orders[0].items[0].qty).toBe(3);
  });

  it("returns null for a route offline-order does not decode (table move stays Agent-only)", async () => {
    const store = new MemoryBrowserOfflineStore();
    const response = await synthesizeOfflineWrite(
      "post",
      "/api/v1/posAll/move_table",
      { data: { from_table_uuid: TABLE, to_table_uuid: "other" } },
      "evt-0003",
      SCOPE,
      store,
    );
    expect(response).toBeNull();
  });

  it("throws on a payload mismatch instead of silently applying a different mutation under the same id", async () => {
    const store = new MemoryBrowserOfflineStore();
    await synthesizeOfflineWrite(
      "patch",
      "/api/v1/posAll/update_note",
      { data: { order_item_uuid: "item-1", order_it_note: "no chili" } },
      "evt-0004",
      SCOPE,
      store,
    );
    await expect(synthesizeOfflineWrite(
      "patch",
      "/api/v1/posAll/update_note",
      { data: { order_item_uuid: "item-1", order_it_note: "extra chili" } },
      "evt-0004",
      SCOPE,
      store,
    )).rejects.toThrow("BROWSER_SYNC_EVENT_PAYLOAD_MISMATCH");
  });
});

describe("loadOfflineOrderState", () => {
  it("is empty for a scope with nothing cached or staged", async () => {
    const store = new MemoryBrowserOfflineStore();
    const state = await loadOfflineOrderState(SCOPE, store);
    expect(state.orders.size).toBe(0);
    expect(state.items.size).toBe(0);
  });
});
