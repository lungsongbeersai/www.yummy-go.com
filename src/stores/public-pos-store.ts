"use client";

import { create } from "zustand";
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
  emptyMenuByKind,
  emptyProductBrowseState,
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
import {
  createPublicPosSessionCache,
  emptyPublicPosSessionState
} from "@/stores/public-pos-store/session-cache";
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

// Session-versioning + request/response caching lives in session-cache.ts
// (P3.4 split) — this file keeps only the Zustand wiring.
const sessionCache = createPublicPosSessionCache();

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
  const sessionChanged = !sessionCache.isActiveSession(token, lang);
  const sessionVersion = sessionCache.activateSession(token, lang);
  set({
    ...(sessionChanged ? emptyPublicPosSessionState() : {}),
    saving: true,
    error: null,
    token
  });

  try {
    const result = await request();
    if (!sessionCache.isCurrentSession(sessionVersion)) return result;

    sessionCache.clearDataCache();
    await get().loadCart({ t: token, lang }).catch(() => undefined);
    if (sessionCache.isCurrentSession(sessionVersion)) {
      set({ saving: false });
    }
    return result;
  } catch (error) {
    if (sessionCache.isCurrentSession(sessionVersion)) {
      set({ error: errorMessage(error), saving: false });
    }
    throw error;
  }
}

