"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import {
  getBestSellingProductsReport,
  getDailySaleItems,
  getDailySalesReport,
  getPaymentMethodsReport,
  type BestSellingProductsReportResponse,
  type DailySaleItemsResponse,
  type FetchBestSellingProductsReportParams,
  type FetchDailySaleItemsParams,
  type DailySalesReportResponse,
  type FetchDailySalesReportParams,
  type FetchPaymentMethodsReportParams,
  type PaymentMethodsReportResponse
} from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import {
  mergeBestSellingProductGroups,
  normalizeBestSellingProductsReportResponse,
  type BestSellingProductGroup,
  type BestSellingProductItem,
  type BestSellingProductsPagination
} from "@/stores/report-store/best-selling-normalizers";
import {
  createDailySalesBillGroups,
  normalizeDailySalesReportResponse,
  reportTotalPages,
  type DailySalesBillGroup,
  type SummaryCards
} from "@/stores/report-store/normalizers";
import {
  normalizePaymentMethodsReportResponse,
  type PaymentMethodOption,
  type PaymentMethodReportRow,
  type PaymentMethodSummaryCard,
  type PaymentMethodsPagination
} from "@/stores/report-store/payment-method-normalizers";
import {
  normalizeDailySaleItemsResponse,
  type DailySaleItemsBillGroup,
  type DailySaleItemsPagination
} from "@/stores/report-store/daily-sale-items-normalizers";
import { errorMessage } from "@/stores/store-utils";
import {
  loadBestSellingProductsReportExportData,
  loadDailySalesReportExportData,
  loadPaymentMethodsReportExportData,
  type BestSellingProductsReportExportData,
  type BestSellingProductsReportExportParams,
  type DailySalesReportExportData,
  type DailySalesReportExportParams,
  type PaymentMethodsReportExportData,
  type PaymentMethodsReportExportParams
} from "@/stores/report-store/export-loaders";

export { createDailySalesBillGroups, normalizeDailySalesReportResponse };
export { mergeBestSellingProductGroups, normalizeBestSellingProductsReportResponse };
export { normalizeDailySaleItemsResponse };
export { normalizePaymentMethodsReportResponse };
export type { DailySalesBillGroup };
export type { DailySaleItemsBillGroup, DailySaleItemsPagination };
export type { BestSellingProductGroup, BestSellingProductItem, BestSellingProductsPagination };
export type { PaymentMethodOption, PaymentMethodReportRow, PaymentMethodSummaryCard, PaymentMethodsPagination };
export type {
  BestSellingProductsReportExportData,
  DailySalesReportExportData,
  PaymentMethodsReportExportData
};

interface DailySalesReportState {
  billGroups: DailySalesBillGroup[];
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  grandTotalByDate: ApiEntity[];
  page: number;
  reportTotal: ApiEntity;
  response: DailySalesReportResponse | null;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
  total: number;
  totalPages: number;
  loadExportData: (params: DailySalesReportExportParams) => Promise<DailySalesReportExportData>;
  load: (params: FetchDailySalesReportParams) => Promise<DailySalesReportResponse>;
  reset: () => void;
}

export const useDailySalesReportStore = create<DailySalesReportState>((set) => ({
  billGroups: [],
  error: null,
  grandTotalByDate: [],
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  reportTotal: {},
  response: null,
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadDailySalesReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getDailySalesReport(requestParams);
      const root = (
        response.data && typeof response.data === "object" && !Array.isArray(response.data)
          ? response.data
          : response
      ) as ApiEntity;
      const normalized = normalizeDailySalesReportResponse(response);
      const rows = normalized.rows;
      const total = Number(root.total ?? root.total_rows ?? root.count ?? root.report_count ?? rows.length);
      const allRows = [...rows];
      const allBillGroups = [...normalized.billGroups];

      if (loadAll) {
        const pageCount = reportTotalPages(root, total, PAGE_LIMIT_ALL_BATCH, 1);
        for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
          const nextResponse = await getDailySalesReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeDailySalesReportResponse(nextResponse);
          allRows.push(...nextNormalized.rows);
          allBillGroups.push(...nextNormalized.billGroups);
        }
      }

      set({
        billGroups: loadAll ? allBillGroups : normalized.billGroups,
        grandTotalByDate: normalized.grandTotalByDate,
        limit: params.limit,
        loading: false,
        page: loadAll ? 1 : params.page,
        reportTotal: normalized.reportTotal,
        response,
        rows: allRows,
        summaryCards: normalized.summaryCards,
        total,
        totalPages: loadAll ? 1 : reportTotalPages(root, total, params.limit, params.page)
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      billGroups: [],
      error: null,
      grandTotalByDate: [],
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      reportTotal: {},
      response: null,
      rows: [],
      summaryCards: {},
      total: 0,
      totalPages: 1
    })
}));

interface DailySaleItemsReportState {
  bills: DailySaleItemsBillGroup[];
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: DailySaleItemsPagination;
  reportTotal: ApiEntity;
  response: DailySaleItemsResponse | null;
  rows: ApiEntity[];
  total: number;
  totalPages: number;
  load: (params: FetchDailySaleItemsParams) => Promise<DailySaleItemsResponse>;
  reset: () => void;
}

