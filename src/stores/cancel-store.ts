"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import * as cancelService from "@/services/cancel";
import type {
  CancelBillInput,
  CancelableBill,
  CancelableBillDetail,
  CancelableBillsResponse,
  CancelableDateOption,
  CancelledBillsResponse,
  FetchCancelledBillsParams,
  FetchCancelableBillsParams
} from "@/services/cancel";
import type { PageLimit } from "@/services/shared/types";
import {
  normalizeCancelableBillsResponse,
  normalizeCancelledBillsResponse,
  type CancelHistoryBill
} from "@/stores/cancel-store/helpers";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

export type { CancelHistoryBill };

interface CancelState {
  bills: CancelableBill[];
  cancelling: boolean;
  dateOptions: CancelableDateOption[];
  detailLoading: boolean;
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  page: number;
  response: CancelableBillsResponse | null;
  selectedBill: CancelableBillDetail | null;
  total: number;
  totalPages: number;
  historyBills: CancelHistoryBill[];
  historyError: string | null;
  historyLimit: PageLimit;
  historyLoading: boolean;
  historyPage: number;
  historyResponse: CancelledBillsResponse | null;
  historyTotal: number;
  historyTotalPages: number;
  cancelBill: (input: CancelBillInput) => ReturnType<typeof cancelService.cancelBill>;
  clearSelectedBill: () => void;
  load: (params: FetchCancelableBillsParams) => Promise<CancelableBillsResponse>;
  loadHistory: (params: FetchCancelledBillsParams) => Promise<CancelledBillsResponse>;
  reset: () => void;
  resetHistory: () => void;
}

const initialState = {
  bills: [],
  cancelling: false,
  dateOptions: [],
  detailLoading: false,
  error: null,
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  response: null,
  selectedBill: null,
  total: 0,
  totalPages: 1,
  historyBills: [],
  historyError: null,
  historyLimit: DEFAULT_PAGE_LIMIT,
  historyLoading: false,
  historyPage: 1,
  historyResponse: null,
  historyTotal: 0,
  historyTotalPages: 1
};

const initialHistoryState = {
  historyBills: [],
  historyError: null,
  historyLimit: DEFAULT_PAGE_LIMIT,
  historyLoading: false,
  historyPage: 1,
  historyResponse: null,
  historyTotal: 0,
  historyTotalPages: 1
};

export const useCancelStore = create<CancelState>((set) => ({
  ...initialState,
  cancelBill: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ cancelling: true, error: null });
    try {
      const result = await cancelService.cancelBill(input);
      if (isCurrentSession()) set({ cancelling: false });
      return result;
    } catch (error) {
      if (isCurrentSession()) set({ cancelling: false, error: errorMessage(error) });
      throw error;
    }
  },
  clearSelectedBill: () => set({ selectedBill: null }),
  load: async (params) => {
    const isCurrentSession = createSessionGuard();
    const detailLoading = Boolean(params.selected_order_uuid);
    set({ detailLoading, error: null, loading: !detailLoading });
    try {
      const response = await cancelService.fetchCancelableBills(params);
      const normalized = normalizeCancelableBillsResponse(response, params);
      if (isCurrentSession()) {
        set({
          ...normalized,
          detailLoading: false,
          limit: params.limit,
          loading: false,
          page: params.page,
          response
        });
      }
      return response;
    } catch (error) {
      if (isCurrentSession()) {
        set({ detailLoading: false, error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadHistory: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ historyError: null, historyLoading: true });
    try {
      const response = await cancelService.fetchCancelledBills(params);
      const normalized = normalizeCancelledBillsResponse(response, params);
      if (isCurrentSession()) {
        set({
          ...normalized,
          historyLoading: false,
          historyResponse: response
        });
      }
      return response;
    } catch (error) {
      if (isCurrentSession()) set({ historyError: errorMessage(error), historyLoading: false });
      throw error;
    }
  },
  reset: () => set(initialState),
  resetHistory: () => set(initialHistoryState)
}));

registerSessionStoreReset("cancel", () => useCancelStore.getState().reset());