export const usePublicPosStore = create<PublicPosState>((set, get) => ({
  token: "",
  ...emptyPublicPosSessionState(),
  setToken: (token) => {
    const sessionChanged = sessionCache.currentToken() !== token;
    sessionCache.activateToken(token);
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
    const sessionVersion = sessionCache.activateSession(token, lang);
    const requestVersion = sessionCache.scanRequest.next();

    set({
      ...emptyPublicPosSessionState(),
      loading: true,
      token
    });
    try {
      const scan = await publicPosService.scanTableQR(token, lang);
      if (
        !sessionCache.scanRequest.isCurrent(requestVersion) ||
        !sessionCache.isCurrentSession(sessionVersion)
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
        sessionCache.scanRequest.isCurrent(requestVersion) &&
        sessionCache.isCurrentSession(sessionVersion)
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
    const sessionChanged = !sessionCache.isActiveSession(params.t, params.lang);
    const sessionVersion = sessionCache.activateSession(params.t, params.lang);
    const requestVersion = sessionCache.cartRequest.next();
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
        sessionCache.isCurrentSession(sessionVersion) &&
        sessionCache.cartRequest.isCurrent(requestVersion)
      ) {
        set({ cart, cartStatusRule, loadingCart: false, cartHydrated: true });
      }
      return cart;
    } catch (error) {
      if (
        sessionCache.isCurrentSession(sessionVersion) &&
        sessionCache.cartRequest.isCurrent(requestVersion)
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
    const sessionChanged = !sessionCache.isActiveSession(params.t, params.lang);
    sessionCache.activateSession(params.t, params.lang);
    if (sessionChanged) {
      set({ ...emptyPublicPosSessionState(), token: params.t });
    }
    const state = get();
    if (!sessionChanged && state.cartHydrated) return state.cart;

    const pendingRequest = sessionCache.getCartLoadPromise();
    if (pendingRequest) return pendingRequest;

    const request = get().loadCart(params);
    sessionCache.setCartLoadPromise(request);
    const clearPendingRequest = () => {
      if (sessionCache.getCartLoadPromise() === request) {
        sessionCache.setCartLoadPromise(null);
      }
    };
    void request.then(clearPendingRequest, clearPendingRequest);

    return request;
  },
  loadMenuProducts: async (params) => {
    const sessionChanged = !sessionCache.isActiveSession(params.token, params.lang);
    const sessionVersion = sessionCache.activateSession(params.token, params.lang);
    const baseParams: CustomerFetchCateProductsParams = {
      token: params.token,
      lang: params.lang,
      cateUuid: params.cateUuid?.trim() || undefined,
      search: params.search ?? ""
    };
    const sequenceKey = menuSequenceKey(baseParams);

    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      ...emptyProductBrowseState(),
      loadingMenu: true,
      menuRequestKey: sequenceKey,
      error: null,
      token: baseParams.token
    });

    try {
      const result = await sessionCache.fetchMenuProducts(baseParams);
      if (
        !sessionCache.isCurrentSession(sessionVersion) ||
        get().menuRequestKey !== sequenceKey
      ) {
        return get().menuByKind;
      }

      const categories = normalizeCategories(result.categories ?? []);
      const categoryTabs = toCategoryTabs(categories);
      const selectedCateUuid = firstAvailableCateUuid(categories, result.selectedCateUuid, result.defaultCateUuid);
      const defaultCateUuid =
        result.defaultCateUuid && categories.some((category) => category.cateUuid === result.defaultCateUuid)
          ? result.defaultCateUuid
          : selectedCateUuid;
      const loadedCateUuids = uniqueStrings([selectedCateUuid, ...productCateUuids(categories)]);
      const specialProducts = splitSpecialProducts(result.specialProducts ?? []);
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
        sessionCache.isCurrentSession(sessionVersion) &&
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
    const sessionChanged = !sessionCache.isActiveSession(params.token, params.lang);
    const sessionVersion = sessionCache.activateSession(params.token, params.lang);
    const cateUuid = params.cateUuid?.trim();
    if (!cateUuid) return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];

    if (sessionChanged) {
      set({
        ...emptyPublicPosSessionState(),
        token: params.token
      });
    }

    const state = get();
    const normalMenu = state.menuByKind[PUBLIC_MENU_KIND.NORMAL];
    if (normalMenu.loadedCateUuids.includes(cateUuid) || normalMenu.loadingCateUuids.includes(cateUuid)) {
      return normalMenu;
    }

    const requestParams: CustomerFetchCateProductsParams = {
      token: params.token,
      lang: params.lang,
      cateUuid,
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
      const result = await sessionCache.fetchMenuProducts(requestParams);
      if (!sessionCache.isCurrentSession(sessionVersion)) {
        return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];
      }
      const categories = normalizeCategories(result.categories ?? []);

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
              defaultCateUuid: currentNormalMenu.defaultCateUuid || result.defaultCateUuid || cateUuid,
              loadedCateUuids: uniqueStrings([...currentNormalMenu.loadedCateUuids, cateUuid]),
              loadingCateUuids: currentNormalMenu.loadingCateUuids.filter((uuid) => uuid !== cateUuid),
              error: null,
              requestKey
            }
          },
          categoryTabs,
          defaultCateUuid: current.defaultCateUuid || result.defaultCateUuid || cateUuid
        };
      });
    } catch (error) {
      const message = errorMessage(error);
      if (sessionCache.isCurrentSession(sessionVersion)) {
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
    const sessionChanged = !sessionCache.isActiveSession(params.token, params.lang);
    const sessionVersion = sessionCache.activateSession(params.token, params.lang);
    const requestVersion = sessionCache.productItemRequest.next();
    set({
      ...(sessionChanged ? emptyPublicPosSessionState() : {}),
      loadingItem: true,
      error: null,
      token: params.token,
      selectedProduct: null
    });
    try {
      const selectedProduct = await sessionCache.fetchProductItem(params);
      if (
        sessionCache.isCurrentSession(sessionVersion) &&
        sessionCache.productItemRequest.isCurrent(requestVersion)
      ) {
        set({ selectedProduct, loadingItem: false });
      }
      return selectedProduct;
    } catch (error) {
      if (
        sessionCache.isCurrentSession(sessionVersion) &&
        sessionCache.productItemRequest.isCurrent(requestVersion)
      ) {
        set({ error: errorMessage(error), loadingItem: false });
      }
      throw error;
    }
  },
  createOrder: (token, input) =>
    runSavingCartMutation({
      get,
      lang: input.lang ?? get().scan?.lang ?? sessionCache.currentLanguage(),
      request: () => publicPosService.customerCreateOrder(token, input),
      set,
      token
    }),
  updateQty: (params) =>
    runSavingCartMutation({
      get,
      lang: get().scan?.lang ?? sessionCache.currentLanguage(),
      request: () => publicPosService.customerUpdateQty(params),
      set,
      token: params.t
    }),
  deleteItem: (params) =>
    runSavingCartMutation({
      get,
      lang: get().scan?.lang ?? sessionCache.currentLanguage(),
      request: () => publicPosService.customerDeleteOrderItem(params),
      set,
      token: params.t
    }),
  updateNote: (params) =>
    runSavingCartMutation({
      get,
      lang: get().scan?.lang ?? sessionCache.currentLanguage(),
      request: () => publicPosService.customerUpdateOrderNote(params),
      set,
      token: params.t
    }),
  confirmKitchen: async (params) => {
    const lang = get().scan?.lang ?? sessionCache.currentLanguage();
    const sessionChanged = !sessionCache.isActiveSession(params.t, lang);
    const sessionVersion = sessionCache.activateSession(params.t, lang);
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
      if (!sessionCache.isCurrentSession(sessionVersion)) return result;

      sessionCache.clearDataCache();
      if (scan?.branch_uuid_fk && scan.table_uuid) {
        await get().emitTableStatus({
          t: params.t,
          branch_uuid_fk: scan.branch_uuid_fk,
          table_uuid: scan.table_uuid
        }).catch(() => undefined);
      }
      if (sessionCache.isCurrentSession(sessionVersion)) {
        await get().loadCart({ t: params.t, lang }).catch(() => undefined);
      }
      if (sessionCache.isCurrentSession(sessionVersion)) {
        set({ confirming: false });
      }
      return result;
    } catch (error) {
      if (sessionCache.isCurrentSession(sessionVersion)) {
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
    sessionCache.invalidateSession();
    set({
      ...emptyPublicPosSessionState(),
      token: "",
    });
  }
}));
