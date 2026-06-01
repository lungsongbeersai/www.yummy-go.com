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

let cartLoadPromise: Promise<CartOrder[]> | null = null;

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
  confirmKitchen: (params: CustomerConfirmKitchenInput) => ReturnType<typeof publicPosService.customerConfirmKitchen>;
  emitTableStatus: (params: CustomerEmitTableStatusParams) => ReturnType<typeof publicPosService.customerEmitTableStatus>;
  reset: () => void;
}

export const usePublicPosStore = create<PublicPosState>((set, get) => ({
  token: "",
  tableName: "",
  scan: null,
  ...emptyProductBrowseState(),
  selectedProduct: null,
  cart: [],
  cartStatusRule: null,
  cartHydrated: false,
  loading: false,
  loadingCart: false,
  loadingItem: false,
  saving: false,
  confirming: false,
  error: null,
  setToken: (token) => set({ token }),
  setTableName: (tableName) => set({ tableName }),
  setSelectedCateUuid: (selectedCateUuid) => set({ selectedCateUuid }),
  setCart: (cart) => set({ cart }),
  setError: (error) => set({ error }),
  scanTable: async (token, lang) => {
    set({
      loading: true,
      error: null,
      token,
      scan: null,
      tableName: "",
      ...emptyProductBrowseState(),
      selectedProduct: null,
      cart: [],
      cartStatusRule: null,
      cartHydrated: false,
      loadingItem: false,
      saving: false,
      confirming: false
    });
    try {
      const scan = await publicPosService.scanTableQR(token, lang);
      set({
        scan,
        tableName: scan.table_name ?? "",
        loading: false
      });
      return scan;
    } catch (error) {
      set({ error: errorMessage(error), loading: false, scan: null, tableName: "" });
      throw error;
    }
  },
  loadCart: async (params) => {
    set({ loadingCart: true, error: null, token: params.t });
    try {
      const result = await publicPosService.fetchCustomerCart(params);
      const cart = normalizeCartOrders(result);
      const cartStatusRule = normalizeCartStatusRule(result);
      set({ cart, cartStatusRule, loadingCart: false, cartHydrated: true });
      return cart;
    } catch (error) {
      set({ error: errorMessage(error), cartStatusRule: null, loadingCart: false, cartHydrated: false });
      throw error;
    }
  },
  ensureCartLoaded: async (params) => {
    const state = get();
    if (state.cartHydrated) return state.cart;

    if (!cartLoadPromise) {
      cartLoadPromise = get()
        .loadCart(params)
        .finally(() => {
          cartLoadPromise = null;
        });
    }

    return cartLoadPromise;
  },
  loadMenuProducts: async (params) => {
    const baseParams: CustomerFetchCateProductsParams = {
      t: params.t,
      lang: params.lang,
      cate_uuid: params.cate_uuid?.trim() || undefined,
      search: params.search ?? ""
    };
    const sequenceKey = menuSequenceKey(baseParams);

    set({
      ...emptyProductBrowseState(),
      loadingMenu: true,
      menuRequestKey: sequenceKey,
      error: null,
      token: baseParams.t
    });

    try {
      const result = await publicPosService.customerFetchCateProducts(baseParams);
      if (get().menuRequestKey !== sequenceKey) return get().menuByKind;

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
      if (get().menuRequestKey === sequenceKey) {
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
    const cateUuid = params.cate_uuid?.trim();
    if (!cateUuid) return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];

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
      const result = await publicPosService.customerFetchCateProducts(requestParams);
      const categories = normalizeCategories(result.data ?? []);

      set((current) => {
        const currentNormalMenu = current.menuByKind[PUBLIC_MENU_KIND.NORMAL];
        const mergedCategories = mergeCategoryProducts(currentNormalMenu.categories, categories, cateUuid);
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
      throw error;
    }

    return get().menuByKind[PUBLIC_MENU_KIND.NORMAL];
  },
  loadProductItem: async (params) => {
    set({ loadingItem: true, error: null, token: params.t, selectedProduct: null });
    try {
      const selectedProduct = await publicPosService.customerGetProdItem(params);
      set({ selectedProduct, loadingItem: false });
      return selectedProduct;
    } catch (error) {
      set({ error: errorMessage(error), loadingItem: false });
      throw error;
    }
  },
  createOrder: async (token, input) => {
    set({ saving: true, error: null });
    try {
      const result = await publicPosService.customerCreateOrder(token, input);
      await get().loadCart({ t: token, lang: typeof input.lang === "string" ? input.lang : get().scan?.lang }).catch(() => undefined);
      set({ saving: false });
      return result;
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateQty: async (params) => {
    set({ saving: true, error: null, token: params.t });
    try {
      const result = await publicPosService.customerUpdateQty(params);
      await get().loadCart({ t: params.t, lang: get().scan?.lang }).catch(() => undefined);
      set({ saving: false });
      return result;
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  deleteItem: async (params) => {
    set({ saving: true, error: null, token: params.t });
    try {
      const result = await publicPosService.customerDeleteOrderItem(params);
      await get().loadCart({ t: params.t, lang: get().scan?.lang }).catch(() => undefined);
      set({ saving: false });
      return result;
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  confirmKitchen: async (params) => {
    set({ confirming: true, error: null, token: params.t });
    try {
      const result = await publicPosService.customerConfirmKitchen(params);
      const scan = get().scan;
      if (scan?.branch_uuid_fk && scan.table_uuid) {
        await get().emitTableStatus({
          t: params.t,
          branch_uuid_fk: scan.branch_uuid_fk,
          table_uuid: scan.table_uuid
        }).catch(() => undefined);
      }
      await get().loadCart({ t: params.t, lang: scan?.lang }).catch(() => undefined);
      set({ confirming: false });
      return result;
    } catch (error) {
      set({ error: errorMessage(error), confirming: false });
      throw error;
    }
  },
  emitTableStatus: (params) => {
    emitCustomerTableAlert(params);
    return publicPosService.customerEmitTableStatus(params);
  },
  reset: () =>
    set({
      token: "",
      tableName: "",
      scan: null,
      ...emptyProductBrowseState(),
      selectedProduct: null,
      cart: [],
      cartStatusRule: null,
      cartHydrated: false,
      loading: false,
      loadingCart: false,
      loadingItem: false,
      saving: false,
      confirming: false,
      error: null
    })
}));
