"use client";

import { create } from "zustand";
import * as posService from "@/services/pos";
import type { MySalesOrder, MySalesParams, MySalesResponse, MySalesSummary } from "@/services/pos";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface MySalesState {
  orders: MySalesOrder[];
  pagination: MySalesResponse["pagination"];
  summary: MySalesSummary;
  loading: boolean;
  error: string | null;
  queryKey: string;
  load: (params: MySalesParams, scopeKey?: string) => Promise<void>;
  reset: () => void;
}

const emptySummary: MySalesSummary = {
  order_count: 0,
  pending_kitchen_count: 0,
  sent_kitchen_count: 0,
  unpaid_count: 0,
  paid_count: 0,
  cancelled_count: 0,
};

const initialState = {
  orders: [] as MySalesOrder[],
  pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
  summary: emptySummary,
  loading: false,
  error: null as string | null,
  queryKey: "",
};

let requestId = 0;

export const useMySalesStore = create<MySalesState>((set, get) => ({
  ...initialState,
  load: async (params, scopeKey = "") => {
    const currentRequest = ++requestId;
    const isCurrentSession = createSessionGuard();
    const queryKey = JSON.stringify({ scopeKey, params });
    set({
      ...(queryKey !== get().queryKey ? initialState : {}),
      queryKey,
      loading: true,
      error: null,
    });
    try {
      const response = await posService.fetchMySales(params);
      if (currentRequest === requestId && isCurrentSession()) {
        set({
          orders: response.data,
          pagination: response.pagination,
          summary: response.summary,
          loading: false,
        });
      }
    } catch (error) {
      if (currentRequest === requestId && isCurrentSession()) {
        set({ ...initialState, queryKey, error: errorMessage(error) });
      }
      throw error;
    }
  },
  reset: () => {
    requestId += 1;
    set(initialState);
  },
}));

registerSessionStoreReset("my-sales", () => useMySalesStore.getState().reset());
