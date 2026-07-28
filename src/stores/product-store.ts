"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT, isAllPageLimit } from "@/lib/pagination";
import {
  deleteProduct,
  getProducts,
  getSizesByStatus,
  getStatusSorts,
  saveProduct,
  sortProductDetailsByProduct as sortProductDetailsByProductRequest,
  sortProductsByCategory as sortProductsByCategoryRequest,
  updateProductEnabled,
  updateProductNotificationEnabled,
  updateProductStockMode,
  type FetchProductsParams,
  type Product,
  type ProductDetail,
  type ProductStockModePatch,
  type ProductStatusFieldsPatch,
  type SaveProductInput,
  type SizeOption,
  type StatusSort
} from "@/services/product";
import { deleteSize, saveSizeForStatus, type SaveSizeForStatusInput } from "@/services/size";
import type { PageLimit } from "@/services/shared/types";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";
import {
  applyProductStatusFields,
  patchDetail,
  patchProduct,
  productDetailUuid,
  replaceProductDetails,
  responseNumber,
  stockModesFromResponse,
  upsertProduct,
  withProductDetailSort,
  withProductSort
} from "@/stores/product-store/helpers";
import {
  ensureProductImportReferences,
  type EnsureProductImportReferencesInput,
  type ProductImportResolvedReferences,
} from "@/stores/product-store/import-references";

interface ProductState {
  rows: Product[];
  statusSorts: StatusSort[];
  sizesByStatus: SizeOption[];
  sizesByStatusStatus: number | null;
  total: number;
  totalPages: number;
  search: string;
  cateUuidFk: string;
  pageLimit: PageLimit;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setSearch: (search: string) => void;
  setCateUuidFk: (cateUuidFk: string) => void;
  setPageLimit: (pageLimit: PageLimit) => void;
  load: (params?: FetchProductsParams) => Promise<Product[]>;
  loadAllForImport: (params: FetchProductsParams) => Promise<Product[]>;
  loadStatusSorts: (lang?: string) => Promise<StatusSort[]>;
  loadSizesByStatus: (storeUuid: string, statusSort: number, lang?: string) => Promise<SizeOption[]>;
  ensureImportReferences: (
    input: EnsureProductImportReferencesInput,
  ) => Promise<ProductImportResolvedReferences>;
  createSizeForStatus: (input: SaveSizeForStatusInput) => Promise<SizeOption>;
  deleteSizeForStatus: (sizeUuid: string) => Promise<void>;
  save: (input: SaveProductInput) => Promise<Product>;
  remove: (prodUuid: string) => Promise<void>;
  updateDetailEnabled: (detailUuid: string, enabled: number) => Promise<void>;
  updateDetailStock: (detailUuid: string, stockMode: number) => Promise<void>;
  updateDetailsStock: (stockModes: ProductStockModePatch[]) => Promise<void>;
  updateProductNotification: (prodUuid: string, enabled: number) => Promise<void>;
  sortProductsByCategory: (cateUuidFk: string, orderedProducts: Product[]) => Promise<void>;
  sortProductDetailsByProduct: (prodUuidFk: string, orderedDetails: ProductDetail[]) => Promise<void>;
  setEnabled: (detailUuid: string, enabled: number) => Promise<void>;
  setStockMode: (detailUuid: string, stockMode: number) => Promise<void>;
  setNotification: (prodUuid: string, enabled: number) => Promise<void>;
  updateStatusFields: (input: ProductStatusFieldsPatch) => Promise<void>;
  reset: () => void;
}

let productLoadRequestId = 0;
let sizesByStatusRequestId = 0;

