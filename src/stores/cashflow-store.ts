"use client";

import { create } from "zustand";
import * as cashflow from "@/services/cashflow";
import type { CashflowCategory, CashflowEntry, CashflowReport, FetchCashflowCategoriesParams,
  FetchCashflowEntriesParams, FetchCashflowReportParams, SaveCashflowCategoryInput, SaveCashflowEntryInput } from "@/services/cashflow";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface CashflowState {
  branchUuid: string;
  categoriesBranchUuid: string;
  entriesBranchUuid: string;
  reportBranchUuid: string;
  categories: CashflowCategory[];
  entries: CashflowEntry[];
  report: CashflowReport | null;
  reportParams: FetchCashflowReportParams | null;
  categoriesLoading: boolean;
  entriesLoading: boolean;
  reportLoading: boolean;
  saving: boolean;
  error: string | null;
  categoriesError: string | null;
  entriesError: string | null;
  reportError: string | null;
  total: number;
  totalPages: number;
  loadCategories: (params: FetchCashflowCategoriesParams) => Promise<CashflowCategory[]>;
  saveCategory: (input: SaveCashflowCategoryInput) => Promise<CashflowCategory>;
  removeCategory: (categoryUuid: string, branchUuid: string) => Promise<void>;
  loadEntries: (params: FetchCashflowEntriesParams) => Promise<CashflowEntry[]>;
  saveEntry: (input: SaveCashflowEntryInput) => Promise<CashflowEntry>;
  removeEntry: (entryUuid: string, version: number, branchUuid: string) => Promise<void>;
  loadReport: (params: FetchCashflowReportParams) => Promise<CashflowReport>;
  reset: () => void;
}

const initial = { branchUuid: "", categoriesBranchUuid: "", entriesBranchUuid: "", reportBranchUuid: "",
  categories: [] as CashflowCategory[], entries: [] as CashflowEntry[],
  report: null as CashflowReport | null, reportParams: null as FetchCashflowReportParams | null,
  categoriesLoading: false, entriesLoading: false, reportLoading: false,
  saving: false, error: null as string | null, categoriesError: null as string | null,
  entriesError: null as string | null, reportError: null as string | null, total: 0, totalPages: 1 };

let generation = 0;
let categoryRequest = 0;
let entriesRequest = 0;
let reportRequest = 0;
let pendingMutations = 0;

export const useCashflowStore = create<CashflowState>((set, get) => {
  function scope(branchUuid: string) {
    if (get().branchUuid !== branchUuid) {
      generation += 1;
      categoryRequest += 1;
      entriesRequest += 1;
      reportRequest += 1;
      pendingMutations = 0;
      set({ ...initial, branchUuid });
    }
    const currentGeneration = generation;
    const session = createSessionGuard();
    return () => currentGeneration === generation && session();
  }

  async function mutate<T>(branchUuid: string, operation: () => Promise<T>): Promise<T> {
    const current = scope(branchUuid);
    pendingMutations += 1;
    set({ saving: true, error: null });
    try {
      return await operation();
    } catch (error) {
      if (current()) set({ error: errorMessage(error) });
      throw error;
    } finally {
      if (current()) {
        pendingMutations -= 1;
        set({ saving: pendingMutations > 0 });
      }
    }
  }

  return {
    ...initial,
    loadCategories: async (params) => {
      const current = scope(cashflow.cashflowBranchUuid(params));
      const request = ++categoryRequest;
      set({ categoriesBranchUuid: cashflow.cashflowBranchUuid(params), categoriesLoading: true, categoriesError: null, error: null });
      try {
        const categories = await cashflow.getCashflowCategories(params);
        if (current() && request === categoryRequest) set({ categories, categoriesLoading: false });
        return categories;
      } catch (error) {
        if (current() && request === categoryRequest) set({ categories: [], categoriesLoading: false,
          categoriesError: errorMessage(error), error: errorMessage(error) });
        throw error;
      }
    },
    saveCategory: (input) => mutate(cashflow.cashflowBranchUuid(input), () => cashflow.saveCashflowCategory(input)),
    removeCategory: (categoryUuid, branchUuid) => mutate(branchUuid, () => cashflow.deleteCashflowCategory(categoryUuid, branchUuid)),
    loadEntries: async (params) => {
      const current = scope(cashflow.cashflowBranchUuid(params));
      const request = ++entriesRequest;
      set({ entriesBranchUuid: cashflow.cashflowBranchUuid(params), entriesLoading: true, entriesError: null, error: null });
      try {
        const result = await cashflow.getCashflowEntries(params);
        if (current() && request === entriesRequest) set({ entries: result.data, total: result.pagination.total,
          totalPages: result.pagination.totalPages, entriesLoading: false });
        return result.data;
      } catch (error) {
        if (current() && request === entriesRequest) set({ entries: [], total: 0, totalPages: 1,
          entriesLoading: false, entriesError: errorMessage(error), error: errorMessage(error) });
        throw error;
      }
    },
    saveEntry: (input) => mutate(cashflow.cashflowBranchUuid(input), () => cashflow.saveCashflowEntry(input)),
    removeEntry: (entryUuid, version, branchUuid) => mutate(branchUuid, async () => {
      await cashflow.deleteCashflowEntry(entryUuid, version, branchUuid);
    }),
    loadReport: async (params) => {
      const requestParams = { ...params };
      const current = scope(cashflow.cashflowBranchUuid(requestParams));
      const request = ++reportRequest;
      set({ reportBranchUuid: cashflow.cashflowBranchUuid(requestParams), report: null, reportParams: null,
        reportLoading: true, reportError: null });
      try {
        const report = await cashflow.getCashflowReport(requestParams);
        if (current() && request === reportRequest) set({ report, reportParams: requestParams, reportLoading: false });
        return report;
      } catch (error) {
        if (current() && request === reportRequest) set({ report: null, reportParams: null,
          reportLoading: false, reportError: errorMessage(error) });
        throw error;
      }
    },
    reset: () => {
      generation += 1;
      categoryRequest += 1;
      entriesRequest += 1;
      reportRequest += 1;
      pendingMutations = 0;
      set(initial);
    },
  };
});

registerSessionStoreReset("cashflow", () => useCashflowStore.getState().reset());
