"use client";

import { create } from "zustand";
import {
  getStockProducts,
  type FetchStockParams,
  type StockProduct,
} from "@/services/stock";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface StockState {
  rows: StockProduct[];
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  load: (params: FetchStockParams) => Promise<StockProduct[]>;
  reset: () => void;
}

let stockLoadRequestId = 0;

export const useStockStore = create<StockState>((set) => ({
  rows: [],
  total: 0,
  totalPages: 1,
  loading: false,
  error: null,
  load: async (params) => {
    const requestId = ++stockLoadRequestId;
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });

    try {
      const result = await getStockProducts(params);
      const rows = Array.isArray(result.data) ? result.data : [];

      if (requestId === stockLoadRequestId && isCurrentSession()) {
        set({
          rows,
          total: Number(result.total ?? rows.length),
          totalPages: Number(result.totalPages ?? result.total_page ?? 1),
          loading: false,
        });
      }

      return rows;
    } catch (error) {
      if (requestId === stockLoadRequestId && isCurrentSession()) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  reset: () => {
    stockLoadRequestId += 1;
    set({
      rows: [],
      total: 0,
      totalPages: 1,
      loading: false,
      error: null,
    });
  },
}));

registerSessionStoreReset("stock", () => useStockStore.getState().reset());
