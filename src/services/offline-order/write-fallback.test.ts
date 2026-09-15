import { afterEach, describe, expect, it, vi } from "vitest";
import * as offlineDb from "@/services/offline-db";
import { cacheOnlineResponse } from "@/services/offline-sync";
import type {
  BrowserApiCacheEntry,
  BrowserOfflineScope,
  BrowserOfflineStore,
  BrowserPrintJobEntry,
  BrowserSyncQueueEntry,
  BrowserSyncStatusEntry,
} from "@/services/offline-db";
import { loadOfflineMasterIndex, loadOfflineOrderState, synthesizeOfflineWrite } from "./write-fallback";
import { projectOfflineCart, type OfflineCartResponse } from "./cart-projection";

const SCOPE = { storeUuid: "store-1", branchUuid: "branch-1", actorLoginUuid: "login-1" };
const TABLE = "77777777-7777-4777-8777-777777777777";
const DETAIL = "55555555-5555-4555-8555-555555555555";
const PRODUCT = "44444444-4444-4444-8444-444444444444";
const ORDER = "10000000-0000-4000-8000-000000000001";

class MemoryBrowserOfflineStore implements BrowserOfflineStore {
  readonly apiCache = new Map<string, BrowserApiCacheEntry>();
  readonly syncQueue = new Map<string, BrowserSyncQueueEntry>();
  readonly syncStatus = new Map<string, BrowserSyncStatusEntry>();
  readonly printQueue = new Map<string, BrowserPrintJobEntry>();

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

  async getPrintJob(printJobUuid: string) {
    return this.printQueue.get(printJobUuid);
  }

  async putPrintJob(entry: BrowserPrintJobEntry) {
    this.printQueue.set(entry.printJobUuid, entry);
  }

  async listPrintJobs(scope: BrowserOfflineScope) {
    return [...this.printQueue.values()].filter((entry) =>
      entry.storeUuid === scope.storeUuid && entry.branchUuid === scope.branchUuid);
  }

