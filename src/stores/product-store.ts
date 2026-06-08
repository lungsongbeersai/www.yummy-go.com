"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT, isAllPageLimit } from "@/lib/pagination";
import {
  deleteProduct,
  getProducts,
  getSizesByStatus,
  getStatusSorts,
  saveProduct,
  updateProductEnabled,
  updateProductNotificationEnabled,
  updateProductStockMode,
  type FetchProductsParams,
  type Product,
  type ProductStockModePatch,
  type ProductStatusFieldsPatch,
  type SaveProductInput,
  type SizeOption,
  type StatusSort
} from "@/services/product";
import { deleteSize, saveSizeForStatus, type SaveSizeForStatusInput } from "@/services/size";
import type { PageLimit } from "@/services/shared/types";
import { errorMessage } from "@/stores/store-utils";
import {
  applyProductStatusFields,
  patchDetail,
  patchProduct,
  responseNumber,
  stockModesFromResponse,
  upsertProduct
} from "@/stores/product-store/helpers";

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
  loadStatusSorts: (lang?: string) => Promise<StatusSort[]>;
  loadSizesByStatus: (storeUuid: string, statusSort: number, lang?: string) => Promise<SizeOption[]>;
  createSizeForStatus: (input: SaveSizeForStatusInput) => Promise<SizeOption>;
  deleteSizeForStatus: (sizeUuid: string) => Promise<void>;
  save: (input: SaveProductInput) => Promise<Product>;
  remove: (prodUuid: string) => Promise<void>;
  updateDetailEnabled: (detailUuid: string, enabled: number) => Promise<void>;
  updateDetailStock: (detailUuid: string, stockMode: number) => Promise<void>;
  updateDetailsStock: (stockModes: ProductStockModePatch[]) => Promise<void>;
  updateProductNotification: (prodUuid: string, enabled: number) => Promise<void>;
  setEnabled: (detailUuid: string, enabled: number) => Promise<void>;
  setStockMode: (detailUuid: string, stockMode: number) => Promise<void>;
  setNotification: (prodUuid: string, enabled: number) => Promise<void>;
  updateStatusFields: (input: ProductStatusFieldsPatch) => Promise<void>;
  reset: () => void;
}

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
    set({ loading: true, error: null });
    try {
      const result = await getProducts({
        ...params,
        search: params.search ?? get().search,
        cate_uuid_fk: params.cate_uuid_fk ?? get().cateUuidFk,
        limit: params.limit ?? get().pageLimit
      });
      const rows = result.data ?? [];
      set({
        rows,
        total: Number(result.total ?? rows.length),
        totalPages: isAllPageLimit(params.limit ?? get().pageLimit) ? 1 : Number(result.totalPages ?? result.total_page ?? 1),
        loading: false
      });
      return rows;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadStatusSorts: async (lang) => {
    const statusSorts = await getStatusSorts(lang);
    set({ statusSorts });
    return statusSorts;
  },
  loadSizesByStatus: async (storeUuid, statusSort, lang) => {
    const requestedStatus = Number(statusSort);
    const requestId = ++sizesByStatusRequestId;
    set({ sizesByStatusStatus: null });
    const sizesByStatus = await getSizesByStatus(storeUuid, statusSort, lang);
    if (requestId === sizesByStatusRequestId) {
      set({ sizesByStatus, sizesByStatusStatus: requestedStatus });
    }
    return sizesByStatus;
  },
  createSizeForStatus: async (input) => {
    const size = await saveSizeForStatus(input);
    return size as SizeOption;
  },
  deleteSizeForStatus: (sizeUuid) => deleteSize(sizeUuid),
  save: async (input) => {
    set({ saving: true, error: null });
    try {
      const product = await saveProduct(input);
      set((state) => ({
        rows: upsertProduct(state.rows, product),
        saving: false
      }));
      return product;
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  remove: async (prodUuid) => {
    set({ saving: true, error: null });
    try {
      await deleteProduct(prodUuid);
      set((state) => ({
        rows: state.rows.filter((row) => row.prod_uuid !== prodUuid),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateDetailEnabled: async (detailUuid, enabled) => {
    set({ saving: true, error: null });
    try {
      const response = await updateProductEnabled(detailUuid, enabled);
      const syncedEnabled = responseNumber(response, "pro_detail_enabled", enabled);
      set((state) => ({
        rows: patchDetail(state.rows, detailUuid, { pro_detail_enabled: syncedEnabled }),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateDetailStock: async (detailUuid, stockMode) => {
    set({ saving: true, error: null });
    try {
      const response = await updateProductStockMode(detailUuid, stockMode);
      const syncedStock = responseNumber(response, "pro_detail_stock", stockMode);
      set((state) => ({
        rows: patchDetail(state.rows, detailUuid, { pro_detail_stock: syncedStock }),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateDetailsStock: async (stockModes) => {
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
      set((state) => ({
        rows: applyProductStatusFields(state.rows, { stockModes: syncedStockModes }),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateProductNotification: async (prodUuid, enabled) => {
    set({ saving: true, error: null });
    try {
      const response = await updateProductNotificationEnabled(prodUuid, enabled);
      const syncedNotification = responseNumber(response, "prod_notification", enabled);
      set((state) => ({
        rows: patchProduct(state.rows, prodUuid, { prod_notification: syncedNotification }),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  setEnabled: async (detailUuid, enabled) => get().updateDetailEnabled(detailUuid, enabled),
  setStockMode: async (detailUuid, stockMode) => get().updateDetailStock(detailUuid, stockMode),
  setNotification: async (prodUuid, enabled) => get().updateProductNotification(prodUuid, enabled),
  updateStatusFields: async (input) => {
    set({ saving: true, error: null });
    try {
      await Promise.all([
        ...(input.notification ? [updateProductNotificationEnabled(input.notification)] : []),
        ...(input.stockModes?.map((row) => updateProductStockMode(row)) ?? []),
        ...(input.enabled?.map((row) => updateProductEnabled(row)) ?? [])
      ]);
      set((state) => ({
        rows: applyProductStatusFields(state.rows, input),
        saving: false
      }));
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  reset: () =>
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
    })
}));