export const useProductStore = create<ProductState>((set, get) => ({
  rows: [],
  statusSorts: [],
  sizesByStatus: [],
  sizesByStatusStatus: null,
  total: 0,
  totalPages: 0,
  search: "",
  cateUuidFk: "",
  pageLimit: DEFAULT_PAGE_LIMIT,
  loading: false,
  saving: false,
  error: null,
  setSearch: (search) => set({ search }),
  setCateUuidFk: (cateUuidFk) => set({ cateUuidFk }),
  setPageLimit: (pageLimit) => set({ pageLimit }),
  load: async (params = {}) => {
    const requestId = ++productLoadRequestId;
    const isCurrentSession = createSessionGuard();
    const pageLimit = params.limit ?? get().pageLimit;
    set({ loading: true, error: null });
    try {
      const result = await getProducts({
        ...params,
        search: params.search ?? get().search,
        cate_uuid_fk: params.cate_uuid_fk ?? get().cateUuidFk,
        limit: pageLimit
      });
      const rows = result.data ?? [];
      if (requestId === productLoadRequestId && isCurrentSession()) {
        set({
          rows,
          total: Number(result.total ?? rows.length),
          totalPages: isAllPageLimit(pageLimit) ? 1 : Number(result.totalPages ?? result.total_page ?? 1),
          loading: false
        });
      }
      return rows;
    } catch (error) {
      if (requestId === productLoadRequestId && isCurrentSession()) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadAllForImport: async (params) => {
    const result = await getProducts({
      ...params,
      search: "",
      cate_uuid_fk: "",
      limit: "All",
    });
    return result.data ?? [];
  },
  loadStatusSorts: async (lang) => {
    const isCurrentSession = createSessionGuard();
    const statusSorts = await getStatusSorts(lang);
    if (isCurrentSession()) set({ statusSorts });
    return statusSorts;
  },
  loadSizesByStatus: async (storeUuid, statusSort, lang) => {
    const isCurrentSession = createSessionGuard();
    const requestedStatus = Number(statusSort);
    const requestId = ++sizesByStatusRequestId;
    set({ sizesByStatusStatus: null });
    const sizesByStatus = await getSizesByStatus(storeUuid, statusSort, lang);
    if (requestId === sizesByStatusRequestId && isCurrentSession()) {
      set({ sizesByStatus, sizesByStatusStatus: requestedStatus });
    }
    return sizesByStatus;
  },
  ensureImportReferences: (input) => ensureProductImportReferences(input),
  createSizeForStatus: async (input) => {
    const size = await saveSizeForStatus(input);
    return size as SizeOption;
  },
  deleteSizeForStatus: (sizeUuid) => deleteSize(sizeUuid),
  save: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const product = await saveProduct(input);
      if (isCurrentSession()) {
        set((state) => ({
          rows: upsertProduct(state.rows, product),
          saving: false
        }));
      }
      return product;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  remove: async (prodUuid) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      await deleteProduct(prodUuid);
      if (isCurrentSession()) {
        set((state) => ({
          rows: state.rows.filter((row) => row.prod_uuid !== prodUuid),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateDetailEnabled: async (detailUuid, enabled) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const response = await updateProductEnabled(detailUuid, enabled);
      const syncedEnabled = responseNumber(response, "pro_detail_enabled", enabled);
      if (isCurrentSession()) {
        set((state) => ({
          rows: patchDetail(state.rows, detailUuid, { pro_detail_enabled: syncedEnabled }),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateDetailStock: async (detailUuid, stockMode) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const response = await updateProductStockMode(detailUuid, stockMode);
      const syncedStock = responseNumber(response, "pro_detail_stock", stockMode);
      if (isCurrentSession()) {
        set((state) => ({
          rows: patchDetail(state.rows, detailUuid, { pro_detail_stock: syncedStock }),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateDetailsStock: async (stockModes) => {
    const isCurrentSession = createSessionGuard();
    const patches = stockModes.filter((row) => row.pro_detail_uuid);
    if (!patches.length) return;

    set({ saving: true, error: null });
    try {
      const syncedStockModes = await Promise.all(
        patches.map(async (patch) => {
          const response = await updateProductStockMode(patch);
          return stockModesFromResponse(response, [patch])[0] ?? patch;
        })
      );
      if (isCurrentSession()) {
        set((state) => ({
          rows: applyProductStatusFields(state.rows, { stockModes: syncedStockModes }),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateProductNotification: async (prodUuid, enabled) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const response = await updateProductNotificationEnabled(prodUuid, enabled);
      const syncedNotification = responseNumber(response, "prod_notification", enabled);
      if (isCurrentSession()) {
        set((state) => ({
          rows: patchProduct(state.rows, prodUuid, { prod_notification: syncedNotification }),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  sortProductsByCategory: async (cateUuidFk, orderedProducts) => {
    const isCurrentSession = createSessionGuard();
    const sortedRows = withProductSort(orderedProducts.filter((row) => row.prod_uuid));
    if (sortedRows.length < 2) return;

    const previousRows = get().rows;
    set({ rows: sortedRows, saving: true, error: null });
    try {
      await sortProductsByCategoryRequest({
        cate_uuid_fk: cateUuidFk,
        items: sortedRows.map((row) => ({
          prod_uuid: row.prod_uuid,
          prod_sort: Number(row.prod_sort)
        }))
      });
      if (isCurrentSession()) set({ saving: false });
    } catch (error) {
      if (isCurrentSession()) {
        set({ rows: previousRows, error: errorMessage(error), saving: false });
      }
      throw error;
    }
  },
  sortProductDetailsByProduct: async (prodUuidFk, orderedDetails) => {
    const isCurrentSession = createSessionGuard();
    const sortedDetails = withProductDetailSort(
      orderedDetails.filter((detail) => productDetailUuid(detail))
    );
    if (sortedDetails.length < 2) return;

    const previousRows = get().rows;
    set((state) => ({
      rows: replaceProductDetails(state.rows, prodUuidFk, sortedDetails),
      saving: true,
      error: null
    }));
    try {
      await sortProductDetailsByProductRequest({
        prod_uuid_fk: prodUuidFk,
        items: sortedDetails.map((detail) => ({
          pro_detail_uuid: productDetailUuid(detail),
          pro_detail_sort: Number(detail.pro_detail_sort)
        }))
      });
      if (isCurrentSession()) set({ saving: false });
    } catch (error) {
      if (isCurrentSession()) {
        set({ rows: previousRows, error: errorMessage(error), saving: false });
      }
      throw error;
    }
  },
  setEnabled: async (detailUuid, enabled) => get().updateDetailEnabled(detailUuid, enabled),
  setStockMode: async (detailUuid, stockMode) => get().updateDetailStock(detailUuid, stockMode),
  setNotification: async (prodUuid, enabled) => get().updateProductNotification(prodUuid, enabled),
  updateStatusFields: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      await Promise.all([
        ...(input.notification ? [updateProductNotificationEnabled(input.notification)] : []),
        ...(input.stockModes?.map((row) => updateProductStockMode(row)) ?? []),
        ...(input.enabled?.map((row) => updateProductEnabled(row)) ?? [])
      ]);
      if (isCurrentSession()) {
        set((state) => ({
          rows: applyProductStatusFields(state.rows, input),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  reset: () => {
    productLoadRequestId += 1;
    sizesByStatusRequestId += 1;
    set({
      rows: [],
      statusSorts: [],
      sizesByStatus: [],
      sizesByStatusStatus: null,
      total: 0,
      totalPages: 0,
      search: "",
      cateUuidFk: "",
      pageLimit: DEFAULT_PAGE_LIMIT,
      loading: false,
      saving: false,
      error: null
    });
  }
}));

registerSessionStoreReset("product", () => useProductStore.getState().reset());
