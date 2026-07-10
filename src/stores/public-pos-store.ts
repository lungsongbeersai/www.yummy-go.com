"use client";

import { create } from "zustand";
import { toApiLanguage } from "@/lib/language";
import { emitTableAlert } from "@/lib/socket";
import {
  type CartOrder,
  type CreateOrderResponse,
  type FetchCartStatusRule,
  type ProdItem
} from "@/services/pos";
import * as publicPosService from "@/services/public-pos";
import type {
  CustomerCreateOrderInput,
  CustomerConfirmKitchenInput,
  CustomerDeleteOrderItemParams,
  CustomerEmitTableStatusParams,
  CustomerFetchCartParams,
  CustomerFetchCateProductsParams,
  CustomerGetProdItemParams,
  CustomerUpdateOrderNoteInput,
  CustomerUpdateQtyInput,
  QRScanResponse
} from "@/services/public-pos";
import {
  PUBLIC_MENU_KIND,
  emptyProductBrowseState,
  emptyMenuByKind,
  emptyStatusMenu,
  firstAvailableCateUuid,
  menuSequenceKey,
  mergeCategoryProducts,
  normalizeCartOrders,
  normalizeCartStatusRule,
  normalizeCategories,
  productCateUuids,
  publicMenuKindToStatusSortFk,
  splitSpecialProducts,
  statusMenuRequestKey,
  toCategoryTabs,
  toSpecialCategories,
  uniqueStrings,
  type PublicMenuByKind,
  type PublicMenuKind,
  type PublicPosCategoryTab,
  type PublicStatusMenu
} from "@/stores/public-pos-store/helpers";
import { errorMessage } from "@/stores/store-utils";

export { PUBLIC_MENU_KIND, publicMenuKindToStatusSortFk };
export type { PublicMenuByKind, PublicMenuKind, PublicPosCategoryTab, PublicStatusMenu };

function emitCustomerTableAlert(params: CustomerEmitTableStatusParams) {
  emitTableAlert({
    branch_uuid_fk: params.branch_uuid_fk,
    table_uuid: params.table_uuid,
    customer_order_state: true
  });
}

const MENU_CACHE_TTL_MS = 45_000;
const PRODUCT_CACHE_TTL_MS = 120_000;
const IDLE_PUBLIC_POS_REQUEST_STATE = {
  loading: false,
  loadingCart: false,
  loadingItem: false,
  loadingMenu: false,
  saving: false,
  confirming: false
} as const;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

type CateProductsResponse = Awaited<
  ReturnType<typeof publicPosService.customerFetchCateProducts>
>;
type ProductItemResponse = Awaited<
  ReturnType<typeof publicPosService.customerGetProdItem>
>;

let activeSessionToken = "";
let activeSessionLanguage = toApiLanguage();
// Version checks logically cancel requests when the underlying service promise cannot be aborted.
let publicPosSessionVersion = 0;
let publicPosCacheVersion = 0;
let scanRequestVersion = 0;
let cartRequestVersion = 0;
let productItemRequestVersion = 0;
let cartLoadPromise: Promise<CartOrder[]> | null = null;
const menuProductsCache = new Map<string, CacheEntry<CateProductsResponse>>();
const menuProductsPromises = new Map<string, Promise<CateProductsResponse>>();
const productItemCache = new Map<string, CacheEntry<ProductItemResponse>>();
const productItemPromises = new Map<string, Promise<ProductItemResponse>>();

function clearPublicPosDataCache() {
  publicPosCacheVersion += 1;
  cartRequestVersion += 1;
  productItemRequestVersion += 1;
  cartLoadPromise = null;
  menuProductsCache.clear();
  menuProductsPromises.clear();
  productItemCache.clear();
  productItemPromises.clear();
}

function activatePublicPosSession(token: string, lang?: string) {
  const language = toApiLanguage(lang);
  if (activeSessionToken !== token || activeSessionLanguage !== language) {
    activeSessionToken = token;
    activeSessionLanguage = language;
    publicPosSessionVersion += 1;
    clearPublicPosDataCache();
  }
  return publicPosSessionVersion;
}

function activatePublicPosToken(token: string) {
  if (activeSessionToken !== token) {
    activeSessionToken = token;
    publicPosSessionVersion += 1;
    clearPublicPosDataCache();
  }
  return publicPosSessionVersion;
}

function isActivePublicPosSession(token: string, lang?: string) {
  return (
    activeSessionToken === token &&
    activeSessionLanguage === toApiLanguage(lang)
  );
}

