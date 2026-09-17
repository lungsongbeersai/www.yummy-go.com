"use client";

import { create } from "zustand";
import * as depositService from "@/services/deposit";
import type {
  DepositCreateInput,
  DepositCreateResponse,
  DepositListStatusFilter,
  DepositRow,
  DepositWithdrawal,
  DepositWithdrawInput,
  DepositWithdrawResponse
} from "@/services/deposit";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface DepositState {
  rows: DepositRow[];
  total: number;
  totalPages: number;
  detail: DepositRow | null;
  detailWithdrawals: DepositWithdrawal[];
  detailLoading: boolean;
  error: string | null;
  loading: boolean;
  saving: boolean;
  withdrawing: boolean;
  loadList: (params: {
    branchUuid: string;
    customerUuid?: string;
    status?: DepositListStatusFilter;
    search?: string;
    lang?: string;
  }) => Promise<DepositRow[]>;
  loadDetail: (depositUuid: string, lang?: string) => Promise<DepositRow>;
  create: (input: DepositCreateInput) => Promise<DepositCreateResponse>;
  withdraw: (input: DepositWithdrawInput) => Promise<DepositWithdrawResponse>;
  clearDetail: () => void;
  reset: () => void;
}

const initialState = {
  rows: [] as DepositRow[],
  total: 0,
  totalPages: 1,
  detail: null as DepositRow | null,
  detailWithdrawals: [] as DepositWithdrawal[],
  detailLoading: false,
  error: null as string | null,
  loading: false,
  saving: false,
  withdrawing: false
};

let listRequestId = 0;
let detailRequestId = 0;

export const useDepositStore = create<DepositState>((set, get) => ({
  ...initialState,
  loadList: async ({ branchUuid, customerUuid, status, search, lang }) => {
    const requestId = ++listRequestId;
    const isCurrentSession = createSessionGuard();
    set({ error: null, loading: true });
    try {
      const response = await depositService.fetchDepositList({
        branch_uuid: branchUuid,
        customer_uuid: customerUuid,
        status,
        search,
        lang
      });
      if (isCurrentSession() && requestId === listRequestId) {
        set({
          rows: response.data,
          total: response.total,
          totalPages: response.totalPages,
          loading: false
        });
      }
      return response.data;
    } catch (error) {
      if (isCurrentSession() && requestId === listRequestId) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadDetail: async (depositUuid, lang) => {
    const requestId = ++detailRequestId;
    const isCurrentSession = createSessionGuard();
    set({ detail: null, detailWithdrawals: [], detailLoading: true, error: null });
    try {
      const response = await depositService.fetchDepositDetail(depositUuid, lang);
      if (isCurrentSession() && requestId === detailRequestId) {
        set({
          detail: response.deposit,
          detailWithdrawals: response.withdrawals,
          detailLoading: false
        });
      }
      return response.deposit;
    } catch (error) {
      if (isCurrentSession() && requestId === detailRequestId) {
        set({ detailLoading: false, error: errorMessage(error) });
      }
      throw error;
    }
  },
  create: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      const response = await depositService.createDeposit(input);
      if (isCurrentSession()) {
        set({ rows: [...response.deposits, ...get().rows], saving: false });
      }
      return response;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  withdraw: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, withdrawing: true });
    try {
      const response = await depositService.withdrawDeposit(input);
      if (isCurrentSession()) {
        set({
          rows: get().rows.map((row) =>
            row.deposit_uuid === response.deposit.deposit_uuid ? response.deposit : row
          ),
          detail: response.deposit,
          detailWithdrawals: [...get().detailWithdrawals, response.withdrawal],
          withdrawing: false
        });
      }
      return response;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), withdrawing: false });
      throw error;
    }
  },
  clearDetail: () => {
    detailRequestId += 1;
    set({ detail: null, detailWithdrawals: [], detailLoading: false });
  },
  reset: () => {
    listRequestId += 1;
    detailRequestId += 1;
    set(initialState);
  }
}));

registerSessionStoreReset("deposit", () => useDepositStore.getState().reset());