  async deletePrintJob(printJobUuid: string) {
    this.printQueue.delete(printJobUuid);
  }
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

async function seedOfflinePricing(
  store: MemoryBrowserOfflineStore,
  values: { vatStatus?: number; vatRate?: number; chargeStatus?: number; chargeRate?: number; tableChargeStatus?: number } = {},
) {
  const now = Date.now();
  await store.putApiCache({
    key: "branch-pricing",
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    method: "GET",
    path: "/api/v1/branch/fetch_all",
    requestFingerprint: "",
    source: "ONLINE",
    cachedAt: now,
    response: { data: [{
      branch_uuid: SCOPE.branchUuid,
      vat_status: values.vatStatus ?? 1,
      vat_name: values.vatRate ?? 0,
      charge_status: values.chargeStatus ?? 2,
      charge_name: values.chargeRate ?? 0,
    }] },
  });
  await store.putApiCache({
    key: "table-pricing",
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    method: "GET",
    path: "/api/v1/table/fetch_all",
    requestFingerprint: "",
    source: "ONLINE",
    cachedAt: now,
    response: { data: [{ table_uuid: TABLE, charge_status: values.tableChargeStatus ?? 1 }] },
  });
}

async function seedMobileCheckout(store: MemoryBrowserOfflineStore, roleCode: "kitchen" | "receipt") {
  const now = Date.now();
  await store.putApiCache({
    key: `capability-${roleCode}`,
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    method: "GET",
    path: "/api/v1/sync/runtime-capabilities",
    requestFingerprint: "",
    source: "ONLINE",
    cachedAt: now,
    response: { data: {
      contract_version: "offline-first-v2",
      mobile: { offline_checkout_enabled: true, durable_print_queue_enabled: true },
      rollout: { branch_uuid: SCOPE.branchUuid, kill_switch_active: false },
    } },
  });
  await store.putApiCache({
    key: `printer-${roleCode}`,
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    method: "GET",
    path: "/api/v1/printer/fetch",
    requestFingerprint: "",
    source: "ONLINE",
    cachedAt: now,
    response: { data: [{
      print_config_uuid: "66666666-6666-4666-8666-666666666666",
      device_code: "android-test",
      printer_name: "Native TCP",
      connect_type: "tcp",
      interface_value: "tcp://192.168.1.50:9100",
      print_mode: "mobile_wifi",
      paper_width_mm: 80,
      is_active: true,
      role_codes: [roleCode],
      mapping_type: "CATEGORY",
      cate_uuid_fk: ["cate-1"],
    }] },
  });
  await store.putApiCache({
    key: `table-${roleCode}`,
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    method: "GET",
    path: "/api/v1/posAll/fetch_table",
    requestFingerprint: "",
    source: "ONLINE",
    cachedAt: now,
    response: { data: [{ zone_uuid: "zone-1", tables: [{ table_uuid: TABLE, table_name: "T7" }] }] },
  });
}

function seedDevice() {
  const values = new Map<string, string>();
  values.set("yummy-go:offline-sync-device", JSON.stringify({ deviceCode: "android-test", agentSecret: "s".repeat(32) }));
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
}

describe("synthesizeOfflineWrite", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("does not stage an unpriced or unnamed create when its product cache is missing", async () => {
    const store = new MemoryBrowserOfflineStore();
    await expect(synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", {
      data: { order_uuid: ORDER, table_uuid_fk: TABLE, branch_uuid_fk: SCOPE.branchUuid,
        items: [{ order_it_uuid: "missing", prod_detail_uuid_fk: DETAIL, order_it_qty: 1 }] },
    }, "missing-master", SCOPE, store)).rejects.toThrow();
    expect(store.syncQueue.size).toBe(0);
  });

  it("never returns success when IndexedDB and its durable outbox are unavailable", async () => {
    await expect(synthesizeOfflineWrite("patch", "/api/v1/posAll/update_note",
      { data: { order_item_uuid: "item-1", order_it_note: "test" } }, "no-database", SCOPE)).rejects.toThrow();
  });

  it.each(["payment", "confirm_to_kitchen"])("does not stage %s without a native durable print implementation", async (route) => {
    const store = new MemoryBrowserOfflineStore();
    await expect(synthesizeOfflineWrite(route === "payment" ? "post" : "patch", `/api/v1/posAll/${route}`,
      { data: { order_uuid: ORDER } }, "not-printed", SCOPE, store)).rejects.toThrow();
    expect(store.syncQueue.size).toBe(0);
  });

  it("commits a kitchen event and its required native print job together", async () => {
    const store = new MemoryBrowserOfflineStore();
    seedDevice();
    seedCategoryCache(store);
    await seedMobileCheckout(store, "kitchen");
    await store.putApiCache({
      key: "cart-kitchen",
      storeUuid: SCOPE.storeUuid,
      branchUuid: SCOPE.branchUuid,
      method: "GET",
      path: "/api/v1/posAll/fetch_cart",
      requestFingerprint: "",
      source: "ONLINE",
      cachedAt: Date.now(),
      response: { orders: [{
        order_uuid: ORDER,
        table_uuid_fk: TABLE,
        items: [{ order_it_uuid: "item-kitchen", pro_detail_uuid: DETAIL, prod_uuid: PRODUCT,
          prod_name: "ເຂົ້າຜັດ", cate_uuid_fk: "cate-1",
          detail: { order_it_qty: 1, order_it_status: 1, unit_price: 20000 } }],
      }] },
    });

    const response = await synthesizeOfflineWrite("patch", "/api/v1/posAll/confirm_to_kitchen", {
      data: { order_uuid: ORDER, order_item_uuids: ["item-kitchen"],
        stock_event_uuids: { "item-kitchen": "88888888-8888-4888-8888-888888888888" } },
    }, "99999999-9999-4999-8999-999999999999", SCOPE, store) as Record<string, unknown>;

    expect((response.pending_query as Record<string, unknown>).print_job_uuid).toBeTruthy();
    expect(store.printQueue.size).toBe(1);
    expect(await store.getSyncQueue("99999999-9999-4999-8999-999999999999")).toMatchObject({
      status: "STAGED",
      printContractVersion: "offline-first-v2",
    });
  });

  it("preserves another cashier's queue and refuses to mix new writes into it", async () => {
    const store = new MemoryBrowserOfflineStore();
    await synthesizeOfflineWrite("patch", "/api/v1/posAll/update_note",
      { data: { order_item_uuid: "item-1", order_it_note: "test" } }, "previous", SCOPE, store);
    await expect(synthesizeOfflineWrite("patch", "/api/v1/posAll/update_note",
      { data: { order_item_uuid: "item-1", order_it_note: "other" } }, "other", { ...SCOPE, actorLoginUuid: "other" }, store)).rejects.toThrow();
    expect(store.syncQueue.size).toBe(1);
  });
  it("stages a fresh create_order and returns a fetch_cart-shaped response with the new item priced", async () => {
    const store = new MemoryBrowserOfflineStore();
    seedCategoryCache(store);
    await seedOfflinePricing(store);

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

  it("uses the cached branch/table policy for VAT and service on a new offline bill", async () => {
    const store = new MemoryBrowserOfflineStore();
    seedCategoryCache(store);
    await seedOfflinePricing(store, { vatStatus: 3, vatRate: 10, chargeStatus: 1, chargeRate: 10 });

    const response = await synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", { data: {
      order_uuid: ORDER,
      table_uuid_fk: TABLE,
      branch_uuid_fk: SCOPE.branchUuid,
      order_service_rate: 0,
      order_vat_rate: 0,
      items: [{ order_it_uuid: "priced-item", prod_detail_uuid_fk: DETAIL, order_it_qty: 1, order_it_status: 1 }],
    } }, "priced-event", SCOPE, store) as OfflineCartResponse;

    expect(response.orders[0]).toMatchObject({
      service_charge_rate: 10,
      vat_rate: 10,
      vat_status: 3,
      sum_service_total: 2000,
      sum_vat_total: 2000,
      sum_grand_total: 24000,
    });
    expect((await store.getSyncQueue("priced-event"))?.data).toMatchObject({
      order_service_rate: 10,
      order_vat_rate: 10,
      order_vat_status: 3,
    });
  });

  it("fails closed when a new offline bill has no prepared sale policy", async () => {
    const store = new MemoryBrowserOfflineStore();
    seedCategoryCache(store);
    await expect(synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", { data: {
      order_uuid: ORDER,
      table_uuid_fk: TABLE,
      branch_uuid_fk: SCOPE.branchUuid,
      items: [{ order_it_uuid: "no-policy", prod_detail_uuid_fk: DETAIL, order_it_qty: 1 }],
    } }, "no-policy-event", SCOPE, store)).rejects.toThrow("MOBILE_OFFLINE_PRICING_NOT_PREPARED");
    expect(store.syncQueue.size).toBe(0);
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

  it("stages a Mobile Offline delete when its item UUID is mirrored in the request body", async () => {
    const store = new MemoryBrowserOfflineStore();
    await store.putApiCache({
      key: "cart-delete",
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
          items: [{
            order_it_uuid: "item-delete",
            prod_name: "Noodle",
            pro_detail_uuid: DETAIL,
            detail: {
              order_it_qty: 1,
              order_it_status: 1,
              unit_price: 20_000,
              gross_total: 20_000,
            },
          }],
        }],
      },
    });

    const response = await synthesizeOfflineWrite(
      "delete",
      "/api/v1/posAll/delete_order_item",
      {
        params: { order_it_uuid: "item-delete" },
        data: { order_it_uuid: "item-delete" },
      },
      "evt-delete",
      SCOPE,
      store,
    ) as OfflineCartResponse;

    expect(response.orders[0].items).toEqual([]);
    expect(await store.getSyncQueue("evt-delete")).toMatchObject({
      method: "DELETE",
      path: "/api/v1/posAll/delete_order_item",
      params: { order_it_uuid: "item-delete" },
      data: { order_it_uuid: "item-delete" },
      status: "STAGED",
    });
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