function invalidatePublicPosSession() {
  activeSessionToken = "";
  activeSessionLanguage = toApiLanguage();
  publicPosSessionVersion += 1;
  scanRequestVersion += 1;
  clearPublicPosDataCache();
}

function isCurrentPublicPosSession(version: number) {
  return version === publicPosSessionVersion;
}

function emptyPublicPosSessionState() {
  return {
    ...IDLE_PUBLIC_POS_REQUEST_STATE,
    tableName: "",
    scan: null,
    ...emptyProductBrowseState(),
    selectedProduct: null,
    cart: [],
    cartStatusRule: null,
    cartHydrated: false,
    error: null
  };
}

function cachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
) {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function productItemRequestKey(params: CustomerGetProdItemParams) {
  return [
    params.t,
    params.lang ?? "",
    params.prod_uuid,
    params.cate_uuid ?? "",
    params.search ?? "",
    params.status_sort_fk ?? 1
  ].join(":");
}

async function fetchMenuProductsCached(params: CustomerFetchCateProductsParams) {
  const key = menuSequenceKey(params);
  const cached = cachedValue(menuProductsCache, key);
  if (cached) return cached;

  const pending = menuProductsPromises.get(key);
  if (pending) return pending;

  const requestCacheVersion = publicPosCacheVersion;
  const request = publicPosService.customerFetchCateProducts(params).then((result) => {
    if (requestCacheVersion === publicPosCacheVersion) {
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

async function fetchProductItemCached(params: CustomerGetProdItemParams) {
  const key = productItemRequestKey(params);
  const cached = cachedValue(productItemCache, key);
  if (cached) return cached;

  const pending = productItemPromises.get(key);
  if (pending) return pending;

  const requestCacheVersion = publicPosCacheVersion;
  const request = publicPosService.customerGetProdItem(params).then((result) => {
    if (requestCacheVersion === publicPosCacheVersion) {
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

interface PublicPosState {
  token: string;
  tableName: string;
  scan: QRScanResponse | null;
  menuByKind: PublicMenuByKind;
  categoryTabs: PublicPosCategoryTab[];
  selectedCateUuid: string;
  defaultCateUuid: string;
  loadingMenu: boolean;
  menuRequestKey: string;
  selectedProduct: ProdItem | null;
  cart: CartOrder[];
  cartStatusRule: FetchCartStatusRule | null;
  cartHydrated: boolean;
  loading: boolean;
  loadingCart: boolean;
  loadingItem: boolean;
  saving: boolean;
  confirming: boolean;
  error: string | null;
  setToken: (token: string) => void;
  setTableName: (tableName: string) => void;
  setSelectedCateUuid: (cateUuid: string) => void;
  setCart: (cart: CartOrder[]) => void;
  setError: (error: string | null) => void;
  scanTable: (token: string, lang?: string) => Promise<QRScanResponse>;
  loadCart: (params: CustomerFetchCartParams) => Promise<CartOrder[]>;
  ensureCartLoaded: (params: CustomerFetchCartParams) => Promise<CartOrder[]>;
  loadMenuProducts: (params: CustomerFetchCateProductsParams) => Promise<PublicMenuByKind>;
  loadNormalCategoryProducts: (params: CustomerFetchCateProductsParams) => Promise<PublicStatusMenu>;
  loadProductItem: (params: CustomerGetProdItemParams) => Promise<ProdItem>;
  createOrder: (token: string, input: CustomerCreateOrderInput) => Promise<CreateOrderResponse>;
  updateQty: (params: CustomerUpdateQtyInput) => ReturnType<typeof publicPosService.customerUpdateQty>;
  deleteItem: (params: CustomerDeleteOrderItemParams) => ReturnType<typeof publicPosService.customerDeleteOrderItem>;
  updateNote: (params: CustomerUpdateOrderNoteInput) => ReturnType<typeof publicPosService.customerUpdateOrderNote>;
  confirmKitchen: (params: CustomerConfirmKitchenInput) => ReturnType<typeof publicPosService.customerConfirmKitchen>;
  emitTableStatus: (params: CustomerEmitTableStatusParams) => ReturnType<typeof publicPosService.customerEmitTableStatus>;
  reset: () => void;
}

interface SavingCartMutationOptions<TResult> {
  get: () => PublicPosState;
  lang: string;
  request: () => Promise<TResult>;
  set: (state: Partial<PublicPosState>) => void;
  token: string;
}

async function runSavingCartMutation<TResult>({
  get,
  lang,
  request,
  set,
  token
}: SavingCartMutationOptions<TResult>) {
  const sessionChanged = !isActivePublicPosSession(token, lang);
  const sessionVersion = activatePublicPosSession(token, lang);
  set({
    ...(sessionChanged ? emptyPublicPosSessionState() : {}),
    saving: true,
    error: null,
    token
  });

  try {
    const result = await request();
    if (!isCurrentPublicPosSession(sessionVersion)) return result;

    clearPublicPosDataCache();
    await get().loadCart({ t: token, lang }).catch(() => undefined);
    if (isCurrentPublicPosSession(sessionVersion)) {
      set({ saving: false });
    }
    return result;
  } catch (error) {
    if (isCurrentPublicPosSession(sessionVersion)) {
      set({ error: errorMessage(error), saving: false });
    }
    throw error;
  }
}

export const usePublicPosStore = create<PublicPosState>((set, get) => ({
  token: "",
  ...emptyPublicPosSessionState(),
  setToken: (token) => {
    const sessionChanged = activeSessionToken !== token;
    activatePublicPosToken(token);
    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      token
    });
  },
  setTableName: (tableName) => set({ tableName }),
  setSelectedCateUuid: (selectedCateUuid) => set({ selectedCateUuid }),
  setCart: (cart) => set({ cart }),
  setError: (error) => set({ error }),
  scanTable: async (token, lang) => {
    const sessionVersion = activatePublicPosSession(token, lang);
    const requestVersion = ++scanRequestVersion;

    set({
      ...emptyPublicPosSessionState(),
      loading: true,
      token
    });
    try {
      const scan = await publicPosService.scanTableQR(token, lang);
      if (
        requestVersion !== scanRequestVersion ||
        !isCurrentPublicPosSession(sessionVersion)
      ) {
        return scan;
      }

      set({
        scan,
        tableName: scan.table_name ?? "",
        loading: false
      });
      return scan;
    } catch (error) {
      if (
        requestVersion === scanRequestVersion &&
        isCurrentPublicPosSession(sessionVersion)
      ) {
        set({
          error: errorMessage(error),
          loading: false,
          scan: null,
          tableName: ""
        });
      }
      throw error;
    }
  },
  loadCart: async (params) => {
    const sessionChanged = !isActivePublicPosSession(params.t, params.lang);
    const sessionVersion = activatePublicPosSession(params.t, params.lang);
    const requestVersion = ++cartRequestVersion;
    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      loadingCart: true,
      error: null,
      token: params.t
    });
    try {
      const result = await publicPosService.fetchCustomerCart(params);
      const cart = normalizeCartOrders(result);
      const cartStatusRule = normalizeCartStatusRule(result);
      if (
        isCurrentPublicPosSession(sessionVersion) &&
        requestVersion === cartRequestVersion
      ) {
        set({ cart, cartStatusRule, loadingCart: false, cartHydrated: true });
      }
      return cart;
    } catch (error) {
      if (
        isCurrentPublicPosSession(sessionVersion) &&
        requestVersion === cartRequestVersion
      ) {
        set({
          error: errorMessage(error),
          cartStatusRule: null,
          loadingCart: false,
          cartHydrated: false
        });
      }
      throw error;
    }
  },
  ensureCartLoaded: async (params) => {
    const sessionChanged = !isActivePublicPosSession(params.t, params.lang);
    activatePublicPosSession(params.t, params.lang);
    if (sessionChanged) {
      set({ ...emptyPublicPosSessionState(), token: params.t });
    }
    const state = get();
    if (!sessionChanged && state.cartHydrated) return state.cart;

    if (!cartLoadPromise) {
      const request = get().loadCart(params);
      cartLoadPromise = request;
      const clearPendingRequest = () => {
        if (cartLoadPromise === request) {
          cartLoadPromise = null;
        }
      };
      void request.then(clearPendingRequest, clearPendingRequest);
    }

    return cartLoadPromise;
  },
  loadMenuProducts: async (params) => {
    const sessionChanged = !isActivePublicPosSession(params.t, params.lang);
    const sessionVersion = activatePublicPosSession(params.t, params.lang);
    const baseParams: CustomerFetchCateProductsParams = {
      t: params.t,
      lang: params.lang,
      cate_uuid: params.cate_uuid?.trim() || undefined,
      search: params.search ?? ""
    };
    const sequenceKey = menuSequenceKey(baseParams);

    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      ...emptyProductBrowseState(),
      loadingMenu: true,
      menuRequestKey: sequenceKey,
      error: null,
      token: baseParams.t
    });

    try {
      const result = await fetchMenuProductsCached(baseParams);
      if (
        !isCurrentPublicPosSession(sessionVersion) ||
        get().menuRequestKey !== sequenceKey
      ) {
        return get().menuByKind;
      }

      const categories = normalizeCategories(result.data ?? []);
      const categoryTabs = toCategoryTabs(categories);
      const selectedCateUuid = firstAvailableCateUuid(categories, result.selected_cate_uuid, result.default_cate_uuid);
      const defaultCateUuid =
        result.default_cate_uuid && categories.some((category) => category.cate_uuid === result.default_cate_uuid)
          ? result.default_cate_uuid
          : selectedCateUuid;
      const loadedCateUuids = uniqueStrings([selectedCateUuid, ...productCateUuids(categories)]);
      const specialProducts = splitSpecialProducts(result.special_products ?? []);
      const promotionCategories = toSpecialCategories(PUBLIC_MENU_KIND.PROMOTION, specialProducts.promotion);
      const setCategories = toSpecialCategories(PUBLIC_MENU_KIND.SET, specialProducts.set);

      set({
        menuByKind: {
          [PUBLIC_MENU_KIND.PROMOTION]: {
            ...emptyStatusMenu(),
            categories: promotionCategories,
            requestKey: statusMenuRequestKey(baseParams, PUBLIC_MENU_KIND.PROMOTION)
          },
          [PUBLIC_MENU_KIND.SET]: {
            ...emptyStatusMenu(),
            categories: setCategories,
            requestKey: statusMenuRequestKey(baseParams, PUBLIC_MENU_KIND.SET)
          },
          [PUBLIC_MENU_KIND.NORMAL]: {
            categories,
            categoryTabs,
            selectedCateUuid,
            defaultCateUuid,
            loadedCateUuids,
            loadingCateUuids: [],
            loading: false,
            error: null,
            requestKey: statusMenuRequestKey(baseParams, PUBLIC_MENU_KIND.NORMAL)
          }
        },
        categoryTabs,
        selectedCateUuid,
        defaultCateUuid,
        loadingMenu: false,
        error: null
      });

      return get().menuByKind;
    } catch (error) {
      const message = errorMessage(error);
      if (
        isCurrentPublicPosSession(sessionVersion) &&
        get().menuRequestKey === sequenceKey
      ) {
        set({
          menuByKind: emptyMenuByKind(),
          loadingMenu: false,
          error: message
        });
      }
      throw error;
    }
  },
  loadNormalCategoryProducts: async (params) => {
    const sessionChanged = !isActivePublicPosSession(params.t, params.lang);
    const sessionVersion = activatePublicPosSession(params.t, params.lang);
    const cateUuid = params.cate_uuid?.trim();
    if (!cateUuid) return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];

    if (sessionChanged) {
      set({
        ...emptyPublicPosSessionState(),
        token: params.t
      });
    }

    const state = get();
    const normalMenu = state.menuByKind[PUBLIC_MENU_KIND.NORMAL];
    if (normalMenu.loadedCateUuids.includes(cateUuid) || normalMenu.loadingCateUuids.includes(cateUuid)) {
      return normalMenu;
    }

    const requestParams: CustomerFetchCateProductsParams = {
      t: params.t,
      lang: params.lang,
      cate_uuid: cateUuid,
      search: params.search ?? ""
    };
    const requestKey = statusMenuRequestKey(requestParams, PUBLIC_MENU_KIND.NORMAL);

    set((current) => ({
      menuByKind: {
        ...current.menuByKind,
        [PUBLIC_MENU_KIND.NORMAL]: {
          ...current.menuByKind[PUBLIC_MENU_KIND.NORMAL],
          loadingCateUuids: uniqueStrings([
            ...current.menuByKind[PUBLIC_MENU_KIND.NORMAL].loadingCateUuids,
            cateUuid
          ]),
          error: null
        }
      }
    }));

    try {
      const result = await fetchMenuProductsCached(requestParams);
      if (!isCurrentPublicPosSession(sessionVersion)) {
        return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];
      }
      const categories = normalizeCategories(result.data ?? []);

      set((current) => {
        const currentNormalMenu = current.menuByKind[PUBLIC_MENU_KIND.NORMAL];
        const mergedCategories = currentNormalMenu.categories.length
          ? mergeCategoryProducts(currentNormalMenu.categories, categories, cateUuid)
          : categories;
        const categoryTabs = currentNormalMenu.categoryTabs.length
          ? currentNormalMenu.categoryTabs
          : toCategoryTabs(mergedCategories);

        return {
          menuByKind: {
            ...current.menuByKind,
            [PUBLIC_MENU_KIND.NORMAL]: {
              ...currentNormalMenu,
              categories: mergedCategories,
              categoryTabs,
              selectedCateUuid: currentNormalMenu.selectedCateUuid,
              defaultCateUuid: currentNormalMenu.defaultCateUuid || result.default_cate_uuid || cateUuid,
              loadedCateUuids: uniqueStrings([...currentNormalMenu.loadedCateUuids, cateUuid]),
              loadingCateUuids: currentNormalMenu.loadingCateUuids.filter((uuid) => uuid !== cateUuid),
              error: null,
              requestKey
            }
          },
          categoryTabs,
          defaultCateUuid: current.defaultCateUuid || result.default_cate_uuid || cateUuid
        };
      });
    } catch (error) {
      const message = errorMessage(error);
      if (isCurrentPublicPosSession(sessionVersion)) {
        set((current) => ({
          menuByKind: {
            ...current.menuByKind,
            [PUBLIC_MENU_KIND.NORMAL]: {
              ...current.menuByKind[PUBLIC_MENU_KIND.NORMAL],
              loadingCateUuids: current.menuByKind[PUBLIC_MENU_KIND.NORMAL].loadingCateUuids.filter(
                (uuid) => uuid !== cateUuid
              ),
              error: message
            }
          },
          error: message
        }));
      }
      throw error;
    }

    return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];
  },
  loadProductItem: async (params) => {
    const sessionChanged = !isActivePublicPosSession(params.t, params.lang);
    const sessionVersion = activatePublicPosSession(params.t, params.lang);
    const requestVersion = ++productItemRequestVersion;
    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      loadingItem: true,
      error: null,
      token: params.t,
      selectedProduct: null
    });
    try {
      const selectedProduct = await fetchProductItemCached(params);
      if (
        isCurrentPublicPosSession(sessionVersion) &&
        requestVersion === productItemRequestVersion
      ) {
        set({ selectedProduct, loadingItem: false });
      }
      return selectedProduct;
    } catch (error) {
      if (
        isCurrentPublicPosSession(sessionVersion) &&
        requestVersion === productItemRequestVersion
      ) {
        set({ error: errorMessage(error), loadingItem: false });
      }
      throw error;
    }
  },
  createOrder: (token, input) =>
    runSavingCartMutation({
      get,
      lang: input.lang ?? get().scan?.lang ?? activeSessionLanguage,
      request: () => publicPosService.customerCreateOrder(token, input),
      set,
      token
    }),
  updateQty: (params) =>
    runSavingCartMutation({
      get,
      lang: get().scan?.lang ?? activeSessionLanguage,
      request: () => publicPosService.customerUpdateQty(params),
      set,
      token: params.t
    }),
  deleteItem: (params) =>
    runSavingCartMutation({
      get,
      lang: get().scan?.lang ?? activeSessionLanguage,
      request: () => publicPosService.customerDeleteOrderItem(params),
      set,
      token: params.t
    }),
  updateNote: (params) =>
    runSavingCartMutation({
      get,
      lang: get().scan?.lang ?? activeSessionLanguage,
      request: () => publicPosService.customerUpdateOrderNote(params),
      set,
      token: params.t
    }),
  confirmKitchen: async (params) => {
    const lang = get().scan?.lang ?? activeSessionLanguage;
    const sessionChanged = !isActivePublicPosSession(params.t, lang);
    const sessionVersion = activatePublicPosSession(params.t, lang);
    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      confirming: true,
      error: null,
      token: params.t
    });
    try {
      const scan = get().scan;
      const { device_code, agent_id, print_mode, ...confirmPayload } = params;
      void device_code;
      void agent_id;
      void print_mode;
      const result = await publicPosService.customerConfirmKitchen(confirmPayload);
      if (!isCurrentPublicPosSession(sessionVersion)) return result;

      clearPublicPosDataCache();
      if (scan?.branch_uuid_fk && scan.table_uuid) {
        await get().emitTableStatus({
          t: params.t,
          branch_uuid_fk: scan.branch_uuid_fk,
          table_uuid: scan.table_uuid
        }).catch(() => undefined);
      }
      if (isCurrentPublicPosSession(sessionVersion)) {
        await get().loadCart({ t: params.t, lang }).catch(() => undefined);
      }
      if (isCurrentPublicPosSession(sessionVersion)) {
        set({ confirming: false });
      }
      return result;
    } catch (error) {
      if (isCurrentPublicPosSession(sessionVersion)) {
        set({ error: errorMessage(error), confirming: false });
      }
      throw error;
    }
  },
  emitTableStatus: (params) => {
    emitCustomerTableAlert(params);
    return publicPosService.customerEmitTableStatus(params);
  },
  reset: () => {
    invalidatePublicPosSession();
    set({
      ...emptyPublicPosSessionState(),
      token: "",
    });
  }
}));
