import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerFetchCateProductsResponse } from "@/services/public-pos";

const publicPosMocks = vi.hoisted(() => ({
  customerFetchCateProducts: vi.fn(),
  customerGetProdItem: vi.fn()
}));

vi.mock("@/services/public-pos", () => publicPosMocks);

import {
  cachedValue,
  createPublicPosSessionCache,
  createRequestVersionTracker,
  setCachedValue,
  type CacheEntry
} from "@/stores/public-pos-store/session-cache";

const EMPTY_CATALOG_RESPONSE: CustomerFetchCateProductsResponse = {
  status: "success",
  message: "",
  categories: []
};

describe("createRequestVersionTracker", () => {
  it("increments on next() and reports the latest call as current", () => {
    const tracker = createRequestVersionTracker();
    expect(tracker.current()).toBe(0);

    const first = tracker.next();
    expect(first).toBe(1);
    expect(tracker.isCurrent(first)).toBe(true);

    const second = tracker.next();
    expect(second).toBe(2);
    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });
});

describe("cachedValue / setCachedValue", () => {
  it("returns the value before expiry and evicts it after", () => {
    const cache = new Map<string, CacheEntry<string>>();
    setCachedValue(cache, "key", "value", 1000);

    expect(cachedValue(cache, "key")).toBe("value");

    // Simulate expiry by rewriting the entry's expiresAt into the past —
    // avoids coupling the test to real/fake timers.
    cache.set("key", { ...cache.get("key")!, expiresAt: Date.now() - 1 });
    expect(cachedValue(cache, "key")).toBeNull();
    expect(cache.has("key")).toBe(false);
  });

  it("returns null for a missing key", () => {
    const cache = new Map<string, CacheEntry<string>>();
    expect(cachedValue(cache, "missing")).toBeNull();
  });
});

describe("createPublicPosSessionCache", () => {
  beforeEach(() => {
    publicPosMocks.customerFetchCateProducts.mockReset();
    publicPosMocks.customerGetProdItem.mockReset();
  });

  it("bumps the session version only when the token or language actually changes", () => {
    const cache = createPublicPosSessionCache();

    const v1 = cache.activateSession("token-1", "la");
    expect(cache.isCurrentSession(v1)).toBe(true);
    expect(cache.currentToken()).toBe("token-1");
    expect(cache.currentLanguage()).toBe("la");

    // Same token/language: no version bump.
    const v2 = cache.activateSession("token-1", "la");
    expect(v2).toBe(v1);

    // Different language: version bumps and invalidates the previous version.
    const v3 = cache.activateSession("token-1", "en");
    expect(v3).not.toBe(v1);
    expect(cache.isCurrentSession(v1)).toBe(false);
    expect(cache.isCurrentSession(v3)).toBe(true);
  });

  it("reports isActiveSession based on the currently active token/language", () => {
    const cache = createPublicPosSessionCache();
    cache.activateSession("token-1", "la");

    expect(cache.isActiveSession("token-1", "la")).toBe(true);
    expect(cache.isActiveSession("token-1", "en")).toBe(false);
    expect(cache.isActiveSession("token-2", "la")).toBe(false);
  });

  it("invalidateSession resets the token, clears the cache, and cancels in-flight scan requests", () => {
    const cache = createPublicPosSessionCache();
    cache.activateSession("token-1", "la");
    const scanVersion = cache.scanRequest.next();
    cache.setCartLoadPromise(Promise.resolve([]));

    cache.invalidateSession();

    expect(cache.currentToken()).toBe("");
    expect(cache.scanRequest.isCurrent(scanVersion)).toBe(false);
    expect(cache.getCartLoadPromise()).toBeNull();
  });

  it("clearDataCache drops the pending cart-load promise without touching the session token", () => {
    const cache = createPublicPosSessionCache();
    cache.activateSession("token-1", "la");
    cache.setCartLoadPromise(Promise.resolve([]));

    cache.clearDataCache();

    expect(cache.getCartLoadPromise()).toBeNull();
    expect(cache.currentToken()).toBe("token-1");
  });

  it("dedupes concurrent fetchMenuProducts calls for the same key and caches the resolved value", async () => {
    const cache = createPublicPosSessionCache();
    let resolveRequest: (value: CustomerFetchCateProductsResponse) => void = () => undefined;
    publicPosMocks.customerFetchCateProducts.mockReturnValue(
      new Promise<CustomerFetchCateProductsResponse>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const params = { token: "token-1", lang: "la", cateUuid: "cate-1", search: "" };
    // Both calls dedupe onto the same in-flight service request even though
    // each (async) call returns its own promise wrapper.
    const first = cache.fetchMenuProducts(params);
    const second = cache.fetchMenuProducts(params);
    expect(publicPosMocks.customerFetchCateProducts).toHaveBeenCalledTimes(1);

    resolveRequest(EMPTY_CATALOG_RESPONSE);
    await expect(first).resolves.toEqual(EMPTY_CATALOG_RESPONSE);
    await expect(second).resolves.toEqual(EMPTY_CATALOG_RESPONSE);

    // Now cached: a further call must not hit the service again.
    await cache.fetchMenuProducts(params);
    expect(publicPosMocks.customerFetchCateProducts).toHaveBeenCalledTimes(1);
  });

  it("does not cache a fetchMenuProducts result if the cache was cleared while the request was in flight", async () => {
    const cache = createPublicPosSessionCache();
    let resolveRequest: (value: CustomerFetchCateProductsResponse) => void = () => undefined;
    publicPosMocks.customerFetchCateProducts.mockReturnValue(
      new Promise<CustomerFetchCateProductsResponse>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const params = { token: "token-1", lang: "la", cateUuid: "cate-1", search: "" };
    const pending = cache.fetchMenuProducts(params);
    cache.clearDataCache();
    resolveRequest(EMPTY_CATALOG_RESPONSE);
    await pending;

    await cache.fetchMenuProducts(params);
    expect(publicPosMocks.customerFetchCateProducts).toHaveBeenCalledTimes(2);
  });
});
