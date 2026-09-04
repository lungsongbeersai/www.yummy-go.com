// Session-versioning + request/response caching for the public POS store
// (P3.4 split of public-pos-store.ts). Pure, framework-free (no Zustand):
// the store creates a single `createPublicPosSessionCache()` instance at
// module scope and calls into it from its actions; tests create their own
// isolated instances instead of sharing global mutable state.
import { toApiLanguage } from "@/lib/language";
import type { CartOrder } from "@/services/pos";
import * as publicPosService from "@/services/public-pos";
import type {
  CustomerFetchCateProductsParams,
  CustomerGetProdItemParams
} from "@/services/public-pos";
import { emptyProductBrowseState, menuSequenceKey } from "@/stores/public-pos-store/helpers";

// ---------------------------------------------------------------------------
// Generic request-version tracker.
//
// Version checks logically cancel requests when the underlying service
// promise cannot be aborted: capture `next()`'s side effect via `current()`
// before starting a request, then after it resolves use `isCurrent()` to
// discard stale responses. Calling `next()` and discarding its return value
// invalidates any request currently in flight (used on session/cache resets).
// ---------------------------------------------------------------------------
export interface RequestVersionTracker {
  current: () => number;
  next: () => number;
  isCurrent: (version: number) => boolean;
}

export function createRequestVersionTracker(): RequestVersionTracker {
  let version = 0;
  return {
    current: () => version,
    next: () => (version += 1),
    isCurrent: (candidate) => candidate === version
  };
}

// ---------------------------------------------------------------------------
// Generic TTL cache.
// ---------------------------------------------------------------------------
export interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export function cachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export const MENU_CACHE_TTL_MS = 45_000;
export const PRODUCT_CACHE_TTL_MS = 120_000;

export const IDLE_PUBLIC_POS_REQUEST_STATE = {
  loading: false,
  loadingCart: false,
  loadingItem: false,
  loadingMenu: false,
  saving: false,
  confirming: false
} as const;

export function emptyPublicPosSessionState() {
  return {
    ...IDLE_PUBLIC_POS_REQUEST_STATE,
    tableName: "",
    scan: null,
    ...emptyProductBrowseState(),
    selectedProduct: null,
    cart: [],
    cartStatusRule: null,
    cartHydrated: false,
    error: null,
    qrRevoked: false
  };
}

type CateProductsResponse = Awaited<
  ReturnType<typeof publicPosService.customerFetchCateProducts>
>;
type ProductItemResponse = Awaited<
  ReturnType<typeof publicPosService.customerGetProdItem>
>;

function productItemRequestKey(params: CustomerGetProdItemParams) {
  return [
    params.token,
    params.lang ?? "",
    params.prodUuid,
    params.cateUuid ?? "",
    params.search ?? "",
    params.statusSortFk ?? 1
  ].join(":");
}

// ---------------------------------------------------------------------------
// Session cache: active token/language, cache-busting versions, and the
// TTL + in-flight-dedupe caches for menu products and product items.
// ---------------------------------------------------------------------------
export function createPublicPosSessionCache() {
  let activeSessionToken = "";
  let activeSessionLanguage = toApiLanguage();
  const sessionVersion = createRequestVersionTracker();
  const cacheVersion = createRequestVersionTracker();
  const scanRequest = createRequestVersionTracker();
  const cartRequest = createRequestVersionTracker();
  const productItemRequest = createRequestVersionTracker();

  let cartLoadPromise: Promise<CartOrder[]> | null = null;
  const menuProductsCache = new Map<string, CacheEntry<CateProductsResponse>>();
  const menuProductsPromises = new Map<string, Promise<CateProductsResponse>>();
  const productItemCache = new Map<string, CacheEntry<ProductItemResponse>>();
  const productItemPromises = new Map<string, Promise<ProductItemResponse>>();

  function clearDataCache() {
    cacheVersion.next();
    cartRequest.next();
    productItemRequest.next();
    cartLoadPromise = null;
    menuProductsCache.clear();
    menuProductsPromises.clear();
    productItemCache.clear();
    productItemPromises.clear();
  }

  function activateSession(token: string, lang?: string) {
    const language = toApiLanguage(lang);
    if (activeSessionToken !== token || activeSessionLanguage !== language) {
      activeSessionToken = token;
      activeSessionLanguage = language;
      sessionVersion.next();
      clearDataCache();
    }
    return sessionVersion.current();
  }

  function activateToken(token: string) {
    if (activeSessionToken !== token) {
      activeSessionToken = token;
      sessionVersion.next();
      clearDataCache();
    }
    return sessionVersion.current();
  }

  function isActiveSession(token: string, lang?: string) {
    return (
      activeSessionToken === token &&
      activeSessionLanguage === toApiLanguage(lang)
    );
  }

  function invalidateSession() {
    activeSessionToken = "";
    activeSessionLanguage = toApiLanguage();
    sessionVersion.next();
    scanRequest.next();
    clearDataCache();
  }

  async function fetchMenuProducts(params: CustomerFetchCateProductsParams) {
    const key = menuSequenceKey(params);
    const cached = cachedValue(menuProductsCache, key);
    if (cached) return cached;

    const pending = menuProductsPromises.get(key);
    if (pending) return pending;

    const requestCacheVersion = cacheVersion.current();
    const request = publicPosService.customerFetchCateProducts(params).then((result) => {
      if (requestCacheVersion === cacheVersion.current()) {
        setCachedValue(menuProductsCache, key, result, MENU_CACHE_TTL_MS);
      }
      return result;
    });

    menuProductsPromises.set(key, request);
    const clearPendingRequest = () => {
      if (menuProductsPromises.get(key) === request) {
        menuProductsPromises.delete(key);
      }
    };
    void request.then(clearPendingRequest, clearPendingRequest);

    return request;
  }

  async function fetchProductItem(params: CustomerGetProdItemParams) {
    const key = productItemRequestKey(params);
    const cached = cachedValue(productItemCache, key);
    if (cached) return cached;

    const pending = productItemPromises.get(key);
    if (pending) return pending;

    const requestCacheVersion = cacheVersion.current();
    const request = publicPosService.customerGetProdItem(params).then((result) => {
      if (requestCacheVersion === cacheVersion.current()) {
        setCachedValue(productItemCache, key, result, PRODUCT_CACHE_TTL_MS);
      }
      return result;
    });

    productItemPromises.set(key, request);
    const clearPendingRequest = () => {
      if (productItemPromises.get(key) === request) {
        productItemPromises.delete(key);
      }
    };
    void request.then(clearPendingRequest, clearPendingRequest);

    return request;
  }

  return {
    activateSession,
    activateToken,
    isActiveSession,
    isCurrentSession: sessionVersion.isCurrent,
    invalidateSession,
    clearDataCache,
    currentToken: () => activeSessionToken,
    currentLanguage: () => activeSessionLanguage,
    scanRequest,
    cartRequest,
    productItemRequest,
    getCartLoadPromise: () => cartLoadPromise,
    setCartLoadPromise: (promise: Promise<CartOrder[]> | null) => {
      cartLoadPromise = promise;
    },
    fetchMenuProducts,
    fetchProductItem
  };
}

export type PublicPosSessionCache = ReturnType<typeof createPublicPosSessionCache>;