const defaultDailySaleItemsPagination: DailySaleItemsPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useDailySaleItemsStore = create<DailySaleItemsReportState>((set) => ({
  bills: [],
  error: null,
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultDailySaleItemsPagination,
  reportTotal: {},
  response: null,
  rows: [],
  total: 0,
  totalPages: 1,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getDailySaleItems(requestParams);
      const normalized = normalizeDailySaleItemsResponse(response, requestParams);
      const allBills = [...normalized.bills];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getDailySaleItems({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeDailySaleItemsResponse(nextResponse, { ...requestParams, page: nextPage });
          allBills.push(...nextNormalized.bills);
        }
      }

      const total = loadAll ? allBills.length : normalized.pagination.total;
      const pagination: DailySaleItemsPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        bills: allBills,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        reportTotal: normalized.reportTotal,
        response,
        rows: allBills.flatMap((bill) => bill.items),
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      bills: [],
      error: null,
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultDailySaleItemsPagination,
      reportTotal: {},
      response: null,
      rows: [],
      total: 0,
      totalPages: 1
    })
}));

interface BestSellingProductsReportState {
  error: string | null;
  filters: ApiEntity;
  groups: BestSellingProductGroup[];
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: BestSellingProductsPagination;
  response: BestSellingProductsReportResponse | null;
  rows: BestSellingProductItem[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
  loadExportData: (
    params: BestSellingProductsReportExportParams
  ) => Promise<BestSellingProductsReportExportData>;
  load: (params: FetchBestSellingProductsReportParams) => Promise<BestSellingProductsReportResponse>;
  reset: () => void;
}

const defaultBestSellingPagination: BestSellingProductsPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const useBestSellingProductsReportStore = create<BestSellingProductsReportState>((set) => ({
  error: null,
  filters: {},
  groups: [],
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultBestSellingPagination,
  response: null,
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadBestSellingProductsReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getBestSellingProductsReport(requestParams);
      const normalized = normalizeBestSellingProductsReportResponse(response, requestParams.limit, requestParams.page);
      const allGroups = [...normalized.groups];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getBestSellingProductsReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizeBestSellingProductsReportResponse(nextResponse, requestParams.limit, nextPage);
          allGroups.push(...nextNormalized.groups);
        }
      }

      const groups = loadAll ? mergeBestSellingProductGroups(allGroups) : normalized.groups;
      const rows = groups.flatMap((group) => group.items).sort((left, right) => left.rank - right.rank);
      const total = loadAll ? rows.length : normalized.pagination.total;
      const pagination: BestSellingProductsPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        filters: normalized.filters,
        groups,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        response,
        rows,
        summary: normalized.summary,
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      error: null,
      filters: {},
      groups: [],
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultBestSellingPagination,
      response: null,
      rows: [],
      summary: {},
      total: 0,
      totalPages: 1
    })
}));

interface PaymentMethodsReportState {
  cards: PaymentMethodSummaryCard[];
  error: string | null;
  limit: PageLimit;
  loading: boolean;
  page: number;
  pagination: PaymentMethodsPagination;
  paymentMethods: PaymentMethodOption[];
  reportName: string;
  reportTotal: ApiEntity;
  response: PaymentMethodsReportResponse | null;
  rows: PaymentMethodReportRow[];
  summaryCards: ApiEntity;
  total: number;
  totalPages: number;
  loadExportData: (params: PaymentMethodsReportExportParams) => Promise<PaymentMethodsReportExportData>;
  load: (params: FetchPaymentMethodsReportParams) => Promise<PaymentMethodsReportResponse>;
  reset: () => void;
}

const defaultPaymentMethodsPagination: PaymentMethodsPagination = {
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  total: 0,
  totalPages: 1
};

export const usePaymentMethodsReportStore = create<PaymentMethodsReportState>((set) => ({
  cards: [],
  error: null,
  limit: DEFAULT_PAGE_LIMIT,
  loading: false,
  page: 1,
  pagination: defaultPaymentMethodsPagination,
  paymentMethods: [],
  reportName: "",
  reportTotal: {},
  response: null,
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1,
  loadExportData: loadPaymentMethodsReportExportData,
  load: async (params) => {
    set({ error: null, loading: true });
    try {
      const loadAll = isAllPageLimit(params.limit);
      const requestParams = loadAll ? { ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } : params;
      const response = await getPaymentMethodsReport(requestParams);
      const normalized = normalizePaymentMethodsReportResponse(response, requestParams.limit, requestParams.page);
      const allRows = [...normalized.rows];

      if (loadAll) {
        for (let nextPage = 2; nextPage <= normalized.pagination.totalPages; nextPage += 1) {
          const nextResponse = await getPaymentMethodsReport({ ...requestParams, page: nextPage });
          const nextNormalized = normalizePaymentMethodsReportResponse(nextResponse, requestParams.limit, nextPage);
          allRows.push(...nextNormalized.rows);
        }
      }

      const total = loadAll ? allRows.length : normalized.pagination.total;
      const pagination: PaymentMethodsPagination = {
        ...normalized.pagination,
        limit: params.limit,
        page: loadAll ? 1 : normalized.pagination.page,
        total,
        totalPages: loadAll ? 1 : normalized.pagination.totalPages
      };

      set({
        cards: normalized.cards,
        limit: params.limit,
        loading: false,
        page: pagination.page,
        pagination,
        paymentMethods: normalized.paymentMethods,
        reportName: normalized.reportName,
        reportTotal: normalized.reportTotal,
        response,
        rows: allRows,
        summaryCards: normalized.summaryCards,
        total,
        totalPages: pagination.totalPages
      });

      return response;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  reset: () =>
    set({
      cards: [],
      error: null,
      limit: DEFAULT_PAGE_LIMIT,
      loading: false,
      page: 1,
      pagination: defaultPaymentMethodsPagination,
      paymentMethods: [],
      reportName: "",
      reportTotal: {},
      response: null,
      rows: [],
      summaryCards: {},
      total: 0,
      totalPages: 1
    })
}));
