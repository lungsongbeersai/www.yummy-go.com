import { afterEach, describe, expect, it, vi } from "vitest";
import { createMobileMenuPreparer } from "./offline-menu";
import { browserApiCacheEvictionKeys, browserApiCacheKey, cacheBrowserApiResponse, type BrowserApiCacheEntry, type BrowserOfflineStore, type BrowserSyncQueueEntry, type BrowserSyncStatusEntry } from "./offline-db";
import { readBrowserOfflineCache } from "./offline-sync";
import { retainPendingBrowserItemSnapshots, synthesizeOfflineWrite, type OfflineCartResponse } from "./offline-order";

const scope = { storeUuid: "store-1", branchUuid: "branch-1", actorLoginUuid: "cashier-1" };
const MENU = "/api/v1/posAll/fetch_cate_products";
const PRODUCT = "/api/v1/posAll/get_prod_item";
const image = (id: string) => `https://cdn.example.test/uploaded/products/${id}.png`;
const item = (id: string) => ({ prod_uuid: id, prod_name: `Product ${id}`, prod_status_imge: 1, prod_image: image(id), has_options: true });

function memoryStore() {
  const api = new Map<string, BrowserApiCacheEntry>();
  const queue = new Map<string, BrowserSyncQueueEntry>();
  const statuses = new Map<string, BrowserSyncStatusEntry>();
  const store: BrowserOfflineStore = {
    getApiCache: async (key) => api.get(key),
    putApiCache: async (entry) => { api.set(entry.key, structuredClone(entry)); },
    pruneApiCache: async (scope, max) => {
      const entries = [...api.values()].filter((e) => e.storeUuid === scope.storeUuid && e.branchUuid === scope.branchUuid);
      for (const key of browserApiCacheEvictionKeys(entries, max)) api.delete(key);
    },
    listApiCacheByPath: async (scope, path) => [...api.values()].filter((e) => e.storeUuid === scope.storeUuid && e.branchUuid === scope.branchUuid && e.path === path),
    getSyncQueue: async (key) => queue.get(key),
    putSyncQueue: async (entry) => { queue.set(entry.eventUuid, structuredClone(entry)); },
    deleteSyncQueue: async (key) => { queue.delete(key); },
    listSyncQueue: async (scope) => [...queue.values()].filter((e) => e.storeUuid === scope.storeUuid && e.branchUuid === scope.branchUuid),
    getSyncStatus: async (key) => statuses.get(key),
    putSyncStatus: async (entry) => { statuses.set(entry.scopeKey, entry); },
    pruneSyncedQueue: async () => undefined,
  };
  return { store, api, queue };
}

