"use client";

import { create } from "zustand";
import * as creditService from "@/services/credit";
import type {
  CreditBill,
  CreditBranch,
  CreditCustomer,
  CreditFetchResponse,
  CreditSelectedBillsResponse,
  CreditSummary,
  PayCreditInput,
  PayCreditResponse
} from "@/services/credit";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface CreditState {
  bills: CreditBill[];
  branches: CreditBranch[];
  customers: CreditCustomer[];
  detail: CreditSelectedBillsResponse | null;
  detailLoading: boolean;
  error: string | null;
  loading: boolean;
  saving: boolean;
  summary: CreditSummary | null;
  loadBranches: (lang?: string) => Promise<CreditFetchResponse>;
  loadCustomers: (branchUuid: string, lang?: string) => Promise<CreditFetchResponse>;
  loadBills: (branchUuid: string, customerUuid: string, lang?: string) => Promise<CreditFetchResponse>;
  loadDetail: (
    branchUuid: string,
    customerUuid: string,
    paymentUuids: string[],
    lang?: string
  ) => Promise<CreditSelectedBillsResponse>;
  pay: (input: PayCreditInput) => Promise<PayCreditResponse>;
  clearBills: () => void;
  clearDetail: () => void;
  reset: () => void;
}

const initialState = {
  bills: [] as CreditBill[],
  branches: [] as CreditBranch[],
  customers: [] as CreditCustomer[],
  detail: null as CreditSelectedBillsResponse | null,
  detailLoading: false,
  error: null as string | null,
  loading: false,
  saving: false,
  summary: null as CreditSummary | null
};

let branchesRequestId = 0;
let customersRequestId = 0;
let billsRequestId = 0;
let detailRequestId = 0;

function invalidateCustomerFlow() {
  customersRequestId += 1;
  billsRequestId += 1;
  detailRequestId += 1;
}

function invalidateBillFlow() {
  billsRequestId += 1;
  detailRequestId += 1;
}

export const useCreditStore = create<CreditState>((set) => ({
  ...initialState,
  loadBranches: async (lang) => {
    const requestId = ++branchesRequestId;
    invalidateCustomerFlow();
    const isCurrentSession = createSessionGuard();
    set({ error: null, loading: true });
    try {
      const response = await creditService.fetchCreditData({ lang });
      if (isCurrentSession() && requestId === branchesRequestId) {
        set({ branches: response.branches ?? [], loading: false });
      }
      return response;
    } catch (error) {
      if (isCurrentSession() && requestId === branchesRequestId) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadCustomers: async (branchUuid, lang) => {
    const requestId = ++customersRequestId;
    invalidateBillFlow();
    const isCurrentSession = createSessionGuard();
    set({ bills: [], customers: [], detail: null, error: null, loading: true, summary: null });
    try {
      const response = await creditService.fetchCreditData({ branch_uuid: branchUuid, lang });
      if (isCurrentSession() && requestId === customersRequestId) {
        set({
          customers: (response.customers ?? []).filter((customer) => customer.customer_uuid !== "all"),
          loading: false,
          summary: response.summary ?? null
        });
      }
      return response;
    } catch (error) {
      if (isCurrentSession() && requestId === customersRequestId) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadBills: async (branchUuid, customerUuid, lang) => {
    const requestId = ++billsRequestId;
    detailRequestId += 1;
    const isCurrentSession = createSessionGuard();
    set({ bills: [], detail: null, error: null, loading: true, summary: null });
    try {
      const response = await creditService.fetchCreditData({
        branch_uuid: branchUuid,
        customer_uuid: customerUuid,
        lang,
        limit: 100,
        page: 1
      });
      if (isCurrentSession() && requestId === billsRequestId) {
        set({ bills: response.bills ?? [], loading: false, summary: response.summary ?? null });
      }
      return response;
    } catch (error) {
      if (isCurrentSession() && requestId === billsRequestId) {
        set({ error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  loadDetail: async (branchUuid, customerUuid, paymentUuids, lang) => {
    const requestId = ++detailRequestId;
    const isCurrentSession = createSessionGuard();
    set({ detail: null, detailLoading: true, error: null });
    try {
      const response = await creditService.fetchCreditPaymentSelection({
        branch_uuid: branchUuid,
        customer_uuid: customerUuid,
        bill_uuids: paymentUuids,
        lang
      });
      if (isCurrentSession() && requestId === detailRequestId) {
        set({ detail: response, detailLoading: false });
      }
      return response;
    } catch (error) {
      if (isCurrentSession() && requestId === detailRequestId) {
        set({ detailLoading: false, error: errorMessage(error) });
      }
      throw error;
    }
  },
  pay: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      const response = await creditService.payCredit(input);
      if (isCurrentSession()) {
        const refreshed = response.payment_selection;
        set({
          bills: refreshed?.bills ?? [],
          detail: null,
          saving: false,
          summary: refreshed?.summary ?? null
        });
      }
      return response;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  clearBills: () => {
    invalidateBillFlow();
    set({
      bills: [],
      detail: null,
      detailLoading: false,
      error: null,
      loading: false,
      summary: null
    });
  },
  clearDetail: () => {
    detailRequestId += 1;
    set({ detail: null, detailLoading: false });
  },
  reset: () => {
    branchesRequestId += 1;
    invalidateCustomerFlow();
    set(initialState);
  }
}));

registerSessionStoreReset("credit", () => useCreditStore.getState().reset());
