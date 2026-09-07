"use client";

import { apiRequest, type HttpMethod, type RequestOptions } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { getProductImageUrl } from "@/lib/image";
import { OFFLINE_PRODUCT_IMAGE_CACHE, warmOfflineProductImage } from "@/lib/offline-product-images";
import { readBrowserApiCacheEntry, type BrowserApiCacheEntry, type BrowserOfflineIdentity } from "@/services/offline-db";
import { retainPendingBrowserItemSnapshots } from "@/services/offline-order";

const MENU = "/api/v1/posAll/fetch_cate_products";
const PRODUCT = "/api/v1/posAll/get_prod_item";
const FRESH_MS = 5 * 60_000;

interface MenuRequest extends BrowserOfflineIdentity {
  method: HttpMethod;
  path: string;
  params?: Record<string, unknown>;
  data?: unknown;
}

interface MenuPreparationDependencies {
  request: (method: HttpMethod, path: string, options: RequestOptions) => Promise<unknown>;
  cached: (request: MenuRequest) => Promise<BrowserApiCacheEntry | undefined>;
  warmImage: (source: string) => Promise<boolean>;
  now: () => number;
  beforeRefresh?: (scope: BrowserOfflineIdentity) => Promise<void>;
}

export interface MobileMenuPreparation {
  complete: boolean;
  products: number;
  failedRequests: number;
  failedImages: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.map(record) : [];
}

async function inPairs<T>(items: T[], active: () => boolean, task: (item: T) => Promise<void>) {
  let index = 0;
  await Promise.all([0, 1].map(async () => {
    while (active() && index < items.length) await task(items[index++]);
  }));
}

/** One background preparation per cashier/branch/language, never a write or Agent request. */
export function createMobileMenuPreparer(deps: MenuPreparationDependencies) {
  const running = new Map<string, Promise<MobileMenuPreparation>>();
  const recent = new Map<string, { next: number; result: MobileMenuPreparation }>();

  return function prepare(scope: BrowserOfflineIdentity, language: string, active: () => boolean) {
    const lang = toApiLanguage(language);
    const key = JSON.stringify([scope.storeUuid, scope.branchUuid, scope.actorLoginUuid, lang]);
    const previous = recent.get(key);
    if (running.has(key)) return running.get(key)!;
    if (previous && previous.next > deps.now()) return Promise.resolve(previous.result);

    const run = async (): Promise<MobileMenuPreparation> => {
      const result: MobileMenuPreparation = { complete: false, products: 0, failedRequests: 0, failedImages: 0 };
      if (!active() || !scope.storeUuid || !scope.branchUuid || !scope.actorLoginUuid) return result;
      await deps.beforeRefresh?.(scope);
      const images = new Set<string>();
      const products = new Set<string>();
      const collectProduct = (product: Record<string, unknown>) => {
        if (typeof product.prod_uuid === "string" && product.prod_uuid) products.add(product.prod_uuid);
        if (Number(product.prod_status_imge) === 1 && typeof product.prod_image === "string" && product.prod_image) {
          images.add(getProductImageUrl(product.prod_image));
        }
      };
      const load = async (method: HttpMethod, path: string, options: RequestOptions) => {
        if (!active()) return null;
        const input = { ...scope, method, path, ...options };
        try {
          const cached = await deps.cached(input);
          if (!active()) return null;
          if (cached?.source === "ONLINE" && cached.retainForOfflineMenu && deps.now() - cached.cachedAt < FRESH_MS) {
            return record(cached.response);
          }
          const started = deps.now();
          await deps.request(method, path, options);
          if (!active()) return null;
          // A network fallback or failed Dexie write is not a prepared product.
          const saved = await deps.cached(input);
          if (!saved || saved.source !== "ONLINE" || !saved.retainForOfflineMenu || saved.cachedAt < started || record(saved.response).status !== "success") {
            throw new Error("MENU_CACHE_NOT_SAVED");
          }
          return record(saved.response);
        } catch {
          result.failedRequests++;
          return null;
        }
      };
      const params = { branch_uuid_fk: scope.branchUuid, lang, search: "", status_sort_fk: 1 };
      const catalog = await load("get", MENU, { params });
      if (!catalog || !Array.isArray(catalog.data)) return { ...result, failedRequests: Math.max(1, result.failedRequests) };
      const categories = rows(catalog.data);
      categories.forEach((category) => rows(category.products).forEach(collectProduct));
      // Backend lists all categories but only fills products for the selected
      // one. Each category needs all three sorts, using the UI's exact keys.
      const requests = categories.flatMap((category) => typeof category.cate_uuid === "string" && category.cate_uuid
        ? [1, 2, 3].map((sort) => ({ ...params, cate_uuid: category.cate_uuid, status_sort_fk: sort })) : []);
      await inPairs(requests, active, async (query) => {
        const menu = await load("get", MENU, { params: query });
        if (!menu) return;
        if (!Array.isArray(menu.data)) { result.failedRequests++; return; }
        rows(menu.data).forEach((category) => rows(category.products).forEach(collectProduct));
        rows(menu.special_products).forEach(collectProduct);
      });
      await inPairs([...products], active, async (prod_uuid) => {
        const response = await load("post", PRODUCT, { data: { prod_uuid, lang } });
        if (!response) return;
        const product = record(response.data);
        if (product.prod_uuid !== prod_uuid || !Array.isArray(product.details) || !Array.isArray(product.toppings)) {
          result.failedRequests++;
          return;
        }
        collectProduct(product);
        result.products++;
      });
      await inPairs([...images], active, async (source) => {
        if (!await deps.warmImage(source)) result.failedImages++;
      });
      result.complete = active() && result.failedRequests === 0 && result.failedImages === 0;
      return result;
    };
    const work = run().then((result) => {
      if (active()) recent.set(key, { result, next: deps.now() + (result.complete ? FRESH_MS : 30_000) });
      return result;
    }).finally(() => { running.delete(key); });
    running.set(key, work);
    return work;
  };
}

export const prepareMobileOfflineMenu = createMobileMenuPreparer({
  beforeRefresh: (scope) => retainPendingBrowserItemSnapshots(scope),
  request: (method, path, options) => apiRequest(method, path, options),
  cached: (request) => readBrowserApiCacheEntry(request),
  warmImage: async (source) => {
    try {
      if (typeof caches === "undefined") return false;
      return await warmOfflineProductImage(source, await caches.open(OFFLINE_PRODUCT_IMAGE_CACHE));
    } catch { return false; }
  },
  now: Date.now,
});
