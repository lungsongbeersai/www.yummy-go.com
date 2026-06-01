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
  FetchCancelableBillsParams
} from "@/services/cancel";
import type { PageLimit } from "@/services/shared/types";
import { normalizeCancelableBillsResponse } from "@/stores/cancel-store/helpers";
import { errorMessage } from "@/stores/store-utils";

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
  cancelBill: (input: CancelBillInput) => ReturnType<typeof cancelService.cancelBill>;
  clearSelectedBill: () => void;
  load: (params: FetchCancelableBillsParams) => Promise<CancelableBillsResponse>;
  reset: () => void;
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
  totalPages: 1
};

export const useCancelStore = create<CancelState>((set) => ({
  ...initialState,
  cancelBill: async (input) => {
    set({ cancelling: true, error: null });
    try {
      const result = await cancelService.cancelBill(input);
      set({ cancelling: false });
      return result;
    } catch (error) {
      set({ cancelling: false, error: errorMessage(error) });
      throw error;
    }
  },
  clearSelectedBill: () => set({ selectedBill: null }),
  load: async (params) => {
    const detailLoading = Boolean(params.selected_order_uuid);
    set({ detailLoading, error: null, loading: !detailLoading });
    try {
      const response = await cancelService.fetchCancelableBills(params);
      const normalized = normalizeCancelableBillsResponse(response, params);
      set({
        ...normalized,
        detailLoading: false,
        limit: params.limit,
        loading: false,
        page: params.page,
        response
      });
      return response;
    } catch (error) {
      set({ detailLoading: false, error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () => set(initialState)
}));