describe("mobile menu refresh followed by local add", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each(["PENDING", "BLOCKED"] as const)("warms a new product and preserves the original %s bill", async (status) => {
    const store = new MemoryBrowserOfflineStore();
    await seedOfflinePricing(store);
    const cache = offlineDb.cacheBrowserApiResponse;
    await cache({ ...SCOPE, method: "get", path: "/api/v1/posAll/fetch_cart", source: "ONLINE",
      response: { orders: [{ order_uuid: ORDER, table_uuid_fk: TABLE, items: [{
        order_it_uuid: "original-item", title: "Original item", detail: { order_it_qty: 1, unit_price: 40000, order_it_status: 1 },
      }] }] },
    }, store);
    await synthesizeOfflineWrite("patch", "/api/v1/posAll/update_note", {
      data: { order_item_uuid: "original-item", order_it_note: "keep this" },
    }, "original-event", SCOPE, store);
    await offlineDb.updateBrowserSyncEvent("original-event", { status }, store);
    const originalEvent = structuredClone(await store.getSyncQueue("original-event"));

    vi.stubGlobal("window", {});
    vi.spyOn(offlineDb, "cacheBrowserApiResponse").mockImplementation((input) => cache(input, store));
    await cacheOnlineResponse("post", "/api/v1/posAll/get_prod_item", { data: { prod_uuid: PRODUCT } }, {
      status: "success", data: { prod_uuid: PRODUCT, prod_name: "New product",
        details: [{ pro_detail_uuid: DETAIL, price: 24000 }], toppings: [] },
    }, SCOPE.branchUuid, SCOPE.storeUuid, false, Date.now());

    const data = { order_uuid: "next-create", table_uuid_fk: TABLE, branch_uuid_fk: SCOPE.branchUuid,
      items: [{ order_it_uuid: "new-item", prod_detail_uuid_fk: DETAIL, order_it_qty: 1 }] };
    const added = await synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", { data }, "new-event", SCOPE, store) as OfflineCartResponse;
    expect(added.orders[0]).toMatchObject({ order_uuid: ORDER, sum_grand_total: 64000 });
    expect(added.orders[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ order_it_uuid: "original-item", title: "Original item", detail: expect.objectContaining({ unit_price: 40000, order_it_note: "keep this" }) }),
      expect.objectContaining({ order_it_uuid: "new-item", title: "New product", detail: expect.objectContaining({ unit_price: 24000 }) }),
    ]));
    expect(await store.getSyncQueue("original-event")).toEqual(originalEvent);
    expect(await store.getSyncQueue("new-event")).toMatchObject({ data, status: "STAGED" });

    // Rebuild from durable records, not the single response returned by add.
    const restored = projectOfflineCart(await loadOfflineOrderState(SCOPE, store), { table_uuid: TABLE }, await loadOfflineMasterIndex(SCOPE, store));
    expect(restored.orders[0].items).toHaveLength(2);
    expect(restored.orders[0].sum_grand_total).toBe(64000);
  });
});