function setup() {
  const storage = memoryStore();
  let currentScope = scope;
  const warmImage = vi.fn().mockResolvedValue(true);
  const cached = vi.fn<Parameters<typeof createMobileMenuPreparer>[0]["cached"]>((input) => storage.store.getApiCache(browserApiCacheKey(input)));
  const request = vi.fn<Parameters<typeof createMobileMenuPreparer>[0]["request"]>(async (method, path, options) => {
    let response: unknown;
    if (method === "get" && path === MENU) {
      const selected = options.params?.cate_uuid ?? "category-1";
      response = { status: "success", default_cate_uuid: "category-1", data: [1, 2].map((n) => ({
        cate_uuid: `category-${n}`, cate_name: `Category ${n}`,
        products: selected === `category-${n}` && options.params?.status_sort_fk === 1 ? [item(`product-${n}`)] : [],
      })) };
    } else if (method === "post" && path === PRODUCT) {
      const id = (options.data as { prod_uuid: string }).prod_uuid;
      response = { status: "success", data: { ...item(id), prod_topping_max_select: 2,
        details: [{ pro_detail_uuid: `${id}-small`, size_name: "Small", price: 20000, pro_detail_enabled: 1, cut_stock: 2 },
          { pro_detail_uuid: `${id}-large`, size_name: "Large", price: 35000, pro_detail_enabled: 1, cut_stock: 2 }],
        toppings: [{ prod_topping_uuid: `${id}-egg`, topping_name: "Egg", topping_price: 5000, topping_status: 1 }] } };
    } else throw new Error("Not a menu read");
    await cacheBrowserApiResponse({ ...currentScope, method, path, ...options, response,
      source: "ONLINE", retainForOfflineMenu: true, preservePendingOrderCache: true }, storage.store);
    return response;
  });
  const prepare = createMobileMenuPreparer({ request, cached, warmImage, now: Date.now });
  return { ...storage, prepare, request, cached, warmImage, setScope: (next: typeof scope) => { currentScope = next; } };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("native offline menu preparation", () => {
  it.each([false, true])("does not reprice an existing draft when the menu refreshes (legacy: %s)", async (legacy) => {
    vi.stubGlobal("window", {});
    const ctx = setup();
    await ctx.prepare(scope, "la", () => true);
    const data = { order_uuid: "draft", table_uuid_fk: "T03", branch_uuid_fk: scope.branchUuid,
      items: [{ order_it_uuid: "old-line", prod_detail_uuid_fk: "product-2-large", order_it_qty: 1,
        toppings: [{ prod_topping_uuid_fk: "product-2-egg", topping_qty: 1 }] }] };
    await synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", { data }, "draft-event", scope, ctx.store);
    const original = structuredClone(ctx.queue.get("draft-event")!);
    if (legacy) {
      delete ctx.queue.get("draft-event")!.localItemSnapshots;
      await retainPendingBrowserItemSnapshots(scope, ctx.store);
    }
    expect(ctx.queue.get("draft-event")).toMatchObject({ data: original.data, status: original.status,
      requestFingerprint: original.requestFingerprint, createdAt: original.createdAt, updatedAt: original.updatedAt });
    for (const cached of ctx.api.values()) {
      if (cached.path !== PRODUCT) continue;
      const response = cached.response as { data: { prod_name: string; details: Array<{ price: number }>; toppings: Array<{ topping_price: number }> } };
      response.data.prod_name = "New menu name";
      response.data.details.forEach((d) => { d.price = 99000; });
      response.data.toppings.forEach((t) => { t.topping_price = 7000; });
    }
    const restored = await readBrowserOfflineCache<OfflineCartResponse>("get", "/api/v1/posAll/fetch_cart", { params: { table_uuid: "T03" } }, scope, ctx.store);
    expect(restored?.orders[0].items[0]).toMatchObject({ title: "Product product-2", detail: { unit_price: 35000, topping_unit_total: 5000 } });
    expect(restored?.orders[0].sum_grand_total).toBe(40000);
    const next = await synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", { data: { ...data,
      items: [{ ...data.items[0], order_it_uuid: "new-line" }] } }, "next-event", scope, ctx.store) as OfflineCartResponse;
    expect(next.orders[0].items).toHaveLength(2);
    expect(next.orders[0].sum_grand_total).toBe(146000);
  });

  it("prepares every category/sort and full options before any product is tapped, then adds the selected option offline", async () => {
    vi.stubGlobal("window", {});
    const ctx = setup();
    await expect(ctx.prepare(scope, "la", () => true)).resolves.toMatchObject({ complete: true, products: 2, failedImages: 0 });
    expect(ctx.request).toHaveBeenCalledTimes(9); // initial catalog + 2 categories x 3 sorts + 2 products
    expect(ctx.warmImage).toHaveBeenCalledTimes(2);
    const options = await readBrowserOfflineCache("post", PRODUCT, { data: { prod_uuid: "product-2", lang: "la" } }, scope, ctx.store);
    expect(options).toMatchObject({ data: { details: [expect.objectContaining({ size_name: "Small" }), expect.objectContaining({ size_name: "Large" })],
      toppings: [expect.objectContaining({ topping_name: "Egg" })], prod_topping_max_select: 2 } });
    const order = await synthesizeOfflineWrite("post", "/api/v1/posAll/create_order", { data: {
      order_uuid: "order-offline", table_uuid_fk: "T03", branch_uuid_fk: scope.branchUuid,
      items: [{ order_it_uuid: "line-1", prod_detail_uuid_fk: "product-2-large", order_it_qty: 1,
        toppings: [{ prod_topping_uuid_fk: "product-2-egg", topping_qty: 1 }] }],
    } }, "event-offline", scope, ctx.store) as OfflineCartResponse;
    expect(order.orders[0].items[0]).toMatchObject({ title: "Product product-2", prod_image: image("product-2"),
      detail: { size_name: "Large", unit_price: 35000, topping_unit_total: 5000, net_total: 40000 },
      toppings: [expect.objectContaining({ topping_name: "Egg" })] });
    const restored = await readBrowserOfflineCache<OfflineCartResponse>("get", "/api/v1/posAll/fetch_cart", { params: { table_uuid: "T03", lang: "la" } }, scope, ctx.store);
    expect(restored?.orders[0].sum_grand_total).toBe(40000);
    expect(restored?.orders[0].items[0].prod_image).toBe(image("product-2"));
  });

  it("uses exact offline UI request keys for all categories and isolates branches/languages", async () => {
    vi.stubGlobal("window", {});
    const ctx = setup();
    await ctx.prepare(scope, "en", () => true);
    const options = { params: { branch_uuid_fk: scope.branchUuid, cate_uuid: "category-2", status_sort_fk: 3, search: "", lang: "eng" } };
    await expect(readBrowserOfflineCache("get", MENU, options, scope, ctx.store)).resolves.toMatchObject({ status: "success" });
    await expect(readBrowserOfflineCache("get", MENU, options, { ...scope, branchUuid: "other" }, ctx.store)).resolves.toBeNull();
    await expect(readBrowserOfflineCache("get", MENU, { params: { ...options.params, lang: "la" } }, scope, ctx.store)).resolves.toBeNull();
  });

  it("is single-flight, bounded to two reads, and does not reload a recently prepared menu every sync tick", async () => {
    const ctx = setup();
    const request = ctx.request.getMockImplementation()!;
    let inFlight = 0;
    let peak = 0;
    ctx.request.mockImplementation(async (...args) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      try { await Promise.resolve(); return await request(...args); }
      finally { inFlight--; }
    });
    const first = ctx.prepare(scope, "la", () => true);
    const second = ctx.prepare(scope, "la", () => true);
    expect(second).toBe(first);
    await first;
    expect(peak).toBe(2);
    const count = ctx.request.mock.calls.length;
    await ctx.prepare(scope, "la", () => true);
    expect(ctx.request).toHaveBeenCalledTimes(count);
  });

  it("stops launching work on disconnect/logout and can resume without clearing cached data", async () => {
    const ctx = setup();
    let active = true;
    ctx.request.mockImplementationOnce(async () => { active = false; return { status: "success", data: [] }; });
    await expect(ctx.prepare(scope, "la", () => active)).resolves.toMatchObject({ complete: false });
    expect(ctx.request).toHaveBeenCalledOnce();
    active = true;
    await expect(ctx.prepare(scope, "la", () => active)).resolves.toMatchObject({ complete: true, products: 2 });
  });

  it("does not claim readiness if successful HTTP data was not saved to Dexie", async () => {
    const ctx = setup();
    ctx.request.mockResolvedValue({ status: "success", data: [] });
    await expect(ctx.prepare(scope, "la", () => true)).resolves.toMatchObject({ complete: false, failedRequests: 1 });
    expect(ctx.api.size).toBe(0);
  });

  it("retries a failed option read without dropping already prepared products or accepting a fake single option", async () => {
    vi.stubGlobal("window", {});
    vi.useFakeTimers();
    const ctx = setup();
    const request = ctx.request.getMockImplementation()!;
    ctx.request.mockImplementation(async (...args) => {
      if (args[1] === PRODUCT && (args[2].data as { prod_uuid: string }).prod_uuid === "product-2") throw new Error("network");
      return request(...args);
    });
    await expect(ctx.prepare(scope, "la", () => true)).resolves.toMatchObject({ complete: false, products: 1, failedRequests: 1 });
    await expect(readBrowserOfflineCache("post", PRODUCT, { data: { prod_uuid: "product-2", lang: "la" } }, scope, ctx.store)).resolves.toBeNull();
    const first = await readBrowserOfflineCache("post", PRODUCT, { data: { prod_uuid: "product-1", lang: "la" } }, scope, ctx.store);
    expect(first).toMatchObject({ data: { details: expect.any(Array) } });
    ctx.request.mockImplementation(request);
    vi.advanceTimersByTime(30_001);
    await expect(ctx.prepare(scope, "la", () => true)).resolves.toMatchObject({ complete: true, products: 2 });
    await expect(readBrowserOfflineCache("post", PRODUCT, { data: { prod_uuid: "product-1", lang: "la" } }, scope, ctx.store)).resolves.toEqual(first);
  });

  it("retries incomplete preparation, preserves earlier records, and does not let one failed image stop the others", async () => {
    vi.useFakeTimers();
    const ctx = setup();
    ctx.warmImage.mockResolvedValueOnce(false);
    await expect(ctx.prepare(scope, "la", () => true)).resolves.toMatchObject({ complete: false, failedImages: 1, products: 2 });
    const count = ctx.request.mock.calls.length;
    vi.advanceTimersByTime(30_001);
    await expect(ctx.prepare(scope, "la", () => true)).resolves.toMatchObject({ complete: true });
    expect(ctx.request).toHaveBeenCalledTimes(count); // completed product reads remain usable
  });
});
