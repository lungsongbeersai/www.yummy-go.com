"use client";

import { create } from "zustand";
import {
  deleteExchange,
  getAllExchanges,
  getExchanges,
  saveExchange,
  type Exchange,
  type FetchAllExchangesParams,
  type FetchExchangesParams,
  type SaveExchangeInput
} from "@/services/exchange";
import type { CrudListLoadOptions, CrudListState } from "@/stores/crud-list-store";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface ExchangeState extends CrudListState<
  Exchange,
  SaveExchangeInput,
  FetchExchangesParams
> {
  allRows: Exchange[];
  loadingAll: boolean;
  loadAll: (params: FetchAllExchangesParams) => Promise<Exchange[]>;
}

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  rows: [],
  allRows: [],
  total: 0,
  totalPages: 1,
  search: "",
  hasLoaded: false,
  loading: false,
  refreshing: false,
  loadingAll: false,
  saving: false,
  error: null,
  setSearch: (search) => set({ search }),
  load: async (params = {}, options?: CrudListLoadOptions) => {
    const isCurrentSession = createSessionGuard();
    const background = Boolean(options?.background && get().hasLoaded);
    set({ error: null, loading: !background, refreshing: background });
    try {
      const result = await getExchanges({ ...params, search: params.search ?? get().search });
      const rows = Array.isArray(result.data) ? result.data : [];
      if (isCurrentSession()) {
        set({
          rows,
          total: Number(result.total ?? rows.length),
          totalPages: Number(result.totalPages ?? result.total_page ?? 1),
          hasLoaded: true,
          loading: false,
          refreshing: false
        });
      }
      return rows;
    } catch (error) {
      if (isCurrentSession()) {
        set({ error: errorMessage(error), loading: false, refreshing: false });
      }
      throw error;
    }
  },
  loadAll: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ loadingAll: true, error: null });
    try {
      const result = await getAllExchanges(params);
      const allRows = Array.isArray(result.data) ? result.data : [];
      if (isCurrentSession()) set({ allRows, loadingAll: false });
      return allRows;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loadingAll: false });
      throw error;
    }
  },
  save: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const row = await saveExchange(input);
      if (isCurrentSession()) set({ saving: false });
      return row;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  remove: async (id) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      await deleteExchange(id);
      if (isCurrentSession()) {
        set((state) => ({
          rows: state.rows.filter((row) => String(row.ex_uuid ?? "") !== id),
          allRows: state.allRows.filter((row) => String(row.ex_uuid ?? "") !== id),
          saving: false
        }));
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  reset: () =>
    set({
      rows: [],
      allRows: [],
      total: 0,
      totalPages: 1,
      search: "",
      hasLoaded: false,
      loading: false,
      refreshing: false,
      loadingAll: false,
      saving: false,
      error: null
    })
}));

registerSessionStoreReset("exchange", () => useExchangeStore.getState().reset());
